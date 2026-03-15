import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { MovieScene } from './types';

interface ConcatenateOptions {
  crossfadeDuration?: number; // seconds, default 0.5
  soundtrackPath?: string;
  soundtrackVolume?: number;  // 0-1, default 0.3
  narrationVolume?: number;   // 0-1, default 0.9
  outputResolution?: string;  // default '1280:720'
}

/**
 * Concatenates all scene clips into a final movie using FFmpeg.
 * Supports crossfade transitions and soundtrack mixing.
 */
export async function concatenateMovie(
  scenes: MovieScene[],
  outputPath: string,
  options: ConcatenateOptions = {}
): Promise<string> {
  const {
    crossfadeDuration = 0.5,
    soundtrackPath,
    soundtrackVolume = 0.3,
    outputResolution = '1280:720',
  } = options;

  const sortedScenes = scenes
    .filter((s) => s.localPath && fs.existsSync(s.localPath))
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (sortedScenes.length === 0) {
    throw new Error('No valid scene clips found for concatenation');
  }

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // Single clip — just copy
  if (sortedScenes.length === 1) {
    fs.copyFileSync(sortedScenes[0].localPath!, outputPath);
    return outputPath;
  }

  // Step 1: Normalize all clips (same resolution, codec, framerate)
  const normalizedDir = path.join(outputDir, 'normalized');
  fs.mkdirSync(normalizedDir, { recursive: true });

  const normalizedPaths: string[] = [];
  for (const scene of sortedScenes) {
    const normPath = path.join(
      normalizedDir,
      `norm_${String(scene.sceneNumber).padStart(3, '0')}.mp4`
    );
    execSync(
      `ffmpeg -i "${scene.localPath}" ` +
      `-vf "scale=${outputResolution}:force_original_aspect_ratio=decrease,pad=${outputResolution}:(ow-iw)/2:(oh-ih)/2" ` +
      `-r 30 -c:v libx264 -preset fast -crf 18 ` +
      `-c:a aac -ar 44100 -ac 2 ` +
      `-y "${normPath}"`,
      { stdio: 'pipe' }
    );
    normalizedPaths.push(normPath);
  }

  // Step 2: Concatenate with crossfade transitions
  let resultPath: string;

  if (crossfadeDuration > 0) {
    resultPath = concatenateWithCrossfade(
      normalizedPaths,
      outputDir,
      crossfadeDuration
    );
  } else {
    resultPath = concatenateSimple(normalizedPaths, outputDir);
  }

  // Step 3: Mix in narration audio tracks
  const narrationVolume = options.narrationVolume ?? 0.9;
  const scenesWithNarration = sortedScenes.filter(
    (s) => s.narrationAudioPath && fs.existsSync(s.narrationAudioPath!)
  );

  if (scenesWithNarration.length > 0) {
    // Create a combined narration track with correct timing
    const narrationListFile = path.join(outputDir, 'narration_list.txt');
    let narrationContent = '';
    let currentTime = 0;

    for (const scene of sortedScenes) {
      const hasNarration = scene.narrationAudioPath && fs.existsSync(scene.narrationAudioPath);
      if (hasNarration) {
        // Create a silent padding + narration audio at the right timestamp
        narrationContent += `file '${scene.narrationAudioPath!.replace(/\\/g, '/')}'\n`;
      }
      currentTime += scene.duration - (crossfadeDuration > 0 ? crossfadeDuration : 0);
    }

    // Mix narration into the video
    // Use adelay to position each narration at the correct time
    const narrationInputs: string[] = [];
    const narrationFilters: string[] = [];
    let inputIndex = 1; // 0 is the video

    let narrationCmd = `ffmpeg -i "${resultPath}"`;
    let filterParts: string[] = [];
    let narrationTime = 0;

    for (const scene of sortedScenes) {
      if (scene.narrationAudioPath && fs.existsSync(scene.narrationAudioPath)) {
        narrationCmd += ` -i "${scene.narrationAudioPath}"`;
        const delayMs = Math.round(narrationTime * 1000);
        filterParts.push(
          `[${inputIndex}:a]volume=${narrationVolume},adelay=${delayMs}|${delayMs}[nar${inputIndex}]`
        );
        inputIndex++;
      }
      narrationTime += scene.duration - (crossfadeDuration > 0 ? crossfadeDuration : 0);
    }

    if (filterParts.length > 0) {
      // Mix all narration tracks with the original audio
      const narLabels = filterParts.map((_, i) => `[nar${i + 1}]`).join('');
      const mixFilter = `[0:a]${narLabels}amix=inputs=${filterParts.length + 1}:duration=first:dropout_transition=0[aout]`;
      const fullFilter = filterParts.join(';') + ';' + mixFilter;

      const withNarrationPath = path.join(outputDir, 'movie_with_narration.mp4');
      narrationCmd += ` -filter_complex "${fullFilter}" -map 0:v -map "[aout]" -c:v copy -c:a aac -y "${withNarrationPath}"`;

      execSync(narrationCmd, { stdio: 'pipe' });
      resultPath = withNarrationPath;
    }
  }

  // Step 4: Mix in soundtrack if provided
  if (soundtrackPath && fs.existsSync(soundtrackPath)) {
    const withAudioPath = path.join(outputDir, 'movie_with_audio.mp4');
    execSync(
      `ffmpeg -i "${resultPath}" -i "${soundtrackPath}" ` +
      `-filter_complex "[1:a]volume=${soundtrackVolume}[bg];[0:a][bg]amix=inputs=2:duration=first[aout]" ` +
      `-map 0:v -map "[aout]" ` +
      `-c:v copy -c:a aac -shortest ` +
      `-y "${withAudioPath}"`,
      { stdio: 'pipe' }
    );
    resultPath = withAudioPath;
  }

  // Step 4: Move to final output path
  if (resultPath !== outputPath) {
    fs.copyFileSync(resultPath, outputPath);
  }

  // Cleanup normalized files
  try {
    fs.rmSync(normalizedDir, { recursive: true });
  } catch {
    // Non-critical cleanup failure
  }

  return outputPath;
}

/**
 * Simple concatenation without transitions (faster).
 */
function concatenateSimple(
  clipPaths: string[],
  outputDir: string
): string {
  const listFile = path.join(outputDir, 'concat_list.txt');
  const content = clipPaths
    .map((p) => `file '${p.replace(/\\/g, '/')}'`)
    .join('\n');
  fs.writeFileSync(listFile, content);

  const outputPath = path.join(outputDir, 'movie_concat.mp4');
  execSync(
    `ffmpeg -f concat -safe 0 -i "${listFile}" ` +
    `-c copy -y "${outputPath}"`,
    { stdio: 'pipe' }
  );

  fs.unlinkSync(listFile);
  return outputPath;
}

/**
 * Concatenation with crossfade transitions between clips.
 */
function concatenateWithCrossfade(
  clipPaths: string[],
  outputDir: string,
  crossfadeDuration: number
): string {
  // For crossfade we need to chain xfade filters
  // FFmpeg xfade: [0:v][1:v]xfade=transition=fade:duration=D:offset=O[v01]
  // Each offset = previous_offset + clip_duration - crossfade_duration

  // Get durations of each clip
  const durations = clipPaths.map((p) => getClipDuration(p));

  // Build input arguments
  const inputs = clipPaths.map((p) => `-i "${p}"`).join(' ');

  // Build xfade filter chain
  const filterParts: string[] = [];
  let currentOffset = durations[0] - crossfadeDuration;

  for (let i = 0; i < clipPaths.length - 1; i++) {
    const inputA = i === 0 ? `[${i}:v]` : `[v${i - 1}${i}]`;
    const inputB = `[${i + 1}:v]`;
    const outputLabel = i === clipPaths.length - 2 ? '[vout]' : `[v${i}${i + 1}]`;

    filterParts.push(
      `${inputA}${inputB}xfade=transition=fade:duration=${crossfadeDuration}:offset=${currentOffset}${outputLabel}`
    );

    if (i < clipPaths.length - 2) {
      currentOffset += durations[i + 1] - crossfadeDuration;
    }
  }

  const filterComplex = filterParts.join(';');
  const outputPath = path.join(outputDir, 'movie_crossfade.mp4');

  execSync(
    `ffmpeg ${inputs} ` +
    `-filter_complex "${filterComplex}" ` +
    `-map "[vout]" -c:v libx264 -preset fast -crf 18 ` +
    `-y "${outputPath}"`,
    { stdio: 'pipe' }
  );

  return outputPath;
}

/**
 * Gets the duration of a video clip in seconds.
 */
function getClipDuration(filePath: string): number {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { encoding: 'utf-8' }
  );
  return parseFloat(output.trim());
}
