"use client";

import { Download } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
}

export function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          src={videoUrl}
          controls
          className="w-full aspect-video"
          playsInline
        />
      </div>

      <div className="flex items-center justify-between">
        {title && <h3 className="font-medium">{title}</h3>}
        <a
          href={videoUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Download className="w-4 h-4" />
          הורד סרטון
        </a>
      </div>
    </div>
  );
}
