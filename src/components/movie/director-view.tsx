"use client";

import { useMemo } from "react";
import { DirectorMonitor } from "./director-monitor";
import { Timeline } from "./timeline-track";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
} from "lucide-react";
import type { PipelineProgressEvent } from "@/lib/movie-pipeline/types";
import type { SavedScene } from "@/hooks/use-movie-projects";

interface DirectorViewProps {
  stage: string | null;
  events: PipelineProgressEvent[];
  latestMessage: string;
  totalScenes: number;
  completedScenes: number;
  error: string | null;
  title: string;
  genre: string;
  targetDuration: number;
  outputPath?: string;
  onReset: () => void;
}

export function DirectorView({
  stage,
  events,
  latestMessage,
  totalScenes,
  completedScenes,
  error,
  title,
  genre,
  targetDuration,
  outputPath,
  onReset,
}: DirectorViewProps) {
  // Derive scenes from events
  const scenes = useMemo(() => {
    const sceneMap = new Map<number, SavedScene>();

    for (const event of events) {
      if (event.sceneNumber && event.type === "scene_update") {
        const existing = sceneMap.get(event.sceneNumber) || {
          sceneNumber: event.sceneNumber,
          description: "",
          status: "PENDING",
        };

        // Extract info from event messages
        if (event.message.includes("Generating prompt for scene")) {
          const desc = event.message.split(": ").slice(1).join(": ").replace("...", "");
          existing.description = desc || existing.description;
        }

        if (event.message.includes("Prompt ready")) {
          existing.prompt = event.message;
        }

        if (event.message.includes("submitting") || event.message.includes("polling")) {
          existing.status = "PROCESSING";
        }

        if (event.message.includes("generated") || event.message.includes("downloaded")) {
          existing.status = "GENERATED";
        }

        if (event.message.includes("error")) {
          existing.status = "FAILED";
        }

        if (event.message.includes("Subtitle:")) {
          existing.narrationText = event.message.replace('Subtitle: "', "").replace('"', "");
        }

        if (event.message.includes("quality") && event.meta?.qualityScore) {
          existing.qualityScore = event.meta.qualityScore as number;
        }

        sceneMap.set(event.sceneNumber, existing);
      }
    }

    // Also check for scene info from narrative planning
    for (const event of events) {
      if (event.meta?.totalScenes && !sceneMap.size) {
        const total = event.meta.totalScenes as number;
        for (let i = 1; i <= total; i++) {
          if (!sceneMap.has(i)) {
            sceneMap.set(i, {
              sceneNumber: i,
              description: "",
              status: "PENDING",
            });
          }
        }
      }
    }

    return Array.from(sceneMap.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
  }, [events]);

  // Find current prompt being processed
  const currentPrompt = useMemo(() => {
    const processingScene = scenes.find((s) => s.status === "PROCESSING");
    if (!processingScene) return null;

    // Find the prompt text from events
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.sceneNumber === processingScene.sceneNumber && e.message.includes("Prompt ready")) {
        return processingScene.description;
      }
    }
    return processingScene.description || null;
  }, [scenes, events]);

  // Find current subtitle being written
  const currentSubtitle = useMemo(() => {
    if (stage !== "NARRATION") return null;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].message.includes("Subtitle:")) {
        return events[i].message.replace('Subtitle: "', "").replace('"...', "").replace('"', "");
      }
    }
    return null;
  }, [stage, events]);

  // Subtitle texts map
  const subtitleTexts = useMemo(() => {
    const map = new Map<number, string>();
    for (const scene of scenes) {
      if (scene.narrationText) {
        map.set(scene.sceneNumber, scene.narrationText);
      }
    }
    return map;
  }, [scenes]);

  // Active/selected scene
  const activeScene = scenes.find((s) => s.status === "PROCESSING")?.sceneNumber || null;

  // Typing scene for subtitle effect
  const typingScene = useMemo(() => {
    if (stage !== "NARRATION") return null;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].message.includes("Subtitle:") && events[i].sceneNumber) {
        return events[i].sceneNumber!;
      }
    }
    return null;
  }, [stage, events]);

  const isDone = stage === "DONE";
  const isFailed = stage === "FAILED";

  return (
    <div className="space-y-4">
      {/* Director's Monitor */}
      <DirectorMonitor
        stage={stage}
        currentPrompt={currentPrompt}
        currentSubtitle={currentSubtitle}
        latestMessage={latestMessage}
        previewVideoUrl={null}
        title={title}
      />

      {/* Timeline */}
      {scenes.length > 0 && (
        <Timeline
          scenes={scenes}
          totalDuration={targetDuration}
          stage={stage || ""}
          activeSceneNumber={activeScene}
          onSceneClick={() => {}}
          subtitleTexts={subtitleTexts}
          typingSceneNumber={typingScene}
        />
      )}

      {/* Project Panel */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <Clapperboard className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-300 font-medium">{title || "Untitled"}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">{genre}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">{targetDuration}s</span>
          <span className="text-zinc-600">|</span>

          {/* Stage dots */}
          <div className="flex items-center gap-1">
            {["NARRATIVE_PLANNING", "SCENE_PROMPTING", "VIDEO_GENERATION", "QUALITY_CHECK", "NARRATION", "CONCATENATION", "DONE"].map((s, i) => {
              const stageOrder = ["NARRATIVE_PLANNING", "SCENE_PROMPTING", "VIDEO_GENERATION", "QUALITY_CHECK", "NARRATION", "CONCATENATION", "DONE"];
              const currentIdx = stage ? stageOrder.indexOf(stage) : -1;
              const isPast = i < currentIdx;
              const isCurrent = s === stage;
              return (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isPast || (isDone && s === "DONE")
                      ? "bg-green-500"
                      : isCurrent
                      ? "bg-amber-500 animate-pulse"
                      : "bg-zinc-800"
                  }`}
                  title={s}
                />
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Stats */}
          {totalScenes > 0 && (
            <span className="text-zinc-500 font-mono text-xs">
              {completedScenes}/{totalScenes} scenes
            </span>
          )}

          {/* Reset button */}
          {(isDone || isFailed) && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>

        {/* Error */}
        {isFailed && error && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-red-950/30 border border-red-800/50">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Done */}
        {isDone && outputPath && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-green-950/30 border border-green-800/50">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-400">הסרט מוכן!</p>
          </div>
        )}
      </div>
    </div>
  );
}
