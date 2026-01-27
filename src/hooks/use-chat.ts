"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatStreamEvent } from "@/types/chat";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  triggers: string[];
  sendMessage: (message: string) => Promise<void>;
  clearTriggers: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat(conversationId: string | null): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!conversationId || !message.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add placeholder for AI response
      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      try {
        abortRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6);
            if (!data) continue;

            try {
              const parsed: ChatStreamEvent = JSON.parse(data);

              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: m.content + parsed.text }
                      : m
                  )
                );
              }

              if (parsed.event && parsed.event !== "DONE") {
                setTriggers((prev) => [...prev, parsed.event!]);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Clean trigger markers from displayed message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: m.content
                    .replace(/\[TRIGGER:LOGO_UPLOAD\]/g, "")
                    .replace(/\[TRIGGER:COLOR_PICKER\]/g, "")
                    .replace(/\[BRIEF_CONFIRMED\]/g, "")
                    .trim(),
                }
              : m
          )
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("שגיאה בשליחת ההודעה, נסה שוב");
          // Remove empty AI message on error
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [conversationId, isLoading]
  );

  const clearTriggers = useCallback(() => {
    setTriggers([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    triggers,
    sendMessage,
    clearTriggers,
    setMessages,
  };
}
