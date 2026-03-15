#!/usr/bin/env tsx
/**
 * CLI entry point for the movie generation pipeline.
 *
 * Usage:
 *   npx tsx src/scripts/run-movie.ts --brief ./movie-brief.json
 *   npx tsx src/scripts/run-movie.ts --resume ./output/state/movie-state-abc.json
 *   npx tsx src/scripts/run-movie.ts --brief ./brief.json --dry-run
 *   npx tsx src/scripts/run-movie.ts --brief ./brief.json --scene 3
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local for API keys
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
import { runMoviePipeline } from '../lib/movie-pipeline/state-machine';
import type { MovieBrief, PipelineOptions } from '../lib/movie-pipeline/types';

// ===== Parse CLI Arguments =====
function parseArgs(): {
  briefPath?: string;
  resumePath?: string;
  options: PipelineOptions;
} {
  const args = process.argv.slice(2);
  let briefPath: string | undefined;
  let resumePath: string | undefined;
  const options: PipelineOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--brief':
        briefPath = args[++i];
        break;
      case '--resume':
        resumePath = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--scene':
        options.singleScene = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--max-retries':
        options.maxRetries = parseInt(args[++i], 10);
        break;
      case '--model':
        options.videoModel = args[++i] as 'veo';
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return { briefPath, resumePath, options };
}

function printHelp(): void {
  console.log(`
Movie Generation Pipeline
=========================

Usage:
  npx tsx src/scripts/run-movie.ts [options]

Options:
  --brief <path>       Path to movie brief JSON file (required for new runs)
  --resume <path>      Path to state file to resume an interrupted run
  --dry-run            Plan only, no video generation (saves prompts to disk)
  --scene <number>     Generate only a single scene (for testing)
  --batch-size <n>     Number of scenes to generate in parallel (default: 3)
  --max-retries <n>    Max QA retry attempts per scene (default: 3)
  --model <name>       Video model: "veo" (default: veo)
  --output <dir>       Output directory (default: ./output)
  --help               Show this help message

Example brief.json:
  {
    "title": "The Last Sunset",
    "genre": "drama",
    "description": "A fisherman's journey home through a Mediterranean village",
    "mood": "warm, nostalgic, hopeful",
    "targetDuration": 120,
    "visualStyle": "cinematic, warm tones, golden hour",
    "colorPalette": ["#D4A574", "#2C3E50", "#E74C3C"],
    "characters": [
      {
        "name": "Marco",
        "description": "35-year-old fisherman, tanned skin, kind eyes",
        "role": "protagonist"
      }
    ],
    "locations": ["harbor", "village streets", "market square", "hilltop"]
  }
`);
}

// ===== Main =====
async function main(): Promise<void> {
  const { briefPath, resumePath, options } = parseArgs();

  if (!briefPath && !resumePath) {
    console.error('Error: Must provide --brief or --resume');
    printHelp();
    process.exit(1);
  }

  // Check environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('Error: GOOGLE_AI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    let result: string;

    if (resumePath) {
      // Resume from saved state
      console.log(`Resuming pipeline from: ${resumePath}`);
      result = await runMoviePipeline(resumePath, options);
    } else {
      // Start new pipeline from brief
      const briefContent = fs.readFileSync(briefPath!, 'utf-8');
      const brief: MovieBrief = JSON.parse(briefContent);

      console.log(`Starting movie pipeline: "${brief.title}"`);
      console.log(`  Genre: ${brief.genre}`);
      console.log(`  Duration: ${brief.targetDuration}s`);
      console.log(`  Scenes: ~${Math.ceil(brief.targetDuration / 8)}`);
      if (options.dryRun) console.log('  Mode: DRY RUN (no video generation)');
      console.log('');

      result = await runMoviePipeline(brief, options);
    }

    console.log('');
    console.log('========================================');
    console.log(`Pipeline complete!`);
    console.log(`Output: ${result}`);
    console.log('========================================');
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

main();
