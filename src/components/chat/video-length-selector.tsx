"use client";

import { useState } from "react";
import { Clock, Play, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoLengthOption {
  id: 'short' | 'long';
  title: string;
  description: string;
  duration: string;
  features: string[];
  icon: React.ReactNode;
  recommended?: boolean;
}

const VIDEO_OPTIONS: VideoLengthOption[] = [
  {
    id: 'short',
    title: 'סרטון קצר',
    description: 'סרטון קלאסי לרשתות חברתיות',
    duration: '5-10 שניות',
    features: [
      'מותאם לרילס/טיקטוק',
      'יצירה מהירה',
      'עלות נמוכה',
      'התאמה לפרסום דיגיטלי'
    ],
    icon: <Play className="w-5 h-5" />,
  },
  {
    id: 'long',
    title: 'סרטון ארוך',
    description: 'סרטון מלא עם מספר סצנות',
    duration: '45-144 שניות',
    features: [
      'עד 18 סצנות שונות',
      'תסריט מובנה ומקצועי',
      'איכות פרימיום',
      'מתאים לפרסום מורכב'
    ],
    icon: <Film className="w-5 h-5" />,
    recommended: true,
  },
];

interface VideoLengthSelectorProps {
  onSelect: (length: 'short' | 'long') => void;
  onSkip: () => void;
}

export function VideoLengthSelector({ onSelect, onSkip }: VideoLengthSelectorProps) {
  const [selected, setSelected] = useState<'short' | 'long' | null>(null);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl p-4 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h4 className="font-medium text-sm">בחירת אורך סרטון</h4>
      </div>

      <div className="space-y-3 mb-4">
        {VIDEO_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={cn(
              "w-full p-3 rounded-xl border text-right transition-all",
              selected === option.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                selected === option.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {option.icon}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-medium text-sm">{option.title}</h5>
                  {option.recommended && (
                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      מומלץ
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  {option.description}
                </p>

                <div className="flex items-center gap-1 mb-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium">{option.duration}</span>
                </div>

                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-muted-foreground rounded-full flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          אישור
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          דלג
        </button>
      </div>
    </div>
  );
}