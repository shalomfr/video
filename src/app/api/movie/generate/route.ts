import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runMoviePipeline } from "@/lib/movie-pipeline/state-machine";
import type { MovieBrief, PipelineOptions, PipelineProgressEvent } from "@/lib/movie-pipeline/types";
import { getEmitter, emitProgress, removeEmitter } from "@/lib/movie-pipeline/progress-emitter";
import path from "path";

// In-memory store for active pipelines (movieId -> status)
const activePipelines = new Map<
  string,
  {
    stage: string;
    totalScenes: number;
    completedScenes: number;
    currentScene: number;
    message: string;
    error?: string;
    outputPath?: string;
    scenes?: {
      sceneNumber: number;
      description: string;
      status: string;
      qualityScore: number | null;
    }[];
  }
>();

// Export for status route
export { activePipelines };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { brief, dryRun } = body as {
      brief: MovieBrief;
      dryRun?: boolean;
    };

    if (!brief?.title || !brief?.description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const outputDir = path.join(process.cwd(), "output");
    const options: PipelineOptions = {
      dryRun: dryRun || false,
      outputDir,
      stateDir: path.join(outputDir, "state"),
    };

    // Generate a temp movieId for tracking
    const movieId = Math.random().toString(36).slice(2, 10);

    // Initialize the emitter for SSE streaming
    getEmitter(movieId);

    // Set initial status
    activePipelines.set(movieId, {
      stage: "NARRATIVE_PLANNING",
      totalScenes: 0,
      completedScenes: 0,
      currentScene: 0,
      message: "מתחיל תכנון...",
    });

    // Run pipeline in background (don't await)
    runPipelineWithTracking(movieId, brief, options);

    return NextResponse.json({
      success: true,
      movieId,
      message: "Pipeline started",
    });
  } catch (error) {
    console.error("Error starting movie pipeline:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start pipeline",
      },
      { status: 500 }
    );
  }
}

async function runPipelineWithTracking(
  movieId: string,
  brief: MovieBrief,
  options: PipelineOptions
) {
  try {
    const result = await runMoviePipeline(brief, {
      ...options,
      onProgress: (event: PipelineProgressEvent) => {
        // Emit to SSE stream
        const emitter = getEmitter(movieId);
        emitter.emit('progress', event);

        // Also update in-memory status for fallback polling
        activePipelines.set(movieId, {
          stage: event.stage,
          totalScenes: (event.meta?.total as number) || activePipelines.get(movieId)?.totalScenes || 0,
          completedScenes: (event.meta?.generated as number) || activePipelines.get(movieId)?.completedScenes || 0,
          currentScene: event.sceneNumber || activePipelines.get(movieId)?.currentScene || 0,
          message: event.message,
        });
      },
    });

    // Emit final done event
    emitProgress(movieId, 'DONE', 'stage_end', 'הסרט מוכן!', {
      meta: { outputPath: result },
    });

    activePipelines.set(movieId, {
      stage: "DONE",
      totalScenes: 0,
      completedScenes: 0,
      currentScene: 0,
      message: "הסרט מוכן!",
      outputPath: result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Pipeline failed";

    emitProgress(movieId, 'FAILED', 'error', errorMsg);

    activePipelines.set(movieId, {
      stage: "FAILED",
      totalScenes: 0,
      completedScenes: 0,
      currentScene: 0,
      message: "",
      error: errorMsg,
    });
  } finally {
    // Clean up emitter after 30 seconds (give SSE clients time to receive final event)
    setTimeout(() => removeEmitter(movieId), 30000);
  }
}
