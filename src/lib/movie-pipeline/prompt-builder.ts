import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  MovieBrief,
  NarrativePlan,
  ContinuityDocument,
  PlannedScene,
  MovieScene,
} from './types';
import { formatContinuityForPrompt } from './continuity';

const MODEL = 'gemini-2.0-flash';

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error('GOOGLE_AI_API_KEY is not configured');
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

// ===== Helpers =====

function extractJSON(text: string): string {
  // Try to find JSON block in markdown code fence
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

// ===== Narrative Planning =====

/**
 * Claude plans the entire movie: acts, scenes, characters, style guide.
 */
export async function planFullMovie(
  brief: MovieBrief
): Promise<NarrativePlan> {
  const { MOVIE_NARRATIVE_PROMPT } = await import(
    '../prompts/narrative-planning'
  );

  const model = getGemini().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    MOVIE_NARRATIVE_PROMPT,
    JSON.stringify(brief, null, 2),
  ]);

  const content = result.response.text();
  if (!content) throw new Error('No response from Gemini for narrative planning');

  const plan = JSON.parse(extractJSON(content)) as NarrativePlan;

  // Ensure styleGuide has all required fields with defaults
  plan.styleGuide = {
    colorPalette: plan.styleGuide?.colorPalette || ['cinematic natural'],
    visualStyle: plan.styleGuide?.visualStyle || 'cinematic',
    lightingStyle: plan.styleGuide?.lightingStyle || 'natural',
    cameraLanguage: plan.styleGuide?.cameraLanguage || 'dynamic',
    characterDescriptions: plan.styleGuide?.characterDescriptions || [],
    recurringElements: plan.styleGuide?.recurringElements || [],
  };

  return plan;
}

// ===== Feature-Length Planning (act-by-act) =====

/**
 * For long movies: creates a high-level outline with acts, characters, and style guide.
 * Each act is then planned in detail separately via planActScenes().
 */
export interface MovieOutline {
  title: string;
  totalDuration: number;
  actCount: number;
  acts: {
    actNumber: number;
    title: string;
    duration: number;
    sceneCount: number;
    summary: string;
    locations: string[];
    keyEvents: string[];
    emotionalArc: string;
    visualTone: string;
  }[];
  characters: {
    name: string;
    role: string;
    arc: string;
    appearance: string;
    clothing: string;
    distinctiveFeatures: string;
  }[];
  styleGuide: {
    colorPalette: string[];
    visualStyle: string;
    lightingStyle: string;
    cameraLanguage: string;
    recurringElements: string[];
  };
}

export async function planMovieOutline(
  brief: MovieBrief
): Promise<MovieOutline> {
  const { MOVIE_OUTLINE_PROMPT } = await import(
    '../prompts/narrative-planning'
  );

  const model = getGemini().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    MOVIE_OUTLINE_PROMPT,
    JSON.stringify(brief, null, 2),
  ]);

  const content = result.response.text();
  if (!content) throw new Error('No response from Gemini for movie outline');

  const outline = JSON.parse(extractJSON(content)) as MovieOutline;

  // Ensure defaults
  outline.styleGuide = {
    colorPalette: outline.styleGuide?.colorPalette || ['cinematic natural'],
    visualStyle: outline.styleGuide?.visualStyle || 'cinematic',
    lightingStyle: outline.styleGuide?.lightingStyle || 'natural',
    cameraLanguage: outline.styleGuide?.cameraLanguage || 'dynamic',
    recurringElements: outline.styleGuide?.recurringElements || [],
  };
  outline.characters = outline.characters || [];
  for (const act of outline.acts || []) {
    act.locations = act.locations || [];
    act.keyEvents = act.keyEvents || [];
  }

  return outline;
}

/**
 * Plans detailed scenes for a single act, given the movie outline.
 * This keeps each Claude call focused and within context limits.
 */
export async function planActScenes(
  brief: MovieBrief,
  outline: MovieOutline,
  act: MovieOutline['acts'][0]
): Promise<PlannedScene[]> {
  const { MOVIE_NARRATIVE_PROMPT } = await import(
    '../prompts/narrative-planning'
  );

  const actBrief = `
MOVIE: "${outline.title}"
OVERALL STYLE: ${outline.styleGuide.visualStyle}, ${outline.styleGuide.lightingStyle}

CHARACTERS:
${outline.characters.map((c) => `- ${c.name} (${c.role}): ${c.appearance}. Wearing: ${c.clothing}. Distinctive: ${c.distinctiveFeatures}`).join('\n')}

YOU ARE PLANNING ACT ${act.actNumber} OF ${outline.actCount}: "${act.title}"
Duration: ${act.duration} seconds = ${act.sceneCount} scenes of 8 seconds each
Summary: ${act.summary}
Locations: ${(act.locations || []).join(', ')}
Key events: ${(act.keyEvents || []).join(', ')}
Emotional arc: ${act.emotionalArc}
Visual tone: ${act.visualTone}

Create exactly ${act.sceneCount} scenes for this act. Each scene is 8 seconds.
All scene numbers should start from 1 (they will be renumbered globally later).
Set actNumber to ${act.actNumber} for all scenes.

Original brief: ${JSON.stringify(brief, null, 2)}`;

  const model = getGemini().getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    MOVIE_NARRATIVE_PROMPT,
    actBrief,
  ]);

  const content = result.response.text();
  if (!content) throw new Error(`No response for act ${act.actNumber}`);

  const parsed = JSON.parse(extractJSON(content)) as NarrativePlan;
  return parsed.scenes;
}

// ===== Scene Prompt Generation =====

const SCENE_PROMPT_SYSTEM = `You are a cinematic prompt engineer specializing in AI video generation.
Your job is to create detailed, precise prompts for video generation models (Runway ML / Google Veo).

Given:
1. A continuity document (style guide, character descriptions, previous scene context)
2. A planned scene description
3. Optionally, quality feedback from a failed previous attempt

Create a single, detailed English prompt that will generate the scene with visual consistency.

Rules:
- Start with the style anchors from the continuity document (verbatim)
- Include character descriptions exactly as specified
- Reference the previous scene for visual flow
- Be specific about camera movement, lighting, and composition
- Keep the prompt under 500 words
- Output ONLY the prompt text, no JSON or markup`;

/**
 * Generates a detailed video prompt for a single scene,
 * incorporating continuity information and style guide.
 */
export async function generateScenePrompt(
  scene: PlannedScene,
  continuityDoc: ContinuityDocument,
  completedScenes: MovieScene[],
  qaFeedback?: string[]
): Promise<string> {
  const continuityBlock = formatContinuityForPrompt(
    continuityDoc,
    scene.sceneNumber
  );

  let userMessage = `${continuityBlock}

Scene plan:
- Description: ${scene.description}
- Camera angle: ${scene.cameraAngle}
- Duration: ${scene.duration} seconds
- Location: ${scene.location}
- Characters in scene: ${(scene.characters || []).join(', ') || 'none'}
- Transition to next: ${scene.transition}`;

  if (qaFeedback && qaFeedback.length > 0) {
    userMessage += `\n\n[QA FEEDBACK - Fix these issues from previous attempt]:\n${qaFeedback.join('\n')}`;
  }

  const model = getGemini().getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    SCENE_PROMPT_SYSTEM,
    userMessage,
  ]);

  const content = result.response.text();
  if (!content) throw new Error(`No prompt generated for scene ${scene.sceneNumber}`);

  return content.trim();
}

// ===== Prompt Refinement =====

/**
 * Refines a scene prompt based on quality analysis feedback.
 * Used when a generated clip doesn't meet quality standards.
 */
export async function refinePrompt(
  originalPrompt: string,
  issues: string[],
  continuityDoc: ContinuityDocument,
  sceneNumber: number
): Promise<string> {
  const model = getGemini().getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    `You are a prompt refinement specialist. Fix the video generation prompt to address quality issues while maintaining visual continuity. Output ONLY the refined prompt text.`,
    `Original prompt:\n${originalPrompt}\n\nIssues found:\n${issues.join('\n')}\n\nStyle anchors (must keep):\n${continuityDoc.styleAnchors.join('\n')}\n\nRefine the prompt to fix these issues while keeping the same scene intent and style.`,
  ]);

  const content = result.response.text();
  if (!content) throw new Error(`Failed to refine prompt for scene ${sceneNumber}`);

  return content.trim();
}
