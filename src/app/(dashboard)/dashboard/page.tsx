"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Film, FileText, Loader2 } from "lucide-react";
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

export default function DashboardPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/videos");
        if (res.ok) {
          const data = await res.json();
          setVideos(data);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const recentVideos = videos.slice(0, 6);
  const completedCount = videos.filter((v) => v.status === "COMPLETED").length;
  const processingCount = videos.filter(
    (v) => v.status === "PROCESSING" || v.status === "PENDING"
  ).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">דשבורד</h1>
          <p className="text-muted-foreground mt-1">ברוך הבא חזרה!</p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          סרטון חדש
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Film className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{videos.length}</p>
              <p className="text-sm text-muted-foreground">סה״כ סרטונים</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Film className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">הושלמו</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{processingCount}</p>
              <p className="text-sm text-muted-foreground">בתהליך</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">סרטונים אחרונים</h2>
          {videos.length > 6 && (
            <Link
              href="/videos"
              className="text-sm text-primary hover:underline"
            >
              הצג הכל
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : recentVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentVideos.map((video) => (
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-12 text-center">
            <Film className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-medium mb-1">אין סרטונים עדיין</h3>
            <p className="text-sm text-muted-foreground mb-4">
              צור את הסרטון הראשון שלך בעזרת AI
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              צור סרטון
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
