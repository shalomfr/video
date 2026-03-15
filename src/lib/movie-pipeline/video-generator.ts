import {
  generateVideoFromText as veoFromText,
  generateVideoFromImage as veoFromImage,
  type PollProgressCallback,
} from '../google-ai';
import type { MovieScene } from './types';
import fs from 'fs';
import path from 'path';

// ===== Configuration =====
const DEFAULT_BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 1000;

// ===== Video Generation =====

async function generateSceneVideo(
  scene: MovieScene,
  outputDir: string,
  onPollProgress?: PollProgressCallback
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
    }, onPollProgress);
  } else {
    return await veoFromText(scene.finalPrompt, outputPath, {
      resolution: '720p',
      aspectRatio: '16:9',
    }, onPollProgress);
  }
}

// ===== Batch Processing =====

export async function processSceneBatch(
  scenes: MovieScene[],
  outputDir: string,
  onProgress?: (scene: MovieScene, event: string, meta?: Record<string, unknown>) => void,
  batchSize?: number
): Promise<MovieScene[]> {
  const size = batchSize || DEFAULT_BATCH_SIZE;
  const batches = chunk(scenes, size);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    const promises = batch.map(async (scene) => {
      try {
        onProgress?.(scene, 'submitting');
        scene.status = 'PROCESSING';

        const pollCb: PollProgressCallback = (attempt, max, status) => {
          if (status.startsWith('SUBMITTED:')) {
            const taskId = status.replace('SUBMITTED:', '');
            scene.taskId = taskId;
            onProgress?.(scene, 'submitted', { taskId });
          } else if (status === 'DOWNLOADING') {
            onProgress?.(scene, 'downloading');
          } else if (status.startsWith('DOWNLOADED:')) {
            onProgress?.(scene, 'downloaded', { size: status.replace('DOWNLOADED:', '') });
          } else {
            onProgress?.(scene, 'polling', { attempt, maxAttempts: max, status });
          }
        };

        scene.localPath = await generateSceneVideo(scene, outputDir, pollCb);

        // Extract last frame for continuity
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

    // Short delay between batches
    if (batchIdx < batches.length - 1) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  return scenes;
}

// ===== Frame Extraction =====

export async function extractLastFrame(
  videoPath: string,
  outputDir: string,
  sceneNumber: number
): Promise<string> {
  const framePath = path.join(
    outputDir,
    `scene_${String(sceneNumber).padStart(3, '0')}_lastframe.png`
  );

  const { execSync } = await import('child_process');
  try {
    execSync(
      `ffmpeg -sseof -0.1 -i "${videoPath}" -frames:v 1 -y "${framePath}"`,
      { stdio: 'pipe' }
    );
  } catch {
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
