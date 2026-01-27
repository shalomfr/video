"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface BriefSummaryProps {
  conversationId: string;
  onConfirmed: (videoId: string) => void;
}

export function BriefSummary({
  conversationId,
  onConfirmed,
}: BriefSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Extract brief
      const briefRes = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (!briefRes.ok) throw new Error("Failed to extract brief");
      const brief = await briefRes.json();

      // Step 2: Confirm brief and start video generation
      const confirmRes = await fetch(`/api/briefs/${brief.id}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) throw new Error("Failed to confirm brief");
      const result = await confirmRes.json();

      onConfirmed(result.videoId);
    } catch {
      setError("שגיאה ביצירת הסרטון, נסה שוב");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-primary/20 rounded-2xl p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-primary" />
        <h4 className="font-medium text-sm">הבריף מוכן!</h4>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        כל המידע נאסף בהצלחה. לחץ על הכפתור כדי להתחיל ליצור את הסרטון שלך.
      </p>

      {error && (
        <p className="text-destructive text-xs mb-3">{error}</p>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full py-2.5 text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            מתחיל יצירת סרטון...
          </>
        ) : (
          "צור סרטון עכשיו"
        )}
      </button>
    </div>
  );
}
