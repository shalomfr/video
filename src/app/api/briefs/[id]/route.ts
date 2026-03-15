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

  const brief = await prisma.brief.findUnique({
    where: { id, userId: session.user.id },
    include: {
      conversation: { select: { title: true } },
      videos: true,
    },
  });

  if (!brief) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(brief);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Whitelist allowed fields
  const allowedFields = [
    'businessName', 'industry', 'businessDesc', 'logoUrl',
    'brandColors', 'style', 'targetAudience', 'videoLength',
    'mood', 'additionalNotes', 'videoType',
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  const brief = await prisma.brief.update({
    where: { id, userId: session.user.id },
    data,
  });

  return NextResponse.json(brief);
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

  await prisma.brief.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
