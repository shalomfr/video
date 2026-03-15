import OpenAI from 'openai';
import type {
  MovieBrief,
  NarrativePlan,
  ContinuityDocument,
  PlannedScene,
  MovieScene,
} from './types';
import { formatContinuityForPrompt } from './continuity';

const MODEL = 'anthropic/claude-sonnet-4';

let _openrouter: OpenAI | null = null;
function getOpenRouter(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        'X-Title': 'Movie Pipeline',
      },
    });
  }
  return _openrouter;
}

// ===== Helpers =====

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

// ===== Narrative Planning =====

export async function planFullMovie(
  brief: MovieBrief
): Promise<NarrativePlan> {
  const { MOVIE_NARRATIVE_PROMPT } = await import(
    '../prompts/narrative-planning'
  );

  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MOVIE_NARRATIVE_PROMPT },
      {
        role: 'user',
        content: `${JSON.stringify(brief, null, 2)}\n\n` +
          `CRITICAL CONSTRAINTS:\n` +
          `1. Target duration: ${brief.targetDuration} seconds. Each scene = 8 seconds. Create EXACTLY ${Math.ceil(brief.targetDuration / 8)} scenes.\n` +
          `2. Respond with ONLY valid JSON. No explanations, no comments, no text outside the JSON object.\n` +
          `3. Start your response with { and end with }`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response for narrative planning');

  let plan: NarrativePlan;
  try {
    plan = JSON.parse(extractJSON(content)) as NarrativePlan;
  } catch (e) {
    console.error('Failed to parse narrative plan. Raw response:', content.slice(0, 300));
    throw new Error(`Narrative planning returned invalid JSON: ${(e as Error).message}`);
  }

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

  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MOVIE_OUTLINE_PROMPT },
      { role: 'user', content: JSON.stringify(brief, null, 2) },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response for movie outline');

  const outline = JSON.parse(extractJSON(content)) as MovieOutline;

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

  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MOVIE_NARRATIVE_PROMPT },
      { role: 'user', content: actBrief },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response for act ${act.actNumber}`);

  const parsed = JSON.parse(extractJSON(content)) as NarrativePlan;
  return parsed.scenes;
}

// ===== Scene Prompt Generation =====

const SCENE_PROMPT_SYSTEM = `You are a cinematic prompt engineer specializing in AI video generation.
Your job is to create detailed, precise prompts for video generation models (Google Veo).

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
- CRITICAL: Keep the prompt under 900 characters (NOT words — characters). Runway has a 1000 character limit.
- Be concise but descriptive. Prioritize visual details over narrative context.
- Output ONLY the prompt text, no JSON or markup`;

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

  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SCENE_PROMPT_SYSTEM },
      { role: 'user', content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No prompt generated for scene ${scene.sceneNumber}`);

  return content.trim();
}

// ===== Prompt Refinement =====

export async function refinePrompt(
  originalPrompt: string,
  issues: string[],
  continuityDoc: ContinuityDocument,
  sceneNumber: number
): Promise<string> {
  const response = await getOpenRouter().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a prompt refinement specialist. Fix the video generation prompt to address quality issues while maintaining visual continuity. Output ONLY the refined prompt text.',
      },
      {
        role: 'user',
        content: `Original prompt:\n${originalPrompt}\n\nIssues found:\n${issues.join('\n')}\n\nStyle anchors (must keep):\n${continuityDoc.styleAnchors.join('\n')}\n\nRefine the prompt to fix these issues while keeping the same scene intent and style.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`Failed to refine prompt for scene ${sceneNumber}`);

  return content.trim();
}
