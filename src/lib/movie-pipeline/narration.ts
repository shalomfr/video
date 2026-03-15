import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import type { MovieScene, MovieBrief } from './types';

// ===== Gemini Client =====

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error('GOOGLE_AI_API_KEY is not configured');
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

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
  const model = getGemini().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const language = brief.narration?.language || 'he';
  const style = brief.narration?.style || 'narrator';

  const styleInstructions: Record<string, string> = {
    narrator: 'Write as an omniscient narrator, describing actions and emotions from a third-person perspective.',
    character: 'Write as inner monologue of the main character, using first person.',
    documentary: 'Write as a documentary narrator, factual and informative.',
  };

  const prompt = `You are a professional voice-over writer for film.
Generate short narration text for each scene of the movie "${brief.title}".

Rules:
- Language: ${language === 'he' ? 'Hebrew' : 'English'}
- Style: ${styleInstructions[style]}
- Each narration MUST be under 20 words (must fit in 8 seconds when spoken)
- Be evocative and cinematic — every word counts
- Some scenes may not need narration — set text to empty string "" for those
- Narration should complement the visuals, not describe them literally

Scenes:
${scenes.map((s) => `Scene ${s.sceneNumber}: ${s.description}`).join('\n')}

Return JSON:
{
  "narrations": [
    { "sceneNumber": 1, "text": "narration text here" },
    ...
  ]
}`;

  const result = await model.generateContent(prompt);
  const content = result.response.text();
  const cleanText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleanText) as {
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
