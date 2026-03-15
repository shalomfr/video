"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PipelineProgressEvent, PipelineStage } from "@/lib/movie-pipeline/types";

export interface MovieProgressState {
  stage: PipelineStage | null;
  events: PipelineProgressEvent[];
  latestMessage: string;
  totalScenes: number;
  completedScenes: number;
  isConnected: boolean;
  isDone: boolean;
  error: string | null;
}

interface UseMovieProgressReturn {
  state: MovieProgressState;
  connect: (movieId: string) => void;
  disconnect: () => void;
}

export function useMovieProgress(): UseMovieProgressReturn {
  const [state, setState] = useState<MovieProgressState>({
    stage: null,
    events: [],
    latestMessage: "",
    totalScenes: 0,
    completedScenes: 0,
    isConnected: false,
    isDone: false,
    error: null,
  });

  const movieIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback((movieId: string) => {
    // Disconnect previous if any
    abortRef.current?.abort();
    movieIdRef.current = movieId;

    setState({
      stage: null,
      events: [],
      latestMessage: "מתחבר...",
      totalScenes: 0,
      completedScenes: 0,
      isConnected: true,
      isDone: false,
      error: null,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    startSSE(movieId, controller);
  }, []);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    movieIdRef.current = null;
    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  async function startSSE(movieId: string, controller: AbortController) {
    try {
      const response = await fetch(`/api/movie/${movieId}/stream`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: `Connection failed: ${response.status}`,
        }));
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
            const event: PipelineProgressEvent = JSON.parse(line.slice(6));

            setState((prev) => {
              const newEvents = [...prev.events, event];

              // Track scene counts from meta
              let totalScenes = prev.totalScenes;
              let completedScenes = prev.completedScenes;

              if (event.meta?.totalScenes) totalScenes = event.meta.totalScenes as number;
              if (event.meta?.total) totalScenes = event.meta.total as number;
              if (event.meta?.generated) completedScenes = event.meta.generated as number;

              // Count generated scenes from scene_update events
              if (event.type === 'scene_update' && event.message.includes('generated')) {
                completedScenes = prev.completedScenes + 1;
              }

              const isDone = event.stage === "DONE" || event.stage === "FAILED";
              const error = event.stage === "FAILED" ? event.message : prev.error;

              return {
                stage: event.stage,
                events: newEvents,
                latestMessage: event.message,
                totalScenes,
                completedScenes,
                isConnected: !isDone,
                isDone,
                error,
              };
            });
          } catch {
            // Skip malformed lines (keepalive comments etc.)
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: `Connection lost: ${(err as Error).message}`,
        }));

        // Auto-reconnect after 3 seconds
        if (movieIdRef.current === movieId) {
          setTimeout(() => {
            if (movieIdRef.current === movieId) {
              const newController = new AbortController();
              abortRef.current = newController;
              startSSE(movieId, newController);
            }
          }, 3000);
        }
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, connect, disconnect };
}
