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
    const video = await prisma.video.findUnique({
      where: { id, userId: session.user.id },
      include: {
        scenes: {
          orderBy: { sceneNumber: 'asc' },
        },
      },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({
      video: {
        id: video.id,
        videoType: video.videoType,
        pipelineStage: video.pipelineStage,
        totalScenes: video.totalScenes,
        completedScenes: video.completedScenes,
      },
      scenes: video.scenes,
    });

  } catch (error) {
    console.error('Error fetching scenes:', error);
    return NextResponse.json({
      error: "Failed to fetch scenes"
    }, { status: 500 });
  }
}