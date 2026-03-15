// ===== Pipeline Stages =====
export type PipelineStage =
  | 'NARRATIVE_PLANNING'
  | 'SCENE_PROMPTING'
  | 'VIDEO_GENERATION'
  | 'QUALITY_CHECK'
  | 'NARRATION'
  | 'CONCATENATION'
  | 'DONE'
  | 'FAILED';

export type SceneStatus = 'PENDING' | 'PROCESSING' | 'GENERATED' | 'FAILED';

// ===== Movie Brief (Input) =====
export interface MovieBrief {
  title: string;
  genre: string;
  description: string;
  mood: string;
  targetDuration: number; // seconds
  visualStyle: string;
  colorPalette?: string[];
  characters?: CharacterInput[];
  locations?: string[];
  soundtrack?: {
    genre: string;
    mood: string;
    prompt?: string;
  };
  narration?: {
    enabled: boolean;
    language: 'en' | 'he';
    voice?: string;
    style?: 'narrator' | 'character' | 'documentary';
  };
  subtitles?: {
    enabled: boolean;
    language: 'en' | 'he';
    burnIn: boolean;
  };
}

export interface CharacterInput {
  name: string;
  description: string;
  role: string;
}

// ===== Narrative Plan =====
export interface NarrativePlan {
  title: string;
  acts: Act[];
  scenes: PlannedScene[];
  styleGuide: StyleGuide;
  totalDuration: number;
}

export interface Act {
  actNumber: number;
  title: string;
  description: string;
  sceneNumbers: number[];
}

export interface PlannedScene {
  sceneNumber: number;
  actNumber: number;
  description: string;
  prompt: string;
  duration: number;
  cameraAngle: string;
  transition: string;
  characters: string[];
  location: string;
}

export interface StyleGuide {
  colorPalette: string[];
  visualStyle: string;
  lightingStyle: string;
  cameraLanguage: string;
  characterDescriptions: CharacterDescription[];
  recurringElements: string[];
}

export interface CharacterDescription {
  name: string;
  appearance: string;
  clothing: string;
  distinctiveFeatures: string;
}

export interface LocationDescription {
  name: string;
  visualDescription: string;
  lightingNotes: string;
}

// ===== Continuity Document =====
export interface ContinuityDocument {
  characters: CharacterDescription[];
  locations: LocationDescription[];
  styleAnchors: string[];
  previousSceneDescriptions: string[];
}

// ===== Movie Scene (Runtime) =====
export interface MovieScene {
  sceneNumber: number;
  actNumber: number;
  description: string;
  plannedPrompt: string;
  finalPrompt: string;
  promptGenerated: boolean;
  status: SceneStatus;
  taskId: string | null;
  videoUrl: string | null;
  localPath: string | null;
  lastFramePath: string | null;
  qualityScore: number | null;
  retryCount: number;
  duration: number;
  cameraAngle: string;
  transition: string;
  narrationText: string | null;
  narrationAudioPath: string | null;
}

// ===== Movie State (Persisted) =====
export interface MovieState {
  id: string;
  stage: PipelineStage;
  brief: MovieBrief;
  narrative: NarrativePlan | null;
  continuityDoc: ContinuityDocument | null;
  scenes: MovieScene[];
  soundtrackTaskId: string | null;
  soundtrackPath: string | null;
  finalVideoPath: string | null;
  subtitlePath: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

// ===== Pipeline Options =====
export interface PipelineOptions {
  dryRun?: boolean;
  singleScene?: number;
  batchSize?: number;
  maxRetries?: number;
  videoModel?: 'veo';
  outputDir?: string;
  stateDir?: string;
}
