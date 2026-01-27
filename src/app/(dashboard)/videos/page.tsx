"use client";

import { useEffect, useState } from "react";
import { Film, Loader2 } from "lucide-react";
import { VideoCard } from "@/components/video/video-card";

interface VideoItem {
  id: string;
  status: string;
  duration: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  brief: { businessName: string | null; videoType: string | null } | null;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/videos");
        if (res.ok) setVideos(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">הסרטונים שלי</h1>
        <p className="text-muted-foreground mt-1">
          כל הסרטונים שיצרת במקום אחד
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              id={video.id}
              status={video.status}
              businessName={video.brief?.businessName}
              videoType={video.brief?.videoType}
              duration={video.duration}
              thumbnailUrl={video.thumbnailUrl}
              videoUrl={video.videoUrl}
              createdAt={video.createdAt}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-16 text-center">
          <Film className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-1">אין סרטונים עדיין</h3>
          <p className="text-muted-foreground">
            הסרטונים שתיצור יופיעו כאן
          </p>
        </div>
      )}
    </div>
  );
}
