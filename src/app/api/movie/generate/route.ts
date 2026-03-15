import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runMoviePipeline } from "@/lib/movie-pipeline/state-machine";
import type { MovieBrief, PipelineOptions } from "@/lib/movie-pipeline/types";
import path from "path";

// In-memory store for active pipelines (movieId -> status)
// In production this would be Redis or database
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
    // We intercept the state machine's progress by watching the state file
    const stateDir = options.stateDir || "./output/state";

    const result = await runMoviePipeline(brief, {
      ...options,
      // We'll poll the state file from the status endpoint
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
    activePipelines.set(movieId, {
      stage: "FAILED",
      totalScenes: 0,
      completedScenes: 0,
      currentScene: 0,
      message: "",
      error: error instanceof Error ? error.message : "Pipeline failed",
    });
  }
}
