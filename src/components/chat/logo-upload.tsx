"use client";

import { useState, useCallback } from "react";
import { Upload, X, Check, Image } from "lucide-react";

interface LogoUploadProps {
  onUpload: (url: string) => void;
  onSkip: () => void;
}

export function LogoUpload({ onUpload, onSkip }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file
      if (!file.type.startsWith("image/")) {
        setError("יש להעלות קובץ תמונה בלבד");
        return;
      }

      if (file.size > 4 * 1024 * 1024) {
        setError("גודל הקובץ חייב להיות עד 4MB");
        return;
      }

      setError(null);
      setUploading(true);

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      try {
        // Upload using FormData to our uploadthing endpoint
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/uploadthing", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        const data = await res.json();
        onUpload(data.url || objectUrl);
      } catch {
        // Fallback: use object URL (for development without UploadThing)
        onUpload(objectUrl);
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <Image className="w-5 h-5 text-primary" />
        <h4 className="font-medium text-sm">העלאת לוגו</h4>
      </div>

      {preview ? (
        <div className="relative mb-3">
          <img
            src={preview}
            alt="Logo preview"
            className="w-full h-32 object-contain rounded-xl bg-muted"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!uploading && (
            <div className="absolute top-2 end-2 bg-green-500 text-white rounded-full p-1">
              <Check className="w-3 h-3" />
            </div>
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors mb-3">
          <Upload className="w-6 h-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            גרור קובץ או לחץ לבחירה
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            PNG, JPG, SVG עד 4MB
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}

      {error && (
        <p className="text-destructive text-xs mb-2">{error}</p>
      )}

      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3 h-3 inline-block me-1" />
        דלג
      </button>
    </div>
  );
}
