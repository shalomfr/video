"use client";

import { useState } from "react";
import { Play, RotateCcw, CheckCircle, XCircle, Clock, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScenePreview } from "./scene-preview";

interface Scene {
  id: string;
  sceneNumber: number;
  prompt: string;
  sceneDescription?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  duration: number;
  qualityScore?: number;
  retryCount: number;
  errorMessage?: string;
}

interface SceneTimelineProps {
  scenes: Scene[];
  pipelineStage?: string | null;
  onRegenerateScene: (sceneId: string) => void;
  className?: string;
}

export function SceneTimeline({
  scenes,
  pipelineStage,
  onRegenerateScene,
  className
}: SceneTimelineProps) {
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  const getStatusIcon = (status: Scene['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PROCESSING':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusText = (status: Scene['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'הושלם';
      case 'FAILED':
        return 'נכשל';
      case 'PROCESSING':
        return 'מעבד';
      default:
        return 'ממתין';
    }
  };

  return (
    <div className={cn("bg-white dark:bg-zinc-900 rounded-xl border border-border", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Film className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">ציר הזמן של הסצנות</h3>
          {pipelineStage && (
            <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
              {pipelineStage}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {scenes.length} סצנות • {scenes.filter(s => s.status === 'COMPLETED').length} הושלמו
        </p>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedScene(scene)}
            >
              {/* Scene Number & Status */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {scene.sceneNumber}
                </div>
                {getStatusIcon(scene.status)}
              </div>

              {/* Scene Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">
                    סצנה {scene.sceneNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {scene.duration}s
                  </span>
                  {scene.qualityScore && (
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      scene.qualityScore >= 7 ? "bg-green-100 text-green-700" :
                      scene.qualityScore >= 4 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {scene.qualityScore}/10
                    </span>
                  )}
                </div>

                {scene.sceneDescription && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {scene.sceneDescription}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {getStatusText(scene.status)}
                  </span>
                  {scene.retryCount > 0 && (
                    <span className="text-xs text-orange-600">
                      ניסיון {scene.retryCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {scene.status === 'FAILED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerateScene(scene.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                    title="צור מחדש"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {scene.videoUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedScene(scene);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded transition-colors"
                    title="צפה בסצנה"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scene Preview Modal */}
      {selectedScene && (
        <ScenePreview
          scene={selectedScene}
          onClose={() => setSelectedScene(null)}
          onRegenerate={() => {
            onRegenerateScene(selectedScene.id);
            setSelectedScene(null);
          }}
        />
      )}
    </div>
  );
}