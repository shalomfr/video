import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamChatResponse } from "@/lib/openrouter";
import { SYSTEM_PROMPT } from "@/lib/prompts/system-prompt";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId, message } = await request.json();

  if (!conversationId || !message) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Verify conversation belongs to user
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId, userId: session.user.id },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId,
      role: "USER",
      content: message,
    },
  });

  // Load conversation history
  const dbMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...dbMessages.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant",
        content: m.content,
      })),
    ];

  // Stream response from OpenRouter
  const stream = await streamChatResponse(messages);

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      let fullContent = "";

      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullContent += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Save complete AI message to DB
        await prisma.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: fullContent,
          },
        });

        // Check for triggers
        if (fullContent.includes("[TRIGGER:LOGO_UPLOAD]")) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ event: "LOGO_UPLOAD" })}\n\n`
            )
          );
        }
        if (fullContent.includes("[TRIGGER:COLOR_PICKER]")) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ event: "COLOR_PICKER" })}\n\n`
            )
          );
        }
        if (fullContent.includes("[BRIEF_CONFIRMED]")) {
          // Update conversation status
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: "BRIEF_READY" },
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ event: "BRIEF_CONFIRMED" })}\n\n`
            )
          );
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event: "DONE" })}\n\n`)
        );
      } catch (error) {
        console.error("Chat stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "שגיאה בתקשורת עם ה-AI" })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
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
