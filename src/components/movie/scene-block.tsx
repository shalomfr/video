"use client";

import { CheckCircle2, X, Loader2 } from "lucide-react";

interface SceneBlockProps {
  sceneNumber: number;
  status: string;
  description: string;
  duration: number;
  isActive: boolean;
  onClick: () => void;
}

export function SceneBlock({
  sceneNumber,
  status,
  description,
  duration,
  isActive,
  onClick,
}: SceneBlockProps) {
  const isClickable = status === "GENERATED";

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      className={`
        relative h-full rounded-lg border-2 transition-all duration-300 overflow-hidden
        flex flex-col items-center justify-center gap-1 text-xs font-medium
        ${isClickable ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"}
        ${isActive ? "ring-2 ring-red-500 ring-offset-1 ring-offset-zinc-900" : ""}
        ${status === "GENERATED"
          ? "border-purple-500/60 bg-gradient-to-br from-purple-600/80 to-pink-600/80 text-white"
          : status === "PROCESSING"
          ? "border-amber-500/60 bg-zinc-800 text-amber-400 scene-block-shimmer"
          : status === "FAILED"
          ? "border-red-500/60 bg-red-950/50 text-red-400"
          : "border-zinc-700 border-dashed bg-zinc-900/50 text-zinc-600"
        }
      `}
      title={description}
    >
      {/* Scene number */}
      <span className="text-[10px] font-bold opacity-80">SC {sceneNumber}</span>

      {/* Status icon */}
      {status === "GENERATED" && <CheckCircle2 className="w-4 h-4" />}
      {status === "PROCESSING" && <Loader2 className="w-4 h-4 animate-spin" />}
      {status === "FAILED" && <X className="w-4 h-4" />}
      {status === "PENDING" && <span className="text-[10px]">{duration}s</span>}
    </button>
  );
}
