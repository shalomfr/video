"use client";

import { useState } from "react";
import { X, RotateCcw, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ScenePreviewProps {
  scene: Scene;
  onClose: () => void;
  onRegenerate: () => void;
}

export function ScenePreview({ scene, onClose, onRegenerate }: ScenePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // In a real implementation, this would control the video element
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
    // In a real implementation, this would control video audio
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">סצנה {scene.sceneNumber}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            {scene.videoUrl ? (
              <div className="aspect-video">
                <video
                  src={scene.videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  poster="/api/placeholder/640/360"
                />

                {/* Custom Controls Overlay (optional enhancement) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayPause}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={handleMute}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 bg-white/20 rounded-full h-1">
                      <div className="bg-white h-full rounded-full w-1/3"></div>
                    </div>

                    <span className="text-white text-sm">0:05 / 0:08</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center bg-muted">
                <div className="text-center">
                  {scene.status === 'PROCESSING' ? (
                    <>
                      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">מעבד סצנה...</p>
                    </>
                  ) : scene.status === 'FAILED' ? (
                    <>
                      <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">יצירת הסצנה נכשלה</p>
                    </>
                  ) : (
                    <>
                      <Play className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">הסצנה טרם נוצרה</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scene Details */}
          <div className="space-y-4">
            {/* Status & Quality */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">סטטוס:</span>
                <span className={cn(
                  "px-2 py-1 text-xs rounded-full",
                  scene.status === 'COMPLETED' ? "bg-green-100 text-green-700" :
                  scene.status === 'PROCESSING' ? "bg-blue-100 text-blue-700" :
                  scene.status === 'FAILED' ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-700"
                )}>
                  {scene.status === 'COMPLETED' ? 'הושלם' :
                   scene.status === 'PROCESSING' ? 'מעבד' :
                   scene.status === 'FAILED' ? 'נכשל' : 'ממתין'}
                </span>
              </div>

              {scene.qualityScore && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">ציון איכות:</span>
                  <span className={cn(
                    "px-2 py-1 text-xs rounded-full",
                    scene.qualityScore >= 7 ? "bg-green-100 text-green-700" :
                    scene.qualityScore >= 4 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {scene.qualityScore}/10
                  </span>
                </div>
              )}

              {scene.retryCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">ניסיונות:</span>
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                    {scene.retryCount}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {scene.sceneDescription && (
              <div>
                <h4 className="text-sm font-medium mb-2">תיאור הסצנה:</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {scene.sceneDescription}
                </p>
              </div>
            )}

            {/* Prompt */}
            <div>
              <h4 className="text-sm font-medium mb-2">Prompt:</h4>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg font-mono">
                {scene.prompt}
              </p>
            </div>

            {/* Error Message */}
            {scene.errorMessage && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-600">שגיאה:</h4>
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  {scene.errorMessage}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-border">
              {scene.status === 'FAILED' && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  צור מחדש
                </button>
              )}

              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}