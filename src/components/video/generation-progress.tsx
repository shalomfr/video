"use client";

import { useEffect } from "react";
import { useVideoStatus } from "@/hooks/use-video-status";
import { Loader2, CheckCircle, XCircle, Film } from "lucide-react";

interface GenerationProgressProps {
  videoId: string;
  onComplete?: (videoUrl: string) => void;
}

export function GenerationProgress({
  videoId,
  onComplete,
}: GenerationProgressProps) {
  const { status, connect } = useVideoStatus();

  useEffect(() => {
    connect(videoId);
  }, [videoId, connect]);

  useEffect(() => {
    if (status?.status === "COMPLETED" && status.videoUrl && onComplete) {
      onComplete(status.videoUrl);
    }
  }, [status, onComplete]);

  const statusConfig = {
    PENDING: {
      icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
      title: "ממתין בתור...",
      description: "הבקשה שלך בתור, הסרטון יתחיל להיווצר בקרוב",
    },
    PROCESSING: {
      icon: <Film className="w-12 h-12 text-primary animate-pulse" />,
      title: "מייצר את הסרטון שלך...",
      description: "הבינה המלאכותית עובדת על הסרטון, זה עשוי לקחת כמה דקות",
    },
    COMPLETED: {
      icon: <CheckCircle className="w-12 h-12 text-green-500" />,
      title: "הסרטון מוכן!",
      description: "הסרטון שלך נוצר בהצלחה",
    },
    FAILED: {
      icon: <XCircle className="w-12 h-12 text-destructive" />,
      title: "יצירת הסרטון נכשלה",
      description: status?.message || "אירעה שגיאה, נסה שוב מאוחר יותר",
    },
  };

  const currentStatus = status?.status || "PENDING";
  const config = statusConfig[currentStatus];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {config.icon}
      <h2 className="text-xl font-bold mt-6 mb-2">{config.title}</h2>
      <p className="text-muted-foreground max-w-md">{config.description}</p>

      {(currentStatus === "PENDING" || currentStatus === "PROCESSING") && (
        <div className="mt-8 w-64">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
    </div>
  );
}
