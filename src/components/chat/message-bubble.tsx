"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex gap-3 max-w-[85%]", isUser ? "ms-auto" : "me-auto")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-ee-md"
            : "bg-muted rounded-es-md"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center">
          <User className="w-4 h-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
