"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VideoPlayer } from "@/components/video/video-player";
import { GenerationProgress } from "@/components/video/generation-progress";
import { Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface VideoDetail {
  id: string;
  status: string;
  videoUrl: string | null;
  prompt: string | null;
  model: string | null;
  duration: number | null;
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/videos/${params.id}`);
        if (res.ok) setVideo(await res.json());
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

      {isGenerating ? (
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
          title={video.brief?.businessName || undefined}
        />
      ) : (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 text-center">
          <p className="text-destructive font-medium">יצירת הסרטון נכשלה</p>
          <p className="text-sm text-muted-foreground mt-1">
            ניתן לנסות שוב מהבריף
          </p>
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
            {video.duration && (
              <div>
                <span className="text-muted-foreground">אורך:</span>
                <p className="font-medium">{video.duration} שניות</p>
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
