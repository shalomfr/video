"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Play, Film } from "lucide-react";

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

  const handleCreateLongVideo = async () => {
    if (!brief?.id) return;

    setGenerating(true);
    try {
      // First confirm the brief if not already confirmed
      if (!brief.isConfirmed) {
        const confirmRes = await fetch(`/api/briefs/${brief.id}/confirm`, {
          method: "POST",
        });
        if (!confirmRes.ok) throw new Error("Failed to confirm brief");
      }

      // Find the video that was created
      const briefRes = await fetch(`/api/briefs/${brief.id}`);
      if (!briefRes.ok) throw new Error("Failed to get brief");
      const updatedBrief = await briefRes.json();

      // Find the long video
      const videosRes = await fetch("/api/videos");
      if (!videosRes.ok) throw new Error("Failed to get videos");
      const videos = await videosRes.json();

      const longVideo = videos.find((v: any) =>
        v.briefId === brief.id && v.videoType === "LONG"
      );

      if (longVideo) {
        // Start the long video generation
        const generateRes = await fetch(`/api/videos/${longVideo.id}/generate-long`, {
          method: "POST",
        });

        if (generateRes.ok) {
          router.push(`/videos/${longVideo.id}`);
        } else {
          throw new Error("Failed to start video generation");
        }
      } else {
        throw new Error("Long video not found");
      }
    } catch (error) {
      console.error("Failed to create long video:", error);
      alert("שגיאה ביצירת סרטון ארוך");
    } finally {
      setGenerating(false);
    }
  };

  const isLongVideo = brief && brief.isConfirmed && brief.videoLength && brief.videoLength >= 45;

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

      {/* Create Long Video Button */}
      {isLongVideo && (
        <div className="mt-6">
          <button
            onClick={handleCreateLongVideo}
            disabled={generating}
            className="w-full bg-primary text-primary-foreground rounded-xl p-4 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                יוצר סרטון ארוך...
              </>
            ) : (
              <>
                <Film className="w-5 h-5" />
                צור סרטון ארוך
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            יצירת סרטון ארוך עלולה לקחת 10-20 דקות ועלותו כ-$45
          </p>
        </div>
      )}

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
