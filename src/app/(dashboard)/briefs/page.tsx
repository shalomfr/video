"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface BriefItem {
  id: string;
  businessName: string | null;
  videoType: string | null;
  industry: string | null;
  isConfirmed: boolean;
  createdAt: string;
  conversation: { title: string | null };
  videos: { id: string; status: string }[];
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/briefs");
        if (res.ok) setBriefs(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">בריפים</h1>
        <p className="text-muted-foreground mt-1">
          כל הבריפים שנוצרו מהשיחות שלך
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : briefs.length > 0 ? (
        <div className="space-y-3">
          {briefs.map((brief) => (
            <Link
              key={brief.id}
              href={`/briefs/${brief.id}`}
              className="block bg-white dark:bg-zinc-900 rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">
                      {brief.businessName || "בריף ללא שם"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {brief.videoType && <span>{brief.videoType}</span>}
                      {brief.industry && (
                        <>
                          <span>•</span>
                          <span>{brief.industry}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(brief.createdAt), {
                          addSuffix: true,
                          locale: he,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {brief.videos.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-lg">
                      {brief.videos.length} סרטונים
                    </span>
                  )}
                  {brief.isConfirmed && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg">
                      מאושר
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border p-16 text-center">
          <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-1">אין בריפים עדיין</h3>
          <p className="text-muted-foreground">
            צור שיחה חדשה כדי לבנות בריף
          </p>
        </div>
      )}
    </div>
  );
}
