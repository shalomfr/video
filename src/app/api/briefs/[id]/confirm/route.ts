import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoPrompt } from "@/lib/openrouter";
import { createVideoFromImage, createVideoFromText } from "@/lib/runway";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const brief = await prisma.brief.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  try {
    // Mark brief as confirmed
    await prisma.brief.update({
      where: { id },
      data: { isConfirmed: true },
    });

    // Generate optimized English prompt for Runway
    const videoPrompt = await generateVideoPrompt({
      videoType: brief.videoType,
      businessName: brief.businessName,
      industry: brief.industry,
      businessDesc: brief.businessDesc,
      brandColors: brief.brandColors,
      style: brief.style,
      targetAudience: brief.targetAudience,
      videoLength: brief.videoLength,
      mood: brief.mood,
    });

    // Save prompt to brief
    await prisma.brief.update({
      where: { id },
      data: { generatedPrompt: videoPrompt },
    });

    // Create video record
    const video = await prisma.video.create({
      data: {
        userId: session.user.id,
        briefId: id,
        conversationId: brief.conversationId,
        prompt: videoPrompt,
        model: brief.logoUrl ? "gen4_turbo" : "gen4_turbo",
        duration: brief.videoLength || 5,
        ratio: "1280:720",
        status: "PENDING",
      },
    });

    // Update conversation status
    await prisma.conversation.update({
      where: { id: brief.conversationId },
      data: { status: "GENERATING" },
    });

    // Submit to Runway ML
    let taskId: string;
    if (brief.logoUrl) {
      taskId = await createVideoFromImage(
        videoPrompt,
        brief.logoUrl,
        brief.videoLength || 5
      );
    } else {
      taskId = await createVideoFromText(
        videoPrompt,
        brief.videoLength || 5
      );
    }

    // Update video with Runway task ID
    await prisma.video.update({
      where: { id: video.id },
      data: { runwayTaskId: taskId, status: "PROCESSING" },
    });

    return NextResponse.json({
      videoId: video.id,
      message: "יצירת הסרטון החלה",
    });
  } catch (error) {
    console.error("Video generation error:", error);

    return NextResponse.json(
      { error: "שגיאה בהתחלת יצירת הסרטון" },
      { status: 500 }
    );
  }
}
