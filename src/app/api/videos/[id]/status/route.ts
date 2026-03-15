import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVeoOperationStatus } from "@/lib/google-ai";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id, userId: session.user.id },
  });

  if (!video) {
    return new Response("Not found", { status: 404 });
  }

  // If video is already completed or failed, return immediately
  if (video.status === "COMPLETED" || video.status === "FAILED") {
    const data = JSON.stringify({
      status: video.status,
      videoUrl: video.videoUrl,
      message:
        video.status === "COMPLETED" ? "הסרטון מוכן!" : video.errorMessage,
    });
    return new Response(`data: ${data}\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const poll = async (): Promise<boolean> => {
        if (!video.runwayTaskId) {
          sendEvent({ status: "PENDING", message: "מכין את יצירת הסרטון..." });
          return true;
        }

        try {
          const opStatus = await getVeoOperationStatus(video.runwayTaskId);

          switch (opStatus.status) {
            case "PENDING":
              sendEvent({ status: "PENDING", message: "ממתין בתור..." });
              return true;

            case "RUNNING":
              sendEvent({
                status: "PROCESSING",
                message: "מייצר את הסרטון שלך...",
              });
              return true;

            case "SUCCEEDED": {
              await prisma.video.update({
                where: { id: video.id },
                data: {
                  status: "COMPLETED",
                  videoUrl: opStatus.output!,
                  completedAt: new Date(),
                },
              });

              if (video.conversationId) {
                await prisma.conversation.update({
                  where: { id: video.conversationId },
                  data: { status: "COMPLETED" },
                });
              }

              sendEvent({
                status: "COMPLETED",
                videoUrl: opStatus.output,
                message: "הסרטון מוכן!",
              });
              return false;
            }

            case "FAILED":
              await prisma.video.update({
                where: { id: video.id },
                data: {
                  status: "FAILED",
                  errorMessage: opStatus.failure || "יצירת הסרטון נכשלה",
                },
              });

              if (video.conversationId) {
                await prisma.conversation.update({
                  where: { id: video.conversationId },
                  data: { status: "FAILED" },
                });
              }

              sendEvent({
                status: "FAILED",
                message: "יצירת הסרטון נכשלה",
              });
              return false;

            default:
              sendEvent({ status: "PENDING", message: "בודק סטטוס..." });
              return true;
          }
        } catch (error) {
          console.error("Polling error:", error);
          sendEvent({ status: "PENDING", message: "בודק סטטוס..." });
          return true;
        }
      };

      let shouldContinue = true;
      let pollCount = 0;
      const maxPolls = 120; // ~10 minutes at 5-second intervals

      while (shouldContinue && pollCount < maxPolls) {
        shouldContinue = await poll();
        pollCount++;
        if (shouldContinue) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      if (pollCount >= maxPolls) {
        sendEvent({
          status: "FAILED",
          message: "חריגה מזמן ההמתנה המקסימלי",
        });
      }

      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
