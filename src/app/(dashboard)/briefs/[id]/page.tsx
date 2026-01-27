"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Play, Film, Video } from "lucide-react";

interface VideoInfo {
  id: string;
  status: string;
}

interface BriefDetail {
  id: string;
  videoType: string | null;
  businessName: string | null;
  industry: string | null;
  businessDesc: string | null;
  logoUrl: string | null;
  brandColors: string[] | null;
  style: string | null;
  targetAudience: string | null;
  videoLength: number | null;
  mood: string | null;
  additionalNotes: string | null;
  generatedPrompt: string | null;
  isConfirmed: boolean;
  createdAt: string;
  videos?: VideoInfo[];
}

export default function BriefDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/briefs/${params.id}`);
        if (res.ok) setBrief(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const handleCreateVideo = async () => {
    if (!brief?.id) return;

    setGenerating(true);
    try {
      const confirmRes = await fetch(`/api/briefs/${brief.id}/confirm`, {
        method: "POST",
      });
      
      if (!confirmRes.ok) {
        const errorData = await confirmRes.json();
        throw new Error(errorData.error || "Failed to create video");
      }
      
      const result = await confirmRes.json();
      
      if (result.videoId) {
        router.push(`/videos/${result.videoId}`);
      } else {
        throw new Error("Video ID not returned");
      }
    } catch (error) {
      console.error("Failed to create video:", error);
      alert(error instanceof Error ? error.message : "שגיאה ביצירת סרטון");
    } finally {
      setGenerating(false);
    }
  };

  const hasExistingVideo = brief?.videos && brief.videos.length > 0;
  const latestVideo = hasExistingVideo ? brief.videos[0] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">הבריף לא נמצא</p>
      </div>
    );
  }

  const fields = [
    { label: "סוג סרטון", value: brief.videoType },
    { label: "שם העסק", value: brief.businessName },
    { label: "תחום", value: brief.industry },
    { label: "תיאור העסק", value: brief.businessDesc },
    { label: "סגנון", value: brief.style },
    { label: "קהל יעד", value: brief.targetAudience },
    { label: "אורך סרטון", value: brief.videoLength ? `${brief.videoLength} שניות` : null },
    { label: "מצב רוח", value: brief.mood },
    { label: "הערות", value: brief.additionalNotes },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/briefs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        חזרה לבריפים
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        {brief.businessName || "בריף"}
      </h1>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-6 space-y-4">
        {fields.map(
          (field) =>
            field.value && (
              <div key={field.label}>
                <span className="text-sm text-muted-foreground">
                  {field.label}
                </span>
                <p className="font-medium">{field.value}</p>
              </div>
            )
        )}

        {brief.logoUrl && (
          <div>
            <span className="text-sm text-muted-foreground">לוגו</span>
            <img
              src={brief.logoUrl}
              alt="Logo"
              className="w-20 h-20 object-contain rounded-xl bg-muted mt-1"
            />
          </div>
        )}

        {brief.brandColors && brief.brandColors.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">צבעי מותג</span>
            <div className="flex gap-2 mt-1">
              {brief.brandColors.map((color: string) => (
                <div
                  key={color}
                  className="w-8 h-8 rounded-lg border border-border"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}

        {brief.generatedPrompt && (
          <div className="pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Prompt שנוצר
            </span>
            <p
              className="text-sm mt-1 font-mono bg-muted p-3 rounded-xl"
              dir="ltr"
            >
              {brief.generatedPrompt}
            </p>
          </div>
        )}
      </div>

      {/* Create Video Button */}
      <div className="mt-6 space-y-4">
        {/* Show existing video if any */}
        {hasExistingVideo && latestVideo && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Video className="w-5 h-5" />
                <span className="font-medium">
                  סרטון קיים - {latestVideo.status === "COMPLETED" ? "מוכן" : 
                              latestVideo.status === "PROCESSING" ? "בתהליך יצירה" :
                              latestVideo.status === "FAILED" ? "נכשל" : "ממתין"}
                </span>
              </div>
              <Link
                href={`/videos/${latestVideo.id}`}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                צפה בסרטון
              </Link>
            </div>
          </div>
        )}

        {/* Create new video button */}
        <button
          onClick={handleCreateVideo}
          disabled={generating}
          className="w-full bg-primary text-primary-foreground rounded-xl p-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              יוצר סרטון...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              {hasExistingVideo ? "צור סרטון חדש" : "צור סרטון"}
            </>
          )}
        </button>
        
        {brief.videoLength && (
          <p className="text-xs text-muted-foreground text-center">
            אורך הסרטון: {brief.videoLength} שניות
          </p>
        )}
      </div>

      {/* Confirmation status */}
      {brief.isConfirmed && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <ArrowRight className="w-4 h-4" />
            <span className="text-sm font-medium">הבריף אושר</span>
          </div>
        </div>
      )}
    </div>
  );
}
