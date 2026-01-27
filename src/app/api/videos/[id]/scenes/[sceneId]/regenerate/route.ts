import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoSegment } from "@/lib/google-ai";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sceneId } = await params;

  try {
    // Get scene and verify ownership
    const scene = await prisma.scene.findFirst({
      where: {
        id: sceneId,
        video: {
          id,
          userId: session.user.id,
        },
      },
      include: {
        video: {
          include: {
            brief: true,
          },
        },
      },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Check if video is still processing
    if (scene.video.pipelineStage === 'DONE') {
      return NextResponse.json({
        error: "Cannot regenerate scene for completed video"
      }, { status: 400 });
    }

    // Update scene status and increment retry count
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        status: 'PROCESSING',
        retryCount: { increment: 1 },
        videoUrl: null, // Clear old video
        errorMessage: null,
      },
    });

    // Generate new video segment
    const taskId = await generateVideoSegment(
      scene.prompt,
      scene.video.brief?.logoUrl ? [scene.video.brief.logoUrl] : undefined
    );

    // Update scene with new task ID
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        runwayTaskId: taskId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Scene regeneration started",
      sceneId,
      taskId,
    });

  } catch (error) {
    console.error('Error regenerating scene:', error);

    // Update scene status on error
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Regeneration failed',
      },
    });

    return NextResponse.json({
      error: "Failed to regenerate scene"
    }, { status: 500 });
  }
}