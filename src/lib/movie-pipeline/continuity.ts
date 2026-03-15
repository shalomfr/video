import type {
  NarrativePlan,
  ContinuityDocument,
  CharacterDescription,
  LocationDescription,
  MovieScene,
} from './types';

/**
 * Builds initial continuity document from the narrative plan.
 * This document is injected into every scene prompt for visual consistency.
 */
export function buildContinuityDocument(
  narrative: NarrativePlan
): ContinuityDocument {
  const characters = narrative.styleGuide.characterDescriptions;
  const locations = extractLocations(narrative);
  const styleAnchors = buildStyleAnchors(narrative);

  return {
    characters,
    locations,
    styleAnchors,
    previousSceneDescriptions: [],
  };
}

/**
 * Updates the continuity document after a scene is generated.
 * Adds the scene description to the running log.
 */
export function updateContinuityAfterScene(
  doc: ContinuityDocument,
  scene: MovieScene
): ContinuityDocument {
  return {
    ...doc,
    previousSceneDescriptions: [
      ...doc.previousSceneDescriptions,
      `Scene ${scene.sceneNumber}: ${scene.description}`,
    ],
  };
}

/**
 * Builds the style anchor block — a fixed text prepended to every scene prompt.
 * Forces the video model to anchor on the same visual identity.
 */
function buildStyleAnchors(narrative: NarrativePlan): string[] {
  const { styleGuide } = narrative;
  const anchors: string[] = [];

  // Visual style anchor
  const palette = styleGuide.colorPalette?.join(', ') || 'cinematic natural tones';
  anchors.push(
    `Cinematic 4K, ${styleGuide.visualStyle || 'cinematic'}. ` +
    `Color palette: ${palette}. ` +
    `Lighting: ${styleGuide.lightingStyle || 'natural'}. ` +
    `Camera: ${styleGuide.cameraLanguage || 'dynamic'}.`
  );

  // Character anchors
  if (styleGuide.characterDescriptions) {
    for (const char of styleGuide.characterDescriptions) {
      anchors.push(
        `Character [${char.name}]: ${char.appearance}, ` +
        `wearing ${char.clothing}, ${char.distinctiveFeatures}.`
      );
    }
  }

  // Recurring elements
  if (styleGuide.recurringElements?.length) {
    anchors.push(
      `Recurring elements: ${styleGuide.recurringElements.join(', ')}.`
    );
  }

  return anchors;
}

/**
 * Extracts unique locations from the narrative plan.
 */
function extractLocations(narrative: NarrativePlan): LocationDescription[] {
  const locationMap = new Map<string, LocationDescription>();

  for (const scene of narrative.scenes) {
    if (!locationMap.has(scene.location)) {
      locationMap.set(scene.location, {
        name: scene.location,
        visualDescription: '', // Will be enriched by Claude during prompt building
        lightingNotes: '',
      });
    }
  }

  return Array.from(locationMap.values());
}

/**
 * Formats the continuity document into a text block for prompt injection.
 */
export function formatContinuityForPrompt(
  doc: ContinuityDocument,
  currentSceneNumber: number
): string {
  const parts: string[] = [];

  // Style anchors (always first)
  parts.push('[STYLE GUIDE]');
  parts.push(doc.styleAnchors.join(' '));

  // Previous scene context (last 2 scenes only, to keep prompt concise)
  const recentScenes = doc.previousSceneDescriptions.slice(-2);
  if (recentScenes.length > 0) {
    parts.push('');
    parts.push('[PREVIOUS SCENES]');
    for (const desc of recentScenes) {
      parts.push(desc);
    }
  }

  // Current scene marker
  parts.push('');
  parts.push(`[CURRENT SCENE ${currentSceneNumber}]`);

  return parts.join('\n');
}

/**
 * Gets the reference image path for the next scene (last frame of previous scene).
 * Returns null for the first scene.
 */
export function getReferenceImageForScene(
  scenes: MovieScene[],
  currentSceneNumber: number
): string | null {
  const previousScene = scenes.find(
    (s) => s.sceneNumber === currentSceneNumber - 1
  );
  return previousScene?.lastFramePath ?? null;
}
