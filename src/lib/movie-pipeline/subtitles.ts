import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { MovieScene } from './types';

// ===== SRT Generation =====

interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * Formats seconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Generates an SRT subtitle file from scene narration texts.
 * Each scene's narration is shown for the duration of the scene.
 */
export function generateSrtFile(
  scenes: MovieScene[],
  outputPath: string,
  options: {
    crossfadeDuration?: number;
    displayPadding?: number; // seconds before/after to show subtitle
  } = {}
): string {
  const {
    crossfadeDuration = 0.5,
    displayPadding = 0.3,
  } = options;

  const entries: SrtEntry[] = [];
  let currentTime = 0;
  let index = 1;

  for (const scene of scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)) {
    if (scene.narrationText) {
      // Split long text into lines (max 42 chars per line for readability)
      const lines = splitSubtitleText(scene.narrationText, 42);

      const startTime = currentTime + displayPadding;
      const endTime = currentTime + scene.duration - displayPadding;

      if (endTime > startTime) {
        entries.push({
          index,
          startTime: formatSrtTime(startTime),
          endTime: formatSrtTime(endTime),
          text: lines.join('\n'),
        });
        index++;
      }
    }

    // Advance time — account for crossfade overlap
    currentTime += scene.duration - crossfadeDuration;
  }

  // Write SRT file
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const srtContent = entries
    .map((e) => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}\n`)
    .join('\n');

  fs.writeFileSync(outputPath, '\ufeff' + srtContent, 'utf-8'); // BOM for Hebrew support
  return outputPath;
}

/**
 * Splits text into lines that fit within a max character width.
 * Respects word boundaries.
 */
function splitSubtitleText(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// ===== Subtitle Burning =====

/**
 * Burns SRT subtitles onto a video using FFmpeg.
 * Supports Hebrew (RTL) with proper font configuration.
 */
export function burnSubtitles(
  videoPath: string,
  srtPath: string,
  outputPath: string,
  options: {
    fontSize?: number;
    fontColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
    position?: 'bottom' | 'top';
    isRtl?: boolean;
  } = {}
): string {
  const {
    fontSize = 24,
    fontColor = '&HFFFFFF',
    outlineColor = '&H000000',
    outlineWidth = 2,
    position = 'bottom',
    isRtl = false,
  } = options;

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  // Build ASS style override for better Hebrew support
  const alignment = position === 'bottom' ? 2 : 8; // SSA alignment: 2=bottom-center, 8=top-center
  const marginV = 30;

  // Escape path for FFmpeg filter (Windows backslashes)
  const escapedSrtPath = srtPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:');

  const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=${fontColor},OutlineColour=${outlineColor},Outline=${outlineWidth},Alignment=${alignment},MarginV=${marginV}'`;

  execSync(
    `ffmpeg -i "${videoPath}" ` +
    `-vf "${subtitleFilter}" ` +
    `-c:v libx264 -preset fast -crf 18 ` +
    `-c:a copy ` +
    `-y "${outputPath}"`,
    { stdio: 'pipe' }
  );

  return outputPath;
}
