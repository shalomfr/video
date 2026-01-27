import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractBriefFromConversation } from "@/lib/openrouter";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const briefs = await prisma.brief.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      conversation: { select: { title: true } },
      videos: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json(briefs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await request.json();

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  // Verify conversation belongs to user
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId: session.user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Check if brief already exists
  const existingBrief = await prisma.brief.findUnique({
    where: { conversationId },
  });

  if (existingBrief) {
    return NextResponse.json(existingBrief);
  }

  // Extract brief from conversation using AI
  const briefData = await extractBriefFromConversation(
    conversation.messages.map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }))
  );

  const brief = await prisma.brief.create({
    data: {
      conversationId,
      userId: session.user.id,
      videoType: briefData.videoType,
      businessName: briefData.businessName,
      industry: briefData.industry,
      businessDesc: briefData.businessDesc,
      brandColors: briefData.brandColors,
      style: briefData.style,
      targetAudience: briefData.targetAudience,
      videoLength: briefData.videoLength,
      mood: briefData.mood,
      additionalNotes: briefData.additionalNotes,
    },
  });

  // Update conversation title
  if (briefData.businessName) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: `סרטון - ${briefData.businessName}` },
    });
  }

  return NextResponse.json(brief, { status: 201 });
}
