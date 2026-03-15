import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify video ownership
    const video = await prisma.video.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Set up SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial status
        const initialData = await getPipelineStatus(id);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`)
        );

        // Poll for updates every 5 seconds
        const interval = setInterval(async () => {
          try {
            const data = await getPipelineStatus(id);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );

            // Stop polling if pipeline is complete or failed
            if (data.pipelineStage === 'DONE' || data.status === 'FAILED') {
              clearInterval(interval);
              controller.close();
            }
          } catch (error) {
            console.error('Error in pipeline status stream:', error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                error: 'Failed to get pipeline status'
              })}\n\n`)
            );
            clearInterval(interval);
            controller.close();
          }
        }, 5000);

        // Clean up on client disconnect
        _request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error setting up pipeline status stream:', error);
    return NextResponse.json({
      error: "Failed to start pipeline status stream"
    }, { status: 500 });
  }
}

async function getPipelineStatus(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      scenes: {
        orderBy: { sceneNumber: 'asc' },
        select: {
          id: true,
          sceneNumber: true,
          status: true,
          qualityScore: true,
          retryCount: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!video) {
    throw new Error('Video not found');
  }

  // Calculate progress
  const completedScenes = video.scenes.filter(s => s.status === 'COMPLETED').length;
  const processingScenes = video.scenes.filter(s => s.status === 'PROCESSING').length;
  const failedScenes = video.scenes.filter(s => s.status === 'FAILED').length;

  let progress = 0;
  if (video.totalScenes && video.totalScenes > 0) {
    progress = Math.round((completedScenes / video.totalScenes) * 100);
  }

  return {
    videoId: video.id,
    status: video.status,
    pipelineStage: video.pipelineStage,
    progress,
    totalScenes: video.totalScenes || 0,
    completedScenes,
    processingScenes,
    failedScenes,
    scenes: video.scenes,
    estimatedTimeRemaining: estimateTimeRemaining(video.pipelineStage, processingScenes),
  };
}

function estimateTimeRemaining(pipelineStage: string | null, processingScenes: number): number | null {
  if (!pipelineStage) return null;

  switch (pipelineStage) {
    case 'PLANNING':
      return 30; // 30 seconds for planning
    case 'GENERATING':
      return processingScenes * 45; // ~45 seconds per scene generation
    case 'QA':
      return processingScenes * 15; // ~15 seconds per quality check
    case 'NARRATION':
      return processingScenes * 10; // ~10 seconds per scene narration
    case 'JOINING':
      return 60; // 1 minute for concatenation
    case 'DONE':
    case 'FAILED':
      return 0;
    default:
      return null;
  }
}