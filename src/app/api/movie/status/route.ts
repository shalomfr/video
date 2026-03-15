import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";
import type { MovieState } from "@/lib/movie-pipeline/types";

// Import the in-memory pipeline tracker
// Note: This works because Next.js API routes share the same process
let activePipelines: Map<string, any>;
try {
  activePipelines = require("../generate/route").activePipelines;
} catch {
  activePipelines = new Map();
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("id");

  if (!movieId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  // Check in-memory status first
  const memStatus = activePipelines?.get(movieId);

  // Also try to read from state file for detailed info
  const stateDir = path.join(process.cwd(), "output", "state");
  const stateFiles = fs.existsSync(stateDir)
    ? fs.readdirSync(stateDir).filter((f) => f.endsWith(".json"))
    : [];

  // Find most recent state file
  let stateData: MovieState | null = null;
  for (const file of stateFiles.reverse()) {
    try {
      const content = fs.readFileSync(path.join(stateDir, file), "utf-8");
      const parsed = JSON.parse(content) as MovieState;
      // Match by checking if it's a recent state
      stateData = parsed;
      break;
    } catch {
      continue;
    }
  }

  // Build response from state file if available
  if (stateData) {
    const completedScenes = stateData.scenes.filter(
      (s) => s.status === "GENERATED"
    ).length;
    const currentScene = stateData.scenes.find(
      (s) => s.status === "PROCESSING"
    );

    return NextResponse.json({
      stage: memStatus?.stage === "DONE" || memStatus?.stage === "FAILED"
        ? memStatus.stage
        : stateData.stage,
      totalScenes: stateData.scenes.length,
      completedScenes,
      currentScene: currentScene?.sceneNumber || 0,
      message: memStatus?.message || `שלב: ${stateData.stage}`,
      movieId: stateData.id,
      error: memStatus?.error || stateData.error || undefined,
      outputPath: memStatus?.outputPath || stateData.finalVideoPath || undefined,
      scenes: stateData.scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        description: s.description,
        status: s.status,
        qualityScore: s.qualityScore,
      })),
    });
  }

  // Fallback to in-memory status
  if (memStatus) {
    return NextResponse.json({
      ...memStatus,
      movieId,
    });
  }

  return NextResponse.json({ error: "Movie not found" }, { status: 404 });
}
