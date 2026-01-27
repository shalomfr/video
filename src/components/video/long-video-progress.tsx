"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, AlertTriangle, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineStatus {
  videoId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  pipelineStage: string | null;
  progress: number;
  totalScenes: number;
  completedScenes: number;
  processingScenes: number;
  failedScenes: number;
  scenes: Array<{
    id: string;
    sceneNumber: number;
    status: string;
    qualityScore?: number;
    retryCount: number;
    errorMessage?: string;
  }>;
  estimatedTimeRemaining: number | null;
}

interface LongVideoProgressProps {
  videoId: string;
  onComplete?: () => void;
  className?: string;
}

const PIPELINE_STAGES = [
  { key: 'PLANNING', label: 'תכנון נרטיבי', icon: '📝' },
  { key: 'GENERATING', label: 'יצירת סצנות', icon: '🎬' },
  { key: 'QA', label: 'בקרת איכות', icon: '✅' },
  { key: 'JOINING', label: 'חיבור סגמנטים', icon: '🔗' },
  { key: 'DONE', label: 'הושלם', icon: '🎉' },
];

export function LongVideoProgress({ videoId, onComplete, className }: LongVideoProgressProps) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/videos/${videoId}/pipeline-status`);

      eventSource.onmessage = (event) => {
        try {
          const data: PipelineStatus = JSON.parse(event.data);
          setStatus(data);
          setError(null);

          // Call onComplete when done
          if (data.pipelineStage === 'DONE' && onComplete) {
            onComplete();
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
          setError('שגיאה בקבלת סטטוס');
        }
      };

      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event);
        setError('בעיית חיבור - מנסה להתחבר מחדש...');

        // Retry connection after 5 seconds
        setTimeout(() => {
          if (eventSource) {
            eventSource.close();
            connectSSE();
          }
        }, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [videoId, onComplete]);

  const getStageStatus = (stageKey: string) => {
    if (!status) return 'pending';

    const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === status.pipelineStage);
    const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === stageKey);

    if (stageIndex < currentStageIndex) return 'completed';
    if (stageIndex === currentStageIndex) return 'active';
    return 'pending';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} שניות`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={cn("bg-white dark:bg-zinc-900 border border-border rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">שגיאה</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn("bg-white dark:bg-zinc-900 border border-border rounded-xl p-4", className)}>
        <div className="flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
          <span className="text-sm">טוען סטטוס...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-zinc-900 border border-border rounded-xl p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">יצירת סרטון ארוך</h3>
        </div>

        <div className="flex items-center gap-2">
          {status.status === 'COMPLETED' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : status.status === 'FAILED' ? (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          ) : (
            <Clock className="w-5 h-5 text-blue-500" />
          )}

          <span className="text-sm font-medium">
            {status.status === 'COMPLETED' ? 'הושלם' :
             status.status === 'FAILED' ? 'נכשל' :
             status.status === 'PROCESSING' ? 'מעבד' : 'ממתין'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span>התקדמות</span>
          <span>{status.progress}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="space-y-2 mb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageStatus = getStageStatus(stage.key);

          return (
            <div
              key={stage.key}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                stageStatus === 'active' && "bg-primary/5 border border-primary/20",
                stageStatus === 'completed' && "bg-green-50 dark:bg-green-900/20"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-sm",
                stageStatus === 'completed' ? "bg-green-500 text-white" :
                stageStatus === 'active' ? "bg-primary text-primary-foreground animate-pulse" :
                "bg-muted text-muted-foreground"
              )}>
                {stageStatus === 'completed' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : stageStatus === 'active' ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  stage.icon
                )}
              </div>

              <span className={cn(
                "text-sm",
                stageStatus === 'completed' ? "text-green-700 dark:text-green-300" :
                stageStatus === 'active' ? "font-medium text-primary" :
                "text-muted-foreground"
              )}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scene Statistics */}
      {status.totalScenes > 0 && (
        <div className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-primary">{status.totalScenes}</div>
            <div className="text-xs text-muted-foreground">סה״כ סצנות</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">{status.completedScenes}</div>
            <div className="text-xs text-muted-foreground">הושלמו</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">{status.processingScenes}</div>
            <div className="text-xs text-muted-foreground">מעובדות</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{status.failedScenes}</div>
            <div className="text-xs text-muted-foreground">נכשלו</div>
          </div>
        </div>
      )}

      {/* Estimated Time */}
      {status.estimatedTimeRemaining && status.estimatedTimeRemaining > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>זמן משוער שנותר: {formatTime(status.estimatedTimeRemaining)}</span>
        </div>
      )}

      {/* Completion Message */}
      {status.pipelineStage === 'DONE' && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">הסרטון הושלם בהצלחה!</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            כל הסצנות נוצרו וחוברו לסרטון מלא
          </p>
        </div>
      )}
    </div>
  );
}