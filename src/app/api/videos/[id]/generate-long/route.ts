import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planVideoScenes, generateVideoSegment } from "@/lib/google-ai";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get video and brief data
    const video = await prisma.video.findUnique({
      where: { id, userId: session.user.id },
      include: {
        brief: true,
        scenes: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (!video.brief) {
      return NextResponse.json({ error: "Video must have a brief" }, { status: 400 });
    }

    // Check if already processing
    if (video.pipelineStage && video.pipelineStage !== 'DONE') {
      return NextResponse.json({
        error: "Video is already being processed"
      }, { status: 409 });
    }

    // Update video to LONG type and start pipeline
    await prisma.video.update({
      where: { id },
      data: {
        videoType: 'LONG',
        pipelineStage: 'PLANNING',
        status: 'PROCESSING',
      },
    });

    // Start pipeline in background
    processLongVideoPipeline(video.id, video.brief);

    return NextResponse.json({
      success: true,
      message: "Long video generation started",
      videoId: video.id,
    });

  } catch (error) {
    console.error('Error starting long video generation:', error);

    // Reset video status on error
    await prisma.video.update({
      where: { id },
      data: {
        pipelineStage: null,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json({
      error: "Failed to start video generation"
    }, { status: 500 });
  }
}

async function processLongVideoPipeline(videoId: string, brief: Record<string, unknown>) {
  try {
    // Stage 1: Narrative Planning
    console.log(`Starting narrative planning for video ${videoId}`);

    const briefData = {
      businessName: brief.businessName,
      industry: brief.industry,
      businessDesc: brief.businessDesc,
      brandColors: brief.brandColors,
      style: brief.style,
      targetAudience: brief.targetAudience,
      videoLength: brief.videoLength,
      mood: brief.mood,
      additionalNotes: brief.additionalNotes,
    };

    const scriptPlan = await planVideoScenes(briefData);

    // Save script data
    await prisma.video.update({
      where: { id: videoId },
      data: {
        pipelineStage: 'GENERATING',
        scriptData: scriptPlan as any, // Prisma JSON field
      },
    });

    // Stage 2: Generate Scenes
    console.log(`Starting scene generation for video ${videoId}`);

    const scenes = [];
    for (const sceneData of scriptPlan.scenes) {
      try {
        // Create scene record
        const scene = await prisma.scene.create({
          data: {
            videoId,
            sceneNumber: sceneData.sceneNumber,
            prompt: sceneData.prompt,
            sceneDescription: sceneData.description,
            duration: sceneData.duration,
            status: 'PROCESSING',
          },
        });

        // Generate video segment
        const taskId = await generateVideoSegment(
          sceneData.prompt,
          brief.logoUrl ? [brief.logoUrl as string] : []
        );

        // Update scene with task ID
        await prisma.scene.update({
          where: { id: scene.id },
          data: {
            runwayTaskId: taskId,
          },
        });

        scenes.push(scene);

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to generate scene ${sceneData.sceneNumber}:`, error);
        // Continue with other scenes
      }
    }

    // Update video with scene count
    await prisma.video.update({
      where: { id: videoId },
      data: {
        totalScenes: scenes.length,
        completedScenes: 0,
      },
    });

    // Stage 3: Quality Check (will be handled by separate monitoring)
    await prisma.video.update({
      where: { id: videoId },
      data: {
        pipelineStage: 'QA',
      },
    });

    console.log(`Long video pipeline started for ${videoId}`);

  } catch (error) {
    console.error(`Pipeline failed for video ${videoId}:`, error);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        pipelineStage: 'FAILED',
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Pipeline failed',
      },
    });
  }
}