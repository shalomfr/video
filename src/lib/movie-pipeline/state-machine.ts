import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  MovieState,
  MovieBrief,
  MovieScene,
  NarrativePlan,
  PipelineStage,
  PipelineOptions,
  PipelineProgressEvent,
} from './types';
import { buildContinuityDocument, updateContinuityAfterScene, getReferenceImageForScene } from './continuity';
import { planFullMovie, planMovieOutline, planActScenes, generateScenePrompt, refinePrompt } from './prompt-builder';
import { processSceneBatch } from './video-generator';
import { concatenateMovie } from './concatenator';
import { analyzeVideoQuality } from '../google-ai';
import { processNarration } from './narration';
import { generateSrtFile, burnSubtitles } from './subtitles';

// Feature-length threshold: above this, plan act-by-act
const LONG_MOVIE_THRESHOLD = 300; // 5 minutes

const DEFAULT_OPTIONS: Required<Omit<PipelineOptions, 'onProgress'>> & Pick<PipelineOptions, 'onProgress'> = {
  dryRun: false,
  singleScene: -1,
  batchSize: 4,
  maxRetries: 3,
  videoModel: 'veo',
  outputDir: './output',
  stateDir: './output/state',
  onProgress: undefined,
};

// ===== State Persistence =====

function getStatePath(stateDir: string, id: string): string {
  return path.join(stateDir, `movie-state-${id}.json`);
}

export function saveState(state: MovieState, stateDir: string): void {
  fs.mkdirSync(stateDir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  const filePath = getStatePath(stateDir, state.id);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function loadState(statePath: string): MovieState | null {
  if (!fs.existsSync(statePath)) return null;
  const data = fs.readFileSync(statePath, 'utf-8');
  return JSON.parse(data) as MovieState;
}

function createInitialState(brief: MovieBrief): MovieState {
  return {
    id: randomUUID().slice(0, 8),
    stage: 'NARRATIVE_PLANNING',
    brief,
    narrative: null,
    continuityDoc: null,
    scenes: [],
    soundtrackTaskId: null,
    soundtrackPath: null,
    finalVideoPath: null,
    subtitlePath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
}

// ===== Logging + Progress =====

function createProgressLogger(onProgress?: PipelineOptions['onProgress']) {
  return function emit(
    stage: PipelineStage,
    type: PipelineProgressEvent['type'],
    message: string,
    extra?: { sceneNumber?: number; meta?: Record<string, unknown> }
  ): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`[${timestamp}] [${stage}] ${message}`);

    onProgress?.({
      timestamp: new Date().toISOString(),
      stage,
      type,
      message,
      sceneNumber: extra?.sceneNumber,
      meta: extra?.meta,
    });
  };
}

// ===== Narrative Planning Strategies =====

async function planShortMovie(brief: MovieBrief): Promise<NarrativePlan> {
  return await planFullMovie(brief);
}

async function planLongMovie(
  brief: MovieBrief,
  emit: ReturnType<typeof createProgressLogger>
): Promise<NarrativePlan> {
  emit('NARRATIVE_PLANNING', 'detail', 'Creating movie outline...');
  const outline = await planMovieOutline(brief);

  const allScenes: NarrativePlan['scenes'] = [];
  let sceneOffset = 0;

  for (const act of outline.acts) {
    emit('NARRATIVE_PLANNING', 'detail', `Planning Act ${act.actNumber}: "${act.title}" (${act.sceneCount} scenes)...`, {
      meta: { actNumber: act.actNumber, sceneCount: act.sceneCount },
    });

    const actScenes = await planActScenes(brief, outline, act);
    for (const scene of actScenes) {
      scene.sceneNumber = sceneOffset + scene.sceneNumber;
      allScenes.push(scene);
    }
    sceneOffset += actScenes.length;
  }

  return {
    title: outline.title,
    acts: outline.acts.map((act) => ({
      actNumber: act.actNumber,
      title: act.title,
      description: act.summary,
      sceneNumbers: allScenes
        .filter((s) => s.actNumber === act.actNumber)
        .map((s) => s.sceneNumber),
    })),
    scenes: allScenes,
    styleGuide: {
      colorPalette: outline.styleGuide.colorPalette,
      visualStyle: outline.styleGuide.visualStyle,
      lightingStyle: outline.styleGuide.lightingStyle,
      cameraLanguage: outline.styleGuide.cameraLanguage,
      characterDescriptions: outline.characters.map((c) => ({
        name: c.name,
        appearance: c.appearance,
        clothing: c.clothing,
        distinctiveFeatures: c.distinctiveFeatures,
      })),
      recurringElements: outline.styleGuide.recurringElements,
    },
    totalDuration: allScenes.length * 8,
  };
}

// ===== Main Pipeline Loop =====

export async function runMoviePipeline(
  briefOrStatePath: MovieBrief | string,
  opts: PipelineOptions = {}
): Promise<string> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const emit = createProgressLogger(options.onProgress);

  // Initialize or resume state
  let state: MovieState;
  if (typeof briefOrStatePath === 'string') {
    const loaded = loadState(briefOrStatePath);
    if (!loaded) throw new Error(`Cannot resume: state file not found at ${briefOrStatePath}`);
    state = loaded;
    emit(state.stage, 'detail', `Resuming pipeline from stage: ${state.stage}`);
  } else {
    state = createInitialState(briefOrStatePath);
    emit('NARRATIVE_PLANNING', 'stage_start', `Starting new movie pipeline: ${state.id}`, {
      meta: { movieId: state.id },
    });
  }

  const clipsDir = path.join(options.outputDir, state.id, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });

  try {
    while (state.stage !== 'DONE' && state.stage !== 'FAILED') {
      switch (state.stage) {

        // ============================================================
        // STAGE 1: NARRATIVE PLANNING
        // ============================================================
        case 'NARRATIVE_PLANNING': {
          const duration = state.brief.targetDuration;
          const isLong = duration > LONG_MOVIE_THRESHOLD;
          const sceneEstimate = Math.ceil(duration / 8);

          emit('NARRATIVE_PLANNING', 'stage_start', `Planning ${isLong ? 'feature-length' : 'short'} movie (${duration}s, ~${sceneEstimate} scenes)...`, {
            meta: { duration, sceneEstimate, isLong },
          });

          let narrative: NarrativePlan;
          if (isLong) {
            narrative = await planLongMovie(state.brief, emit);
          } else {
            narrative = await planShortMovie(state.brief);
          }

          state.narrative = narrative;
          state.continuityDoc = buildContinuityDocument(narrative);

          state.scenes = narrative.scenes.map((s) => ({
            sceneNumber: s.sceneNumber,
            actNumber: s.actNumber,
            description: s.description,
            plannedPrompt: s.prompt,
            finalPrompt: '',
            promptGenerated: false,
            status: 'PENDING' as const,
            taskId: null,
            videoUrl: null,
            localPath: null,
            lastFramePath: null,
            qualityScore: null,
            retryCount: 0,
            duration: s.duration,
            cameraAngle: s.cameraAngle,
            transition: s.transition,
            narrationText: null,
            narrationAudioPath: null,
          }));

          if (options.singleScene > 0) {
            state.scenes = state.scenes.filter(
              (s) => s.sceneNumber === options.singleScene
            );
          }

          emit('NARRATIVE_PLANNING', 'stage_end', `Planned ${state.scenes.length} scenes across ${narrative.acts.length} acts (total: ${narrative.totalDuration}s)`, {
            meta: { totalScenes: state.scenes.length, totalActs: narrative.acts.length, totalDuration: narrative.totalDuration },
          });
          state.stage = 'SCENE_PROMPTING';
          break;
        }

        // ============================================================
        // STAGE 2: SCENE PROMPTING
        // ============================================================
        case 'SCENE_PROMPTING': {
          const unprompted = state.scenes.filter((s) => !s.promptGenerated);
          emit('SCENE_PROMPTING', 'stage_start', `Generating prompts for ${unprompted.length} scenes...`);

          const actNumbers = [...new Set(unprompted.map((s) => s.actNumber))].sort();

          for (const actNum of actNumbers) {
            const actScenes = unprompted.filter((s) => s.actNumber === actNum);
            emit('SCENE_PROMPTING', 'detail', `Act ${actNum}: ${actScenes.length} scenes`);

            for (const scene of actScenes) {
              emit('SCENE_PROMPTING', 'scene_update', `Generating prompt for scene ${scene.sceneNumber}: ${scene.description.slice(0, 60)}...`, {
                sceneNumber: scene.sceneNumber,
              });

              const refImage = getReferenceImageForScene(state.scenes, scene.sceneNumber);
              if (refImage) scene.lastFramePath = refImage;

              const planned = state.narrative!.scenes.find(
                (s) => s.sceneNumber === scene.sceneNumber
              )!;

              const completedScenes = state.scenes.filter((s) => s.status === 'GENERATED');

              scene.finalPrompt = await generateScenePrompt(
                planned,
                state.continuityDoc!,
                completedScenes
              );
              scene.promptGenerated = true;

              emit('SCENE_PROMPTING', 'scene_update', `Prompt ready for scene ${scene.sceneNumber} (${scene.finalPrompt.length} chars)`, {
                sceneNumber: scene.sceneNumber,
                meta: { promptLength: scene.finalPrompt.length },
              });

              state.continuityDoc = updateContinuityAfterScene(
                state.continuityDoc!,
                scene
              );

              if (scene.sceneNumber % 10 === 0) {
                saveState(state, options.stateDir);
              }
            }
          }

          emit('SCENE_PROMPTING', 'stage_end', `Generated ${unprompted.length} prompts`);

          if (options.dryRun) {
            emit('SCENE_PROMPTING', 'detail', 'DRY RUN — skipping video generation');
            const promptsFile = path.join(options.outputDir, state.id, 'prompts.json');
            fs.mkdirSync(path.dirname(promptsFile), { recursive: true });
            fs.writeFileSync(promptsFile, JSON.stringify({
              narrative: state.narrative,
              scenes: state.scenes.map((s) => ({
                sceneNumber: s.sceneNumber,
                actNumber: s.actNumber,
                description: s.description,
                finalPrompt: s.finalPrompt,
              })),
            }, null, 2));
            state.stage = 'DONE';
          } else {
            state.stage = 'VIDEO_GENERATION';
          }
          break;
        }

        // ============================================================
        // STAGE 3: VIDEO GENERATION
        // ============================================================
        case 'VIDEO_GENERATION': {
          const pendingScenes = state.scenes.filter((s) => s.status === 'PENDING');
          const totalScenes = state.scenes.length;
          const alreadyDone = state.scenes.filter((s) => s.status === 'GENERATED').length;

          emit('VIDEO_GENERATION', 'stage_start', `Generating ${pendingScenes.length} scenes (${alreadyDone}/${totalScenes} already done)...`, {
            meta: { pending: pendingScenes.length, total: totalScenes, done: alreadyDone },
          });

          const actNumbers = [...new Set(pendingScenes.map((s) => s.actNumber))].sort();

          for (const actNum of actNumbers) {
            const actPending = pendingScenes.filter((s) => s.actNumber === actNum);
            emit('VIDEO_GENERATION', 'detail', `Act ${actNum}: generating ${actPending.length} scenes...`);

            await processSceneBatch(
              actPending,
              clipsDir,
              (scene, event, meta) => {
                const type = event === 'error' ? 'error' : 'scene_update';
                emit('VIDEO_GENERATION', type, `Scene ${scene.sceneNumber}: ${event}`, {
                  sceneNumber: scene.sceneNumber,
                  meta,
                });
              },
              options.batchSize
            );

            saveState(state, options.stateDir);
            emit('VIDEO_GENERATION', 'detail', `Act ${actNum}: done. State saved.`);
          }

          const generated = state.scenes.filter((s) => s.status === 'GENERATED').length;
          const failed = state.scenes.filter((s) => s.status === 'FAILED').length;
          emit('VIDEO_GENERATION', 'stage_end', `Total: ${generated} generated, ${failed} failed out of ${totalScenes}`, {
            meta: { generated, failed, total: totalScenes },
          });

          // Skip QA for short films (< 2 min) — go straight to narration/concat
          const isShortFilm = state.brief.targetDuration <= 120;
          if (isShortFilm) {
            emit('VIDEO_GENERATION', 'detail', 'Short film — skipping quality check for speed');
            const narrationEnabled = state.brief.narration?.enabled || state.brief.subtitles?.enabled;
            state.stage = narrationEnabled ? 'NARRATION' : 'CONCATENATION';
          } else {
            state.stage = 'QUALITY_CHECK';
          }
          break;
        }

        // ============================================================
        // STAGE 4: QUALITY CHECK (only for long films)
        // ============================================================
        case 'QUALITY_CHECK': {
          emit('QUALITY_CHECK', 'stage_start', 'Analyzing video quality...');

          const toCheck = state.scenes.filter(
            (s) => s.status === 'GENERATED' && s.qualityScore === null
          );

          emit('QUALITY_CHECK', 'detail', `${toCheck.length} scenes to analyze`);

          for (const scene of toCheck) {
            if (!scene.videoUrl) continue;

            emit('QUALITY_CHECK', 'scene_update', `Scene ${scene.sceneNumber}: analyzing...`, {
              sceneNumber: scene.sceneNumber,
            });

            const qa = await analyzeVideoQuality(scene.videoUrl, scene.finalPrompt);
            scene.qualityScore = qa.qualityScore;

            if (qa.shouldRegenerate && scene.retryCount < options.maxRetries) {
              emit('QUALITY_CHECK', 'scene_update', `Scene ${scene.sceneNumber}: quality ${qa.qualityScore}/10, retrying (${scene.retryCount + 1}/${options.maxRetries})`, {
                sceneNumber: scene.sceneNumber,
                meta: { qualityScore: qa.qualityScore, issues: qa.issues },
              });

              scene.finalPrompt = await refinePrompt(
                scene.finalPrompt,
                qa.issues,
                state.continuityDoc!,
                scene.sceneNumber
              );
              scene.status = 'PENDING';
              scene.qualityScore = null;
              scene.retryCount++;
            } else {
              emit('QUALITY_CHECK', 'scene_update', `Scene ${scene.sceneNumber}: quality ${qa.qualityScore}/10 — OK`, {
                sceneNumber: scene.sceneNumber,
                meta: { qualityScore: qa.qualityScore },
              });
            }

            if (scene.sceneNumber % 10 === 0) {
              saveState(state, options.stateDir);
            }
          }

          const needsRetry = state.scenes.some((s) => s.status === 'PENDING');
          if (needsRetry) {
            const retryCount = state.scenes.filter((s) => s.status === 'PENDING').length;
            emit('QUALITY_CHECK', 'detail', `${retryCount} scenes need retry — returning to VIDEO_GENERATION`);
            state.stage = 'VIDEO_GENERATION';
          } else {
            const narrationEnabled = state.brief.narration?.enabled || state.brief.subtitles?.enabled;
            emit('QUALITY_CHECK', 'stage_end', `Quality check complete`);
            state.stage = narrationEnabled ? 'NARRATION' : 'CONCATENATION';
          }
          break;
        }

        // ============================================================
        // STAGE 5: NARRATION
        // ============================================================
        case 'NARRATION': {
          const generatedScenes = state.scenes.filter((s) => s.status === 'GENERATED');
          emit('NARRATION', 'stage_start', `Processing narration for ${generatedScenes.length} scenes...`);

          const narrationOutputDir = path.join(options.outputDir, state.id);

          if (state.brief.narration?.enabled) {
            await processNarration(
              generatedScenes,
              state.brief,
              narrationOutputDir,
              (msg) => emit('NARRATION', 'detail', msg)
            );

            const withNarration = generatedScenes.filter((s) => s.narrationAudioPath);
            emit('NARRATION', 'detail', `Generated audio for ${withNarration.length} scenes`);
          }

          if (state.brief.subtitles?.enabled) {
            if (!state.brief.narration?.enabled) {
              emit('NARRATION', 'detail', 'Generating subtitle texts...');
              const { generateNarrationTexts } = await import('./narration');
              const textsMap = await generateNarrationTexts(generatedScenes, state.brief);
              for (const scene of generatedScenes) {
                const text = textsMap.get(scene.sceneNumber);
                if (text) {
                  scene.narrationText = text;
                  emit('NARRATION', 'scene_update', `Subtitle: "${text.slice(0, 60)}..."`, {
                    sceneNumber: scene.sceneNumber,
                  });
                }
              }
            }

            const srtPath = path.join(narrationOutputDir, 'subtitles.srt');
            state.subtitlePath = generateSrtFile(generatedScenes, srtPath, {
              crossfadeDuration: 0.5,
            });
            emit('NARRATION', 'detail', `Subtitle file created: ${state.subtitlePath}`);
          }

          saveState(state, options.stateDir);
          emit('NARRATION', 'stage_end', 'Narration complete');
          state.stage = 'CONCATENATION';
          break;
        }

        // ============================================================
        // STAGE 6: CONCATENATION
        // ============================================================
        case 'CONCATENATION': {
          const validScenes = state.scenes.filter((s) => s.status === 'GENERATED');
          const totalDuration = validScenes.length * 8;
          emit('CONCATENATION', 'stage_start', `Assembling ${validScenes.length} scenes (~${Math.round(totalDuration / 60)} minutes)...`);

          const outputPath = path.join(
            options.outputDir,
            state.id,
            `${(state.narrative?.title || 'movie').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
          );

          emit('CONCATENATION', 'detail', `Concatenating ${validScenes.length} clips with crossfade...`);

          state.finalVideoPath = await concatenateMovie(
            state.scenes,
            outputPath,
            {
              crossfadeDuration: 0.5,
              soundtrackPath: state.soundtrackPath ?? undefined,
              soundtrackVolume: 0.3,
              narrationVolume: 0.9,
            }
          );

          emit('CONCATENATION', 'detail', `Movie assembled: ${state.finalVideoPath}`);

          if (state.brief.subtitles?.enabled && state.brief.subtitles.burnIn && state.subtitlePath) {
            emit('CONCATENATION', 'detail', 'Burning subtitles onto video...');
            const subtitledPath = outputPath.replace('.mp4', '_subtitled.mp4');
            burnSubtitles(
              state.finalVideoPath,
              state.subtitlePath,
              subtitledPath,
              {
                fontSize: 24,
                isRtl: state.brief.subtitles.language === 'he',
              }
            );
            fs.unlinkSync(state.finalVideoPath);
            fs.renameSync(subtitledPath, state.finalVideoPath);
            emit('CONCATENATION', 'detail', 'Subtitles burned successfully');
          }

          emit('CONCATENATION', 'stage_end', `Final movie saved: ${state.finalVideoPath}`);
          state.stage = 'DONE';
          break;
        }
      }

      saveState(state, options.stateDir);
    }
  } catch (error) {
    state.stage = 'FAILED';
    state.error = error instanceof Error ? error.message : String(error);
    saveState(state, options.stateDir);
    emit('FAILED', 'error', `Pipeline failed: ${state.error}`);
    throw error;
  }

  emit('DONE', 'stage_end', `Pipeline complete! Movie: ${state.finalVideoPath}`);
  return state.finalVideoPath!;
}
