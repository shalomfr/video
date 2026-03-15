"use client";

import { useState, useCallback, useEffect } from "react";
import type { PipelineProgressEvent } from "@/lib/movie-pipeline/types";

export interface SavedProject {
  id: string;
  movieId: string;
  title: string;
  genre: string;
  stage: string;
  totalScenes: number;
  completedScenes: number;
  events: PipelineProgressEvent[];
  scenes: SavedScene[];
  createdAt: string;
  updatedAt: string;
  finalVideoPath?: string;
}

export interface SavedScene {
  sceneNumber: number;
  description: string;
  status: string;
  prompt?: string;
  narrationText?: string;
  qualityScore?: number | null;
}

const STORAGE_KEY = "movie-projects";

function getProjects(): SavedProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setProjects(projects: SavedProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function useMovieProjects() {
  const [projects, setProjectsState] = useState<SavedProject[]>([]);

  // Load on mount
  useEffect(() => {
    setProjectsState(getProjects());
  }, []);

  const saveProject = useCallback(
    (project: Omit<SavedProject, "updatedAt">) => {
      const all = getProjects();
      const idx = all.findIndex((p) => p.id === project.id);
      const updated = { ...project, updatedAt: new Date().toISOString() };

      if (idx >= 0) {
        all[idx] = updated;
      } else {
        all.unshift(updated);
      }

      // Keep max 20 projects
      const trimmed = all.slice(0, 20);
      setProjects(trimmed);
      setProjectsState(trimmed);
    },
    []
  );

  const loadProject = useCallback((id: string): SavedProject | null => {
    return getProjects().find((p) => p.id === id) || null;
  }, []);

  const deleteProject = useCallback((id: string) => {
    const filtered = getProjects().filter((p) => p.id !== id);
    setProjects(filtered);
    setProjectsState(filtered);
  }, []);

  return { projects, saveProject, loadProject, deleteProject };
}
