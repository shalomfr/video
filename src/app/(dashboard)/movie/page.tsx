"use client";

import { useState, useRef, useEffect } from "react";
import {
  Clapperboard,
  Play,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Film,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { useMovieProgress } from "@/hooks/use-movie-progress";
import { useMovieProjects } from "@/hooks/use-movie-projects";
import { DirectorView } from "@/components/movie/director-view";
import type { PipelineProgressEvent } from "@/lib/movie-pipeline/types";

interface CharacterInput {
  name: string;
  description: string;
  role: string;
}

interface MovieBrief {
  title: string;
  genre: string;
  description: string;
  mood: string;
  targetDuration: number;
  visualStyle: string;
  colorPalette: string[];
  characters: CharacterInput[];
  locations: string[];
  narration?: {
    enabled: boolean;
    language: "en" | "he";
    voice?: string;
    style?: "narrator" | "character" | "documentary";
  };
  subtitles?: {
    enabled: boolean;
    language: "en" | "he";
    burnIn: boolean;
  };
}

type PipelineStage =
  | "IDLE"
  | "NARRATIVE_PLANNING"
  | "SCENE_PROMPTING"
  | "VIDEO_GENERATION"
  | "QUALITY_CHECK"
  | "NARRATION"
  | "CONCATENATION"
  | "DONE"
  | "FAILED";

interface PipelineStatus {
  stage: PipelineStage;
  totalScenes: number;
  completedScenes: number;
  currentScene: number;
  message: string;
  error?: string;
  movieId?: string;
  outputPath?: string;
  scenes?: {
    sceneNumber: number;
    description: string;
    status: string;
    qualityScore: number | null;
  }[];
}

const GENRES = [
  "דרמה",
  "קומדיה",
  "מתח",
  "פעולה",
  "רומנטיקה",
  "מדע בדיוני",
  "אימה",
  "דוקומנטרי",
  "פנטזיה",
  "אנימציה",
];

const MOODS = [
  "חם ונוסטלגי",
  "אנרגטי ומרגש",
  "מתוח ומסתורי",
  "רגוע ומדיטטיבי",
  "עצוב ומלנכולי",
  "שמח ואופטימי",
  "אפל ודרמטי",
  "חולמני ואתרי",
];

const VISUAL_STYLES = [
  "קולנועי קלאסי",
  "ניאו-נואר",
  "חמים וטבעיים",
  "קר ותעשייתי",
  "חולמני ואתרי",
  "Wes Anderson סימטרי",
  "דוקומנטרי ריאליסטי",
  "רטרו וינטג'",
];

const DURATION_OPTIONS = [
  { label: "15 שניות", value: 15, scenes: 2 },
  { label: "30 שניות", value: 30, scenes: 4 },
  { label: "1 דקה", value: 60, scenes: 8 },
  { label: "2 דקות", value: 120, scenes: 15 },
];

const STAGE_LABELS: Record<PipelineStage, string> = {
  IDLE: "ממתין",
  NARRATIVE_PLANNING: "מתכנן תסריט...",
  SCENE_PROMPTING: "יוצר פרומפטים לסצנות...",
  VIDEO_GENERATION: "מייצר סרטונים...",
  QUALITY_CHECK: "בודק איכות...",
  NARRATION: "מייצר קריינות וכתוביות...",
  CONCATENATION: "מרכיב סרט סופי...",
  DONE: "הסרט מוכן!",
  FAILED: "נכשל",
};

const STAGE_ORDER: PipelineStage[] = [
  "NARRATIVE_PLANNING",
  "SCENE_PROMPTING",
  "VIDEO_GENERATION",
  "QUALITY_CHECK",
  "NARRATION",
  "CONCATENATION",
  "DONE",
];

export default function MoviePage() {
  const [brief, setBrief] = useState<MovieBrief>({
    title: "",
    genre: "drama",
    description: "",
    mood: "חם ונוסטלגי",
    targetDuration: 30,
    visualStyle: "קולנועי קלאסי",
    colorPalette: ["#D4A574", "#2C3E50", "#F39C12"],
    characters: [{ name: "", description: "", role: "protagonist" }],
    locations: [""],
    narration: {
      enabled: false,
      language: "he",
      style: "narrator",
    },
    subtitles: {
      enabled: false,
      language: "he",
      burnIn: true,
    },
  });

  const [legacyStatus, setLegacyStatus] = useState<PipelineStatus>({
    stage: "IDLE",
    totalScenes: 0,
    completedScenes: 0,
    currentScene: 0,
    message: "",
  });

  const { state: sseState, connect: connectSSE, disconnect: disconnectSSE } = useMovieProgress();

  const [dryRun, setDryRun] = useState(false);

  // Derive status from SSE state when connected, otherwise from legacy
  const status: PipelineStatus = sseState.stage
    ? {
        stage: sseState.stage as PipelineStage,
        totalScenes: sseState.totalScenes,
        completedScenes: sseState.completedScenes,
        currentScene: 0,
        message: sseState.latestMessage,
        error: sseState.error || undefined,
      }
    : legacyStatus;

  const isRunning = !["IDLE", "DONE", "FAILED"].includes(status.stage);

  // ===== Handlers =====

  function addCharacter() {
    setBrief((b) => ({
      ...b,
      characters: [...b.characters, { name: "", description: "", role: "" }],
    }));
  }

  function removeCharacter(index: number) {
    setBrief((b) => ({
      ...b,
      characters: b.characters.filter((_, i) => i !== index),
    }));
  }

  function updateCharacter(
    index: number,
    field: keyof CharacterInput,
    value: string
  ) {
    setBrief((b) => ({
      ...b,
      characters: b.characters.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  }

  function addLocation() {
    setBrief((b) => ({ ...b, locations: [...b.locations, ""] }));
  }

  function removeLocation(index: number) {
    setBrief((b) => ({
      ...b,
      locations: b.locations.filter((_, i) => i !== index),
    }));
  }

  function updateLocation(index: number, value: string) {
    setBrief((b) => ({
      ...b,
      locations: b.locations.map((l, i) => (i === index ? value : l)),
    }));
  }

  function addColor() {
    setBrief((b) => ({
      ...b,
      colorPalette: [...b.colorPalette, "#000000"],
    }));
  }

  function removeColor(index: number) {
    setBrief((b) => ({
      ...b,
      colorPalette: b.colorPalette.filter((_, i) => i !== index),
    }));
  }

  async function startPipeline() {
    if (!brief.title || !brief.description) return;

    setLegacyStatus({
      stage: "NARRATIVE_PLANNING",
      totalScenes: 0,
      completedScenes: 0,
      currentScene: 0,
      message: "מתחיל...",
    });

    try {
      const res = await fetch("/api/movie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, dryRun }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start pipeline");
      }

      const data = await res.json();

      // Connect SSE stream for real-time updates
      connectSSE(data.movieId);
    } catch (error) {
      setLegacyStatus({
        stage: "FAILED",
        totalScenes: 0,
        completedScenes: 0,
        currentScene: 0,
        message: "",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // ===== Render =====

  const selectedDuration = DURATION_OPTIONS.find(
    (d) => d.value === brief.targetDuration
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Clapperboard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">יצירת סרט קולנועי</h1>
          <p className="text-muted-foreground text-sm">
            AI מתכנן, מייצר ומרכיב סרט מלא אוטומטית
          </p>
        </div>
      </div>

      {/* Main Content */}
      {isRunning || status.stage === "DONE" || status.stage === "FAILED" ? (
        <DirectorView
          stage={sseState.stage || status.stage}
          events={sseState.events}
          latestMessage={sseState.latestMessage || status.message}
          totalScenes={sseState.totalScenes || status.totalScenes}
          completedScenes={sseState.completedScenes || status.completedScenes}
          error={sseState.error || status.error || null}
          title={brief.title}
          genre={brief.genre}
          targetDuration={brief.targetDuration}
          outputPath={status.outputPath}
          onReset={() => { setLegacyStatus({ stage: "IDLE", totalScenes: 0, completedScenes: 0, currentScene: 0, message: "" }); disconnectSSE(); }}
        />
      ) : (
        <div className="space-y-6">
          {/* Title & Genre */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Film className="w-5 h-5" />
              פרטי הסרט
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  שם הסרט
                </label>
                <input
                  type="text"
                  value={brief.title}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, title: e.target.value }))
                  }
                  placeholder="השקיעה האחרונה"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">ז'אנר</label>
                <select
                  value={brief.genre}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, genre: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">תיאור העלילה</label>
              <textarea
                value={brief.description}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, description: e.target.value }))
                }
                placeholder="ספר את סיפור הסרט... מה קורה? מי הדמויות? מה המסר?"
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              אורך הסרט
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setBrief((b) => ({ ...b, targetDuration: opt.value }))
                  }
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    brief.targetDuration === opt.value
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-muted"
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ~{opt.scenes} סצנות
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mood & Style */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              סגנון ואווירה
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">אווירה</label>
                <select
                  value={brief.mood}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, mood: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  סגנון ויזואלי
                </label>
                <select
                  value={brief.visualStyle}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, visualStyle: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {VISUAL_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                פלטת צבעים
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {brief.colorPalette.map((color, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newPalette = [...brief.colorPalette];
                        newPalette[i] = e.target.value;
                        setBrief((b) => ({ ...b, colorPalette: newPalette }));
                      }}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    {brief.colorPalette.length > 1 && (
                      <button
                        onClick={() => removeColor(i)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addColor}
                  className="w-10 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Characters */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">דמויות</h2>
              <button
                onClick={addCharacter}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="w-4 h-4" />
                הוסף דמות
              </button>
            </div>
            <div className="space-y-4">
              {brief.characters.map((char, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_auto] gap-3 items-start p-4 rounded-xl bg-muted/50"
                >
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => updateCharacter(i, "name", e.target.value)}
                    placeholder="שם"
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  <input
                    type="text"
                    value={char.description}
                    onChange={(e) =>
                      updateCharacter(i, "description", e.target.value)
                    }
                    placeholder="תיאור מראה: גיל, שיער, בגדים, מאפיינים..."
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  <input
                    type="text"
                    value={char.role}
                    onChange={(e) => updateCharacter(i, "role", e.target.value)}
                    placeholder="תפקיד"
                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                  {brief.characters.length > 1 && (
                    <button
                      onClick={() => removeCharacter(i)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">לוקיישנים</h2>
              <button
                onClick={addLocation}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="w-4 h-4" />
                הוסף לוקיישן
              </button>
            </div>
            <div className="space-y-3">
              {brief.locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={loc}
                    onChange={(e) => updateLocation(i, e.target.value)}
                    placeholder="תאר את המיקום: נמל דייגים ים תיכוני בשקיעה..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
                  />
                  {brief.locations.length > 1 && (
                    <button
                      onClick={() => removeLocation(i)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Narration & Subtitles */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Film className="w-5 h-5" />
              קריינות וכתוביות
            </h2>

            {/* Narration Toggle */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={brief.narration?.enabled || false}
                  onChange={(e) =>
                    setBrief((b) => ({
                      ...b,
                      narration: { ...b.narration!, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded border-border"
                />
                <div>
                  <span className="text-sm font-medium">קריינות (Voice Over)</span>
                  <p className="text-xs text-muted-foreground">
                    AI כותב טקסט קריינות ומייצר אודיו אוטומטית
                  </p>
                </div>
              </label>

              {brief.narration?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-7">
                  <div>
                    <label className="block text-xs font-medium mb-1">שפה</label>
                    <select
                      value={brief.narration?.language || "he"}
                      onChange={(e) =>
                        setBrief((b) => ({
                          ...b,
                          narration: {
                            ...b.narration!,
                            language: e.target.value as "en" | "he",
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="he">עברית</option>
                      <option value="en">אנגלית</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">סגנון</label>
                    <select
                      value={brief.narration?.style || "narrator"}
                      onChange={(e) =>
                        setBrief((b) => ({
                          ...b,
                          narration: {
                            ...b.narration!,
                            style: e.target.value as
                              | "narrator"
                              | "character"
                              | "documentary",
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="narrator">מספר (גוף שלישי)</option>
                      <option value="character">דמות (גוף ראשון)</option>
                      <option value="documentary">דוקומנטרי</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Subtitles Toggle */}
            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={brief.subtitles?.enabled || false}
                  onChange={(e) =>
                    setBrief((b) => ({
                      ...b,
                      subtitles: { ...b.subtitles!, enabled: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded border-border"
                />
                <div>
                  <span className="text-sm font-medium">כתוביות</span>
                  <p className="text-xs text-muted-foreground">
                    טקסט מוצג על הסרטון
                  </p>
                </div>
              </label>

              {brief.subtitles?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-7">
                  <div>
                    <label className="block text-xs font-medium mb-1">שפה</label>
                    <select
                      value={brief.subtitles?.language || "he"}
                      onChange={(e) =>
                        setBrief((b) => ({
                          ...b,
                          subtitles: {
                            ...b.subtitles!,
                            language: e.target.value as "en" | "he",
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="he">עברית</option>
                      <option value="en">אנגלית</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">סוג</label>
                    <select
                      value={brief.subtitles?.burnIn ? "hard" : "soft"}
                      onChange={(e) =>
                        setBrief((b) => ({
                          ...b,
                          subtitles: {
                            ...b.subtitles!,
                            burnIn: e.target.value === "hard",
                          },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="hard">צרובות על הווידאו</option>
                      <option value="soft">קובץ SRT נפרד</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span>Dry Run — רק תכנון, בלי יצירת וידאו</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startPipeline}
                disabled={!brief.title || !brief.description}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-l from-purple-600 to-pink-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                {dryRun ? "תכנן סרט" : "צור סרט"}
              </button>
            </div>

            {selectedDuration && (
              <p className="text-xs text-muted-foreground text-center">
                {dryRun
                  ? `יתכנן ~${selectedDuration.scenes} סצנות (ללא יצירת וידאו)`
                  : `יצור סרט של ${selectedDuration.label} (~${selectedDuration.scenes} סצנות). זמן משוער: ${Math.ceil(selectedDuration.scenes * 4 / 60)} דקות`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Old LiveLog and PipelineProgress removed — replaced by DirectorView
