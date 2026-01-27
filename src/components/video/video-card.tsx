"use client";

import Link from "next/link";
import { Film, Clock, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface VideoCardProps {
  id: string;
  status: string;
  businessName?: string | null;
  videoType?: string | null;
  duration?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  createdAt: string;
}

const statusMap: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "ממתין",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: <Clock className="w-3 h-3" />,
  },
  PROCESSING: {
    label: "בתהליך",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  COMPLETED: {
    label: "מוכן",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  FAILED: {
    label: "נכשל",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: <XCircle className="w-3 h-3" />,
  },
};

export function VideoCard({
  id,
  status,
  businessName,
  videoType,
  duration,
  thumbnailUrl,
  videoUrl,
  createdAt,
}: VideoCardProps) {
  const statusInfo = statusMap[status] || statusMap.PENDING;

  return (
    <Link
      href={`/videos/${id}`}
      className="group block bg-white dark:bg-zinc-900 rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {videoUrl && status === "COMPLETED" ? (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={businessName || "סרטון"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Status badge */}
        <div
          className={cn(
            "absolute top-2 start-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
            statusInfo.color
          )}
        >
          {statusInfo.icon}
          {statusInfo.label}
        </div>

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 end-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
            {duration}s
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
          {businessName || "סרטון ללא שם"}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {videoType && <span>{videoType}</span>}
          <span>
            {formatDistanceToNow(new Date(createdAt), {
              addSuffix: true,
              locale: he,
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
