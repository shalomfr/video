import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { MovieScene, MovieBrief } from './types';

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

// ===== OpenRouter Client =====

let _openrouter: OpenAI | null = null;
function getOpenRouter(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Movie Pipeline - Narration',
      },
    });
  }
  return _openrouter;
}

const MODEL = 'anthropic/claude-sonnet-4';

// ===== Voice Map =====

const VOICES: Record<string, string> = {
  'he-male': 'he-IL-AvriNeural',
  'he-female': 'he-IL-HilaNeural',
  'en-male': 'en-US-GuyNeural',
  'en-female': 'en-US-JennyNeural',
};

function getVoiceName(language: 'en' | 'he', customVoice?: string): string {
  if (customVoice) return customVoice;
  return VOICES[`${language}-male`];
}

// ===== Narration Text Generation =====

/**
 * Uses Gemini to generate narration text for each scene.
 * The text is short enough to fit within the scene's duration (~8 seconds).
 */
export async function generateNarrationTexts(
  scenes: MovieScene[],
  brief: MovieBrief
): Promise<Map<number, string>> {
  const language = brief.narration?.language || 'he';
  const style = brief.narration?.style || 'narrator';

  const styleInstructions: Record<string, string> = {
    narrator: 'Write as an omniscient narrator, describing actions and emotions from a third-person perspective.',
    character: 'Write as inner monologue of the main character, using first person.',
    documentary: 'Write as a documentary narrator, factual and informative.',
  };

  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a professional voice-over writer for film. Generate short narration text for each scene. Language: ${language === 'he' ? 'Hebrew' : 'English'}. Style: ${styleInstructions[style]}. Each narration MUST be under 20 words. Some scenes may not need narration — set text to empty string. Output JSON only.`,
      },
      {
        role: 'user',
        content: `Movie: "${brief.title}"\n\nScenes:\n${scenes.map((s) => `Scene ${s.sceneNumber}: ${s.description}`).join('\n')}\n\nReturn JSON: { "narrations": [{ "sceneNumber": 1, "text": "..." }, ...] }`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response for narration texts');

  const parsed = JSON.parse(extractJSON(content)) as {
    narrations: { sceneNumber: number; text: string }[];
  };

  const map = new Map<number, string>();
  for (const item of parsed.narrations) {
    if (item.text) {
      map.set(item.sceneNumber, item.text);
    }
  }
  return map;
}

// ===== TTS Audio Generation =====

/**
 * Converts narration text to audio using Microsoft Edge TTS.
 * Free, no API key needed, supports Hebrew and English.
 */
export async function generateNarrationAudio(
  text: string,
  outputPath: string,
  options: {
    language?: 'en' | 'he';
    voice?: string;
    rate?: string;
  } = {}
): Promise<string> {
  const voiceName = getVoiceName(options.language || 'he', options.voice);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  // Generate speech — msedge-tts returns { audioStream, metadataStream }
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];

  return new Promise<string>((resolve, reject) => {
    audioStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    audioStream.on('end', () => {
      const audioBuffer = Buffer.concat(chunks);
      fs.writeFileSync(outputPath, audioBuffer);
      resolve(outputPath);
    });

    audioStream.on('error', (err: Error) => {
      reject(new Error(`TTS failed: ${err.message}`));
    });
  });
}

// ===== Get Audio Duration =====

/**
 * Gets the duration of an audio file using FFprobe.
 */
export function getAudioDuration(audioPath: string): number {
  const { execSync } = require('child_process');
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
    { encoding: 'utf-8' }
  );
  return parseFloat(output.trim());
}

// ===== Process All Scenes =====

/**
 * Generates narration text and audio for all scenes.
 * If narration audio is longer than scene duration, speeds it up with FFmpeg.
 */
export async function processNarration(
  scenes: MovieScene[],
  brief: MovieBrief,
  outputDir: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const language = brief.narration?.language || 'he';
  const voice = brief.narration?.voice;

  // Step 1: Generate narration texts with Gemini
  onProgress?.('Generating narration texts...');
  const narrationMap = await generateNarrationTexts(scenes, brief);

  onProgress?.(`Generated narration for ${narrationMap.size} of ${scenes.length} scenes`);

  // Step 2: Convert each to audio
  const narrationDir = path.join(outputDir, 'narration');
  fs.mkdirSync(narrationDir, { recursive: true });

  for (const scene of scenes) {
    const text = narrationMap.get(scene.sceneNumber);
    if (!text) continue;

    scene.narrationText = text;
    const audioPath = path.join(
      narrationDir,
      `narration_${String(scene.sceneNumber).padStart(3, '0')}.mp3`
    );

    onProgress?.(`  Scene ${scene.sceneNumber}: generating audio...`);

    try {
      await generateNarrationAudio(text, audioPath, { language, voice });

      // Check if audio fits within scene duration
      const audioDuration = getAudioDuration(audioPath);
      const maxDuration = scene.duration - 0.5; // leave 0.5s padding

      if (audioDuration > maxDuration && maxDuration > 0) {
        // Speed up audio to fit
        const speedFactor = audioDuration / maxDuration;
        const speedAudioPath = audioPath.replace('.mp3', '_speed.mp3');
        const { execSync } = require('child_process');
        execSync(
          `ffmpeg -i "${audioPath}" -filter:a "atempo=${Math.min(speedFactor, 2.0)}" -y "${speedAudioPath}"`,
          { stdio: 'pipe' }
        );
        fs.renameSync(speedAudioPath, audioPath);
        onProgress?.(`  Scene ${scene.sceneNumber}: sped up ${speedFactor.toFixed(1)}x to fit`);
      }

      scene.narrationAudioPath = audioPath;
      onProgress?.(`  Scene ${scene.sceneNumber}: done`);
    } catch (err) {
      onProgress?.(`  Scene ${scene.sceneNumber}: TTS failed — ${err}`);
    }
  }
}
