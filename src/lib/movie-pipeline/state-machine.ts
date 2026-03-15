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

const DEFAULT_OPTIONS: Required<PipelineOptions> = {
  dryRun: false,
  singleScene: -1,
  batchSize: 3,
  maxRetries: 3,
  videoModel: 'veo',
  outputDir: './output',
  stateDir: './output/state',
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

// ===== Logging =====

function log(stage: PipelineStage, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [${stage}] ${message}`);
}

// ===== Narrative Planning Strategies =====

/**
 * For short/medium films (< 5 min): plan everything at once.
 */
async function planShortMovie(brief: MovieBrief): Promise<NarrativePlan> {
  return await planFullMovie(brief);
}

/**
 * For feature-length films (> 5 min): plan outline first, then each act separately.
 * This avoids hitting context limits and produces better detail per scene.
 */
async function planLongMovie(
  brief: MovieBrief,
  onProgress?: (message: string) => void
): Promise<NarrativePlan> {
  // Step 1: High-level outline
  onProgress?.('Creating movie outline...');
  const outline = await planMovieOutline(brief);

  // Step 2: Plan each act's scenes in detail
  const allScenes: NarrativePlan['scenes'] = [];
  let sceneOffset = 0;

  for (const act of outline.acts) {
    onProgress?.(`Planning Act ${act.actNumber}: "${act.title}" (${act.sceneCount} scenes)...`);

    const actScenes = await planActScenes(brief, outline, act);

    // Renumber scenes globally
    for (const scene of actScenes) {
      scene.sceneNumber = sceneOffset + scene.sceneNumber;
      allScenes.push(scene);
    }
    sceneOffset += actScenes.length;
  }

  // Combine into final narrative plan
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

/**
 * The core movie generation loop.
 * A state machine that progresses through stages, persisting state after each step.
 * Supports any duration from 30 seconds to 90+ minutes.
 */
export async function runMoviePipeline(
  briefOrStatePath: MovieBrief | string,
  opts: PipelineOptions = {}
): Promise<string> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // Initialize or resume state
  let state: MovieState;
  if (typeof briefOrStatePath === 'string') {
    const loaded = loadState(briefOrStatePath);
    if (!loaded) throw new Error(`Cannot resume: state file not found at ${briefOrStatePath}`);
    state = loaded;
    log(state.stage, `Resuming pipeline from stage: ${state.stage}`);
  } else {
    state = createInitialState(briefOrStatePath);
    log('NARRATIVE_PLANNING', `Starting new movie pipeline: ${state.id}`);
  }

  const clipsDir = path.join(options.outputDir, state.id, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });

  try {
    while (state.stage !== 'DONE' && state.stage !== 'FAILED') {
      switch (state.stage) {

        // ============================================================
        // STAGE 1: NARRATIVE PLANNING
        // Claude plans the movie — short films at once, long films act-by-act
        // ============================================================
        case 'NARRATIVE_PLANNING': {
          const duration = state.brief.targetDuration;
          const isLong = duration > LONG_MOVIE_THRESHOLD;
          const sceneEstimate = Math.ceil(duration / 8);

          log('NARRATIVE_PLANNING', `Planning ${isLong ? 'feature-length' : 'short'} movie (${duration}s, ~${sceneEstimate} scenes)...`);

          let narrative: NarrativePlan;
          if (isLong) {
            narrative = await planLongMovie(state.brief, (msg) =>
              log('NARRATIVE_PLANNING', msg)
            );
          } else {
            narrative = await planShortMovie(state.brief);
          }

          state.narrative = narrative;
          state.continuityDoc = buildContinuityDocument(narrative);

          // Convert planned scenes to runtime MovieScenes
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

          // Filter to single scene if requested
          if (options.singleScene > 0) {
            state.scenes = state.scenes.filter(
              (s) => s.sceneNumber === options.singleScene
            );
          }

          log('NARRATIVE_PLANNING', `Planned ${state.scenes.length} scenes across ${narrative.acts.length} acts (total: ${narrative.totalDuration}s)`);
          state.stage = 'SCENE_PROMPTING';
          break;
        }

        // ============================================================
        // STAGE 2: SCENE PROMPTING
        // Claude generates detailed video prompts for each scene.
        // For long movies, processes act-by-act to manage context.
        // ============================================================
        case 'SCENE_PROMPTING': {
          const unprompted = state.scenes.filter((s) => !s.promptGenerated);
          log('SCENE_PROMPTING', `Generating prompts for ${unprompted.length} scenes...`);

          // Process act by act for better context management
          const actNumbers = [...new Set(unprompted.map((s) => s.actNumber))].sort();

          for (const actNum of actNumbers) {
            const actScenes = unprompted.filter((s) => s.actNumber === actNum);
            log('SCENE_PROMPTING', `  Act ${actNum}: ${actScenes.length} scenes`);

            for (const scene of actScenes) {
              log('SCENE_PROMPTING', `    Scene ${scene.sceneNumber}: ${scene.description.slice(0, 50)}...`);

              // Get reference image from previous scene for continuity
              const refImage = getReferenceImageForScene(state.scenes, scene.sceneNumber);
              if (refImage) {
                scene.lastFramePath = refImage;
              }

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

              // Update continuity document
              state.continuityDoc = updateContinuityAfterScene(
                state.continuityDoc!,
                scene
              );

              // Save state periodically (every 10 scenes) for long movies
              if (scene.sceneNumber % 10 === 0) {
                saveState(state, options.stateDir);
              }
            }
          }

          log('SCENE_PROMPTING', `Generated ${unprompted.length} prompts`);

          if (options.dryRun) {
            log('SCENE_PROMPTING', 'DRY RUN — skipping video generation');
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
        // Submit prompts to Runway/Veo, poll, download clips.
        // For long movies, processes act-by-act with state saves.
        // ============================================================
        case 'VIDEO_GENERATION': {
          const pendingScenes = state.scenes.filter((s) => s.status === 'PENDING');
          const totalScenes = state.scenes.length;
          const alreadyDone = state.scenes.filter((s) => s.status === 'GENERATED').length;

          log('VIDEO_GENERATION', `Generating ${pendingScenes.length} scenes (${alreadyDone}/${totalScenes} already done)...`);

          // Process act by act — save state between acts for resume safety
          const actNumbers = [...new Set(pendingScenes.map((s) => s.actNumber))].sort();

          for (const actNum of actNumbers) {
            const actPending = pendingScenes.filter((s) => s.actNumber === actNum);
            log('VIDEO_GENERATION', `  Act ${actNum}: generating ${actPending.length} scenes...`);

            await processSceneBatch(
              actPending,
              clipsDir,
              (scene, event) => {
                log('VIDEO_GENERATION', `    Scene ${scene.sceneNumber}: ${event}`);
              }
            );

            // Save state after each act completes
            saveState(state, options.stateDir);
            log('VIDEO_GENERATION', `  Act ${actNum}: done. State saved.`);
          }

          const generated = state.scenes.filter((s) => s.status === 'GENERATED').length;
          const failed = state.scenes.filter((s) => s.status === 'FAILED').length;
          log('VIDEO_GENERATION', `Total: ${generated} generated, ${failed} failed out of ${totalScenes}`);

          state.stage = 'QUALITY_CHECK';
          break;
        }

        // ============================================================
        // STAGE 4: QUALITY CHECK
        // Gemini analyzes each clip, retries if needed
        // ============================================================
        case 'QUALITY_CHECK': {
          log('QUALITY_CHECK', 'Analyzing video quality...');

          const toCheck = state.scenes.filter(
            (s) => s.status === 'GENERATED' && s.qualityScore === null
          );

          log('QUALITY_CHECK', `${toCheck.length} scenes to analyze`);

          for (const scene of toCheck) {
            if (!scene.videoUrl) continue;

            log('QUALITY_CHECK', `  Scene ${scene.sceneNumber}: analyzing...`);
            const qa = await analyzeVideoQuality(scene.videoUrl, scene.finalPrompt);
            scene.qualityScore = qa.qualityScore;

            if (qa.shouldRegenerate && scene.retryCount < options.maxRetries) {
              log('QUALITY_CHECK', `  Scene ${scene.sceneNumber}: quality ${qa.qualityScore}/10, retrying (${scene.retryCount + 1}/${options.maxRetries})`);
              log('QUALITY_CHECK', `    Issues: ${qa.issues.join(', ')}`);

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
              log('QUALITY_CHECK', `  Scene ${scene.sceneNumber}: quality ${qa.qualityScore}/10 — OK`);
            }

            // Save periodically
            if (scene.sceneNumber % 10 === 0) {
              saveState(state, options.stateDir);
            }
          }

          // If any scenes need retry, go back to generation
          const needsRetry = state.scenes.some((s) => s.status === 'PENDING');
          if (needsRetry) {
            const retryCount = state.scenes.filter((s) => s.status === 'PENDING').length;
            log('QUALITY_CHECK', `${retryCount} scenes need retry — returning to VIDEO_GENERATION`);
            state.stage = 'VIDEO_GENERATION';
          } else {
            // Go to narration if enabled, otherwise skip to concatenation
            const narrationEnabled = state.brief.narration?.enabled || state.brief.subtitles?.enabled;
            state.stage = narrationEnabled ? 'NARRATION' : 'CONCATENATION';
          }
          break;
        }

        // ============================================================
        // STAGE 5: NARRATION
        // Generate voice-over audio and subtitle files
        // ============================================================
        case 'NARRATION': {
          const generatedScenes = state.scenes.filter((s) => s.status === 'GENERATED');
          log('NARRATION', `Processing narration for ${generatedScenes.length} scenes...`);

          const narrationOutputDir = path.join(options.outputDir, state.id);

          // Generate narration audio if enabled
          if (state.brief.narration?.enabled) {
            await processNarration(
              generatedScenes,
              state.brief,
              narrationOutputDir,
              (msg) => log('NARRATION', msg)
            );

            const withNarration = generatedScenes.filter((s) => s.narrationAudioPath);
            log('NARRATION', `Generated audio for ${withNarration.length} scenes`);
          }

          // Generate subtitles if enabled (uses narration texts)
          if (state.brief.subtitles?.enabled) {
            // If no narration was generated, generate texts only for subtitles
            if (!state.brief.narration?.enabled) {
              const { generateNarrationTexts } = await import('./narration');
              const textsMap = await generateNarrationTexts(generatedScenes, state.brief);
              for (const scene of generatedScenes) {
                const text = textsMap.get(scene.sceneNumber);
                if (text) scene.narrationText = text;
              }
            }

            const srtPath = path.join(narrationOutputDir, 'subtitles.srt');
            state.subtitlePath = generateSrtFile(generatedScenes, srtPath, {
              crossfadeDuration: 0.5,
            });
            log('NARRATION', `Subtitle file created: ${state.subtitlePath}`);
          }

          saveState(state, options.stateDir);
          state.stage = 'CONCATENATION';
          break;
        }

        // ============================================================
        // STAGE 6: CONCATENATION
        // FFmpeg combines all clips with transitions and soundtrack
        // ============================================================
        case 'CONCATENATION': {
          const validScenes = state.scenes.filter((s) => s.status === 'GENERATED');
          const totalDuration = validScenes.length * 8;
          log('CONCATENATION', `Assembling ${validScenes.length} scenes (~${Math.round(totalDuration / 60)} minutes)...`);

          const outputPath = path.join(
            options.outputDir,
            state.id,
            `${(state.narrative?.title || 'movie').replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
          );

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

          log('CONCATENATION', `Movie assembled: ${state.finalVideoPath}`);

          // Burn subtitles if enabled with burnIn option
          if (state.brief.subtitles?.enabled && state.brief.subtitles.burnIn && state.subtitlePath) {
            log('CONCATENATION', 'Burning subtitles onto video...');
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
            // Replace final video with subtitled version
            fs.unlinkSync(state.finalVideoPath);
            fs.renameSync(subtitledPath, state.finalVideoPath);
            log('CONCATENATION', 'Subtitles burned successfully');
          }

          log('CONCATENATION', `Final movie saved: ${state.finalVideoPath}`);
          state.stage = 'DONE';
          break;
        }
      }

      // Persist state after every stage transition
      saveState(state, options.stateDir);
    }
  } catch (error) {
    state.stage = 'FAILED';
    state.error = error instanceof Error ? error.message : String(error);
    saveState(state, options.stateDir);
    log('FAILED', `Pipeline failed: ${state.error}`);
    throw error;
  }

  log('DONE', `Pipeline complete! Movie: ${state.finalVideoPath}`);
  return state.finalVideoPath!;
}
