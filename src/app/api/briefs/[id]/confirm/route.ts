import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoPrompt } from "@/lib/openrouter";
import { generateVideoSegment } from "@/lib/google-ai";

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

    // Delete existing video if exists (to handle re-confirmation)
    await prisma.video.deleteMany({
      where: { conversationId: brief.conversationId },
    });

    // Create video record
    // Note: For now, only support SHORT videos until database migration is complete
    const video = await prisma.video.create({
      data: {
        userId: session.user.id,
        briefId: id,
        conversationId: brief.conversationId,
        prompt: videoPrompt,
        model: "veo-3.1",
        duration: brief.videoLength || 5,
        ratio: "1280:720",
        status: "PENDING",
      },
    });

    // For now, all videos are processed as short videos with Runway ML
    // Long video support will be added once database migration is complete
    await prisma.conversation.update({
      where: { id: brief.conversationId },
      data: { status: "GENERATING" },
    });

    // Submit to Google Veo 3.1
    const taskId = await generateVideoSegment(
      videoPrompt,
      brief.logoUrl ? [brief.logoUrl] : undefined
    );

    // Update video with Veo operation ID
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

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error details:", error.message, error.stack);
    }

    return NextResponse.json(
      { error: "שגיאה בהתחלת יצירת הסרטון" },
      { status: 500 }
    );
  }
}
