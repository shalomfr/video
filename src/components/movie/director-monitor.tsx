"use client";

import { useState, useEffect, useRef } from "react";
import { Monitor, Play } from "lucide-react";

interface DirectorMonitorProps {
  stage: string | null;
  currentPrompt: string | null;
  currentSubtitle: string | null;
  latestMessage: string;
  previewVideoUrl: string | null;
  title: string;
}

export function DirectorMonitor({
  stage,
  currentPrompt,
  currentSubtitle,
  latestMessage,
  previewVideoUrl,
  title,
}: DirectorMonitorProps) {
  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Monitor chrome */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800">
        <Monitor className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500 font-mono">
          {title || "Director's Monitor"}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${
            stage === "DONE" ? "bg-green-500" :
            stage === "FAILED" ? "bg-red-500" :
            stage ? "bg-amber-500 animate-pulse" :
            "bg-zinc-700"
          }`} />
          <span className="text-[10px] text-zinc-600 font-mono uppercase">
            {stage === "DONE" ? "complete" : stage === "FAILED" ? "error" : stage ? "recording" : "standby"}
          </span>
        </div>
      </div>

      {/* Monitor screen */}
      <div className="aspect-video bg-black flex items-center justify-center relative min-h-[200px]">
        {previewVideoUrl ? (
          <video
            src={previewVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
          />
        ) : currentSubtitle ? (
          <div className="p-8 text-center">
            <TypewriterText text={currentSubtitle} className="text-xl text-blue-300 font-medium" />
            <p className="text-xs text-zinc-600 mt-4 font-mono">SUBTITLE PREVIEW</p>
          </div>
        ) : currentPrompt ? (
          <div className="p-6 max-w-lg">
            <TypewriterText text={currentPrompt} className="text-sm text-amber-300/80 font-mono leading-relaxed" />
            <p className="text-xs text-zinc-600 mt-4 font-mono">GENERATING VIDEO...</p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <Play className="w-12 h-12 text-zinc-800 mx-auto" />
            <p className="text-sm text-zinc-700">{latestMessage || "Ready"}</p>
          </div>
        )}

        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />
      </div>
    </div>
  );
}

// ===== Typewriter Effect =====

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [currentText, setCurrentText] = useState(text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (text !== currentText) {
      setCurrentText(text);
      setDisplayed("");
      indexRef.current = 0;
    }
  }, [text, currentText]);

  useEffect(() => {
    if (indexRef.current >= currentText.length) return;

    const timer = setInterval(() => {
      indexRef.current++;
      setDisplayed(currentText.slice(0, indexRef.current));

      if (indexRef.current >= currentText.length) {
        clearInterval(timer);
      }
    }, 25);

    return () => clearInterval(timer);
  }, [currentText]);

  return (
    <span className={className}>
      {displayed}
      {indexRef.current < currentText.length && (
        <span className="animate-pulse text-white/50">|</span>
      )}
    </span>
  );
}
