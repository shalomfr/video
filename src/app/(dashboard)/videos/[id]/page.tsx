"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VideoPlayer } from "@/components/video/video-player";
import { GenerationProgress } from "@/components/video/generation-progress";
import { SceneTimeline } from "@/components/video/scene-timeline";
import { LongVideoProgress } from "@/components/video/long-video-progress";
import { Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface VideoDetail {
  id: string;
  status: string;
  videoType: string;
  pipelineStage: string | null;
  videoUrl: string | null;
  prompt: string | null;
  model: string | null;
  duration: number | null;
  totalScenes: number | null;
  completedScenes: number | null;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    status: string;
    qualityScore?: number;
    retryCount: number;
    errorMessage?: string;
  }>;
  createdAt: string;
  completedAt: string | null;
  brief: {
    businessName: string | null;
    videoType: string | null;
    industry: string | null;
    style: string | null;
    mood: string | null;
  } | null;
}

export default function VideoDetailPage() {
  const params = useParams();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/videos/${params.id}`);
        if (res.ok) {
          const videoData = await res.json();
          setVideo(videoData);

          // Load scenes for long videos
          if (videoData.videoType === 'LONG') {
            const scenesRes = await fetch(`/api/videos/${params.id}/scenes`);
            if (scenesRes.ok) {
              const scenesData = await scenesRes.json();
              setScenes(scenesData.scenes || []);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">הסרטון לא נמצא</p>
      </div>
    );
  }

  const isGenerating =
    video.status === "PENDING" || video.status === "PROCESSING";

  const isLongVideo = video.videoType === 'LONG';
  const isLongVideoGenerating = isLongVideo && isGenerating;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/videos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לסרטונים
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        {video.brief?.businessName || "סרטון"}
      </h1>

      {isLongVideoGenerating ? (
        <LongVideoProgress
          videoId={video.id}
          onComplete={() => {
            // Reload video data when complete
            window.location.reload();
          }}
        />
      ) : isGenerating ? (
        <GenerationProgress
          videoId={video.id}
          onComplete={(videoUrl) => {
            setVideo((prev) =>
              prev ? { ...prev, status: "COMPLETED", videoUrl } : prev
            );
          }}
        />
      ) : video.status === "COMPLETED" && video.videoUrl ? (
        <VideoPlayer
          videoUrl={video.videoUrl}
          title={video.brief?.businessName as any}
        />
      ) : (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 text-center">
          <p className="text-destructive font-medium">יצירת הסרטון נכשלה</p>
          <p className="text-sm text-muted-foreground mt-1">
            ניתן לנסות שוב מהבריף
          </p>
        </div>
      )}

      {/* Scene Timeline for Long Videos */}
      {isLongVideo && scenes.length > 0 && (
        <div className="mt-8">
          <SceneTimeline
            scenes={scenes}
            pipelineStage={video.pipelineStage}
            onRegenerateScene={async (sceneId) => {
              try {
                await fetch(`/api/videos/${video.id}/scenes/${sceneId}/regenerate`, {
                  method: 'POST',
                });
                // Reload scenes
                const scenesRes = await fetch(`/api/videos/${video.id}/scenes`);
                if (scenesRes.ok) {
                  const scenesData = await scenesRes.json();
                  setScenes(scenesData.scenes || []);
                }
              } catch (error) {
                console.error('Failed to regenerate scene:', error);
              }
            }}
          />
        </div>
      )}

      {/* Brief details */}
      {video.brief && (
        <div className="mt-8 bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6">
          <h2 className="font-bold mb-4">פרטי הבריף</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {video.brief.businessName && (
              <div>
                <span className="text-muted-foreground">שם העסק:</span>
                <p className="font-medium">{video.brief.businessName}</p>
              </div>
            )}
            {video.brief.industry && (
              <div>
                <span className="text-muted-foreground">תחום:</span>
                <p className="font-medium">{video.brief.industry}</p>
              </div>
            )}
            {video.brief.videoType && (
              <div>
                <span className="text-muted-foreground">סוג סרטון:</span>
                <p className="font-medium">{video.brief.videoType}</p>
              </div>
            )}
            {video.brief.style && (
              <div>
                <span className="text-muted-foreground">סגנון:</span>
                <p className="font-medium">{video.brief.style}</p>
              </div>
            )}
            {video.brief.mood && (
              <div>
                <span className="text-muted-foreground">מצב רוח:</span>
                <p className="font-medium">{video.brief.mood}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">סוג סרטון:</span>
              <p className="font-medium">
                {video.videoType === 'LONG' ? 'ארוך' : 'קצר'}
              </p>
            </div>
            {video.duration && (
              <div>
                <span className="text-muted-foreground">אורך:</span>
                <p className="font-medium">{video.duration} שניות</p>
              </div>
            )}
            {video.totalScenes && (
              <div>
                <span className="text-muted-foreground">מספר סצנות:</span>
                <p className="font-medium">{video.totalScenes}</p>
              </div>
            )}
          </div>
          {video.prompt && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Prompt שנוצר:
              </span>
              <p className="text-sm mt-1 font-mono bg-muted p-3 rounded-xl" dir="ltr">
                {video.prompt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
