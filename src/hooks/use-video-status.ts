"use client";

import { useState, useEffect, useCallback } from "react";
import type { VideoStatusEvent } from "@/types/video";

interface UseVideoStatusReturn {
  status: VideoStatusEvent | null;
  isConnected: boolean;
  connect: (videoId: string) => void;
  disconnect: () => void;
}

export function useVideoStatus(): UseVideoStatusReturn {
  const [status, setStatus] = useState<VideoStatusEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  const connect = useCallback((id: string) => {
    setVideoId(id);
    setStatus(null);
  }, []);

  const disconnect = useCallback(() => {
    setVideoId(null);
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!videoId) return;

    let abortController: AbortController | null = new AbortController();
    setIsConnected(true);

    async function pollStatus() {
      try {
        const response = await fetch(`/api/videos/${videoId}/status`, {
          signal: abortController!.signal,
        });

        if (!response.ok) {
          setIsConnected(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data: VideoStatusEvent = JSON.parse(line.slice(6));
              setStatus(data);

              if (
                data.status === "COMPLETED" ||
                data.status === "FAILED"
              ) {
                setIsConnected(false);
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setIsConnected(false);
        }
      }
    }

    pollStatus();

    return () => {
      abortController?.abort();
      abortController = null;
    };
  }, [videoId]);

  return { status, isConnected, connect, disconnect };
}
