import {
  generateVideoFromText as veoFromText,
  generateVideoFromImage as veoFromImage,
} from '../google-ai';
import type { MovieScene } from './types';
import fs from 'fs';
import path from 'path';

// ===== Configuration =====
// Veo 3.1 has rate limits — process 2 at a time max
const BATCH_SIZE = 2;

// ===== Video Generation =====

/**
 * Generates video for a scene using Google Veo 3.1.
 * Uses image-to-video if a reference image exists (for continuity),
 * otherwise uses text-to-video.
 * Veo handles polling internally — returns when video is ready.
 */
async function generateSceneVideo(
  scene: MovieScene,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(
    outputDir,
    `scene_${String(scene.sceneNumber).padStart(3, '0')}.mp4`
  );
  fs.mkdirSync(outputDir, { recursive: true });

  if (scene.lastFramePath && fs.existsSync(scene.lastFramePath)) {
    return await veoFromImage(scene.finalPrompt, scene.lastFramePath, outputPath, {
      resolution: '720p',
      aspectRatio: '16:9',
    });
  } else {
    return await veoFromText(scene.finalPrompt, outputPath, {
      resolution: '720p',
      aspectRatio: '16:9',
    });
  }
}

// ===== Batch Processing =====

/**
 * Processes scenes in batches — generates videos and extracts frames.
 * Veo 3.1 saves directly to disk, no separate download needed.
 */
export async function processSceneBatch(
  scenes: MovieScene[],
  outputDir: string,
  onProgress?: (scene: MovieScene, event: string) => void
): Promise<MovieScene[]> {
  const batches = chunk(scenes, BATCH_SIZE);

  for (const batch of batches) {
    // Generate scenes in batch concurrently
    const promises = batch.map(async (scene) => {
      try {
        onProgress?.(scene, 'generating');
        scene.status = 'PROCESSING';

        // Veo saves directly to disk — returns the local path
        scene.localPath = await generateSceneVideo(scene, outputDir);

        // Extract last frame for continuity with next scene
        scene.lastFramePath = await extractLastFrame(
          scene.localPath,
          outputDir,
          scene.sceneNumber
        );

        scene.status = 'GENERATED';
        onProgress?.(scene, 'generated');
      } catch (err) {
        scene.status = 'FAILED';
        onProgress?.(scene, `error: ${err}`);
      }
    });

    await Promise.all(promises);

    // Delay between batches to respect Veo rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await sleep(5000);
    }
  }

  return scenes;
}

// ===== Frame Extraction =====

/**
 * Extracts the last frame from a video clip using FFmpeg.
 * This frame is used as reference image for the next scene (continuity).
 */
export async function extractLastFrame(
  videoPath: string,
  outputDir: string,
  sceneNumber: number
): Promise<string> {
  const framePath = path.join(
    outputDir,
    `scene_${String(sceneNumber).padStart(3, '0')}_lastframe.png`
  );

  // Use FFmpeg to extract last frame
  const { execSync } = await import('child_process');
  try {
    execSync(
      `ffmpeg -sseof -0.1 -i "${videoPath}" -frames:v 1 -y "${framePath}"`,
      { stdio: 'pipe' }
    );
  } catch {
    // Fallback: extract frame at 90% of duration
    execSync(
      `ffmpeg -i "${videoPath}" -vf "select=eq(n\\,0)" -frames:v 1 -y "${framePath}"`,
      { stdio: 'pipe' }
    );
  }

  return framePath;
}

// ===== Utilities =====

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
