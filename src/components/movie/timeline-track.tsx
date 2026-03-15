"use client";

import { SceneBlock } from "./scene-block";
import { Film, Mic, Subtitles } from "lucide-react";
import type { SavedScene } from "@/hooks/use-movie-projects";

interface TimelineProps {
  scenes: SavedScene[];
  totalDuration: number;
  stage: string;
  activeSceneNumber: number | null;
  onSceneClick: (sceneNumber: number) => void;
  subtitleTexts: Map<number, string>;
  typingSceneNumber: number | null;
}

export function Timeline({
  scenes,
  totalDuration,
  stage,
  activeSceneNumber,
  onSceneClick,
  subtitleTexts,
  typingSceneNumber,
}: TimelineProps) {
  const sceneDuration = 8;
  const effectiveDuration = Math.max(totalDuration, scenes.length * sceneDuration);

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 space-y-1 overflow-x-auto">
      {/* Ruler */}
      <TimelineRuler duration={effectiveDuration} sceneDuration={sceneDuration} />

      {/* Video Track */}
      <div className="flex items-center gap-2">
        <div className="w-8 shrink-0 flex items-center justify-center" title="Video">
          <Film className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="flex-1 h-14 flex gap-1" dir="ltr">
          {scenes.map((scene) => (
            <div
              key={scene.sceneNumber}
              className="transition-all duration-500"
              style={{
                flex: `0 0 ${(sceneDuration / effectiveDuration) * 100}%`,
                animation: scene.status === "GENERATED" ? "slideIn 0.3s ease-out" : undefined,
              }}
            >
              <SceneBlock
                sceneNumber={scene.sceneNumber}
                status={scene.status}
                description={scene.description}
                duration={sceneDuration}
                isActive={activeSceneNumber === scene.sceneNumber}
                onClick={() => onSceneClick(scene.sceneNumber)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Audio Track */}
      <div className="flex items-center gap-2">
        <div className="w-8 shrink-0 flex items-center justify-center" title="Audio">
          <Mic className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 h-8 flex gap-1" dir="ltr">
          {scenes.map((scene) => (
            <div
              key={scene.sceneNumber}
              className="transition-all duration-500"
              style={{ flex: `0 0 ${(sceneDuration / effectiveDuration) * 100}%` }}
            >
              <div
                className={`h-full rounded-md flex items-center justify-center transition-all duration-300 ${
                  scene.narrationText
                    ? "bg-emerald-500/40 border border-emerald-500/30"
                    : "bg-zinc-900/30 border border-zinc-800/50 border-dashed"
                }`}
              >
                {scene.narrationText && (
                  <div className="w-full px-1 flex items-center gap-[2px]">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-emerald-400/60 rounded-full"
                        style={{ height: `${4 + Math.random() * 12}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subtitle Track */}
      <div className="flex items-center gap-2">
        <div className="w-8 shrink-0 flex items-center justify-center" title="Subtitles">
          <Subtitles className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex-1 h-8 flex gap-1" dir="ltr">
          {scenes.map((scene) => {
            const text = subtitleTexts.get(scene.sceneNumber);
            const isTyping = typingSceneNumber === scene.sceneNumber;
            return (
              <div
                key={scene.sceneNumber}
                className="transition-all duration-500"
                style={{ flex: `0 0 ${(sceneDuration / effectiveDuration) * 100}%` }}
              >
                <div
                  className={`h-full rounded-md flex items-center px-1.5 overflow-hidden transition-all duration-300 ${
                    text
                      ? "bg-blue-500/30 border border-blue-500/20"
                      : "bg-zinc-900/30 border border-zinc-800/50 border-dashed"
                  }`}
                >
                  {text && (
                    <span
                      className={`text-[9px] text-blue-300 truncate ${
                        isTyping ? "typewriter-text" : ""
                      }`}
                    >
                      {text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Playhead indicator */}
      <div className="flex items-center gap-2 mt-2">
        <div className="w-8 shrink-0" />
        <div className="flex-1 relative h-1">
          {scenes.length > 0 && (
            <div
              className="absolute top-0 h-full bg-red-500 rounded-full transition-all duration-500"
              style={{
                width: `${(scenes.filter((s) => s.status === "GENERATED").length / scenes.length) * 100}%`,
              }}
            />
          )}
          <div className="absolute top-0 h-full w-full bg-zinc-800 rounded-full -z-10" />
        </div>
      </div>
    </div>
  );
}

function TimelineRuler({
  duration,
  sceneDuration,
}: {
  duration: number;
  sceneDuration: number;
}) {
  const marks = Math.ceil(duration / sceneDuration);
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-8 shrink-0" />
      <div className="flex-1 flex" dir="ltr">
        {Array.from({ length: marks }, (_, i) => (
          <div
            key={i}
            className="text-[10px] text-zinc-600 font-mono"
            style={{ flex: `0 0 ${(sceneDuration / duration) * 100}%` }}
          >
            {formatTime(i * sceneDuration)}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
