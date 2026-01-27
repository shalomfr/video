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

  const video = await prisma.video.findUnique({
    where: { id, userId: session.user.id },
    include: {
      brief: true,
      conversation: { select: { title: true } },
      scenes: {
        orderBy: { sceneNumber: 'asc' },
      },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.video.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
