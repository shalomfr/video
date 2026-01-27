"use client";

import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#F43F5E", "#000000", "#FFFFFF", "#6B7280",
];

interface ColorPickerProps {
  onSelect: (colors: string[]) => void;
  onSkip: () => void;
}

export function ColorPicker({ onSelect, onSkip }: ColorPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  function toggleColor(color: string) {
    setSelected((prev) =>
      prev.includes(color)
        ? prev.filter((c) => c !== color)
        : prev.length < 4
        ? [...prev, color]
        : prev
    );
  }

  function addCustomColor() {
    const hex = custom.startsWith("#") ? custom : `#${custom}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex) && !selected.includes(hex)) {
      setSelected((prev) => (prev.length < 4 ? [...prev, hex] : prev));
      setCustom("");
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-5 h-5 text-primary" />
        <h4 className="font-medium text-sm">בחירת צבעי מותג</h4>
        <span className="text-xs text-muted-foreground">(עד 4)</span>
      </div>

      <div className="grid grid-cols-10 gap-1.5 mb-3">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => toggleColor(color)}
            className={cn(
              "w-7 h-7 rounded-lg border-2 transition-all relative",
              selected.includes(color)
                ? "border-primary scale-110"
                : "border-transparent hover:scale-105",
              color === "#FFFFFF" && "border-border"
            )}
            style={{ backgroundColor: color }}
          >
            {selected.includes(color) && (
              <Check
                className={cn(
                  "w-3 h-3 absolute inset-0 m-auto",
                  color === "#FFFFFF" || color === "#F59E0B" || color === "#EAB308"
                    ? "text-black"
                    : "text-white"
                )}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#HEX"
          maxLength={7}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          dir="ltr"
        />
        <button
          onClick={addCustomColor}
          className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors"
        >
          הוסף
        </button>
      </div>

      {selected.length > 0 && (
        <div className="flex gap-2 mb-3">
          {selected.map((color) => (
            <div
              key={color}
              className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg"
            >
              <div
                className="w-4 h-4 rounded border border-border"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs" dir="ltr">
                {color}
              </span>
              <button
                onClick={() =>
                  setSelected((prev) => prev.filter((c) => c !== color))
                }
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => selected.length > 0 && onSelect(selected)}
          disabled={selected.length === 0}
          className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          אישור ({selected.length})
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
