"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { LogoUpload } from "./logo-upload";
import { ColorPicker } from "./color-picker";
import { BriefSummary } from "./brief-summary";
import { useChat } from "@/hooks/use-chat";

export function ChatContainer() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBriefSummary, setShowBriefSummary] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { messages, isLoading, error, triggers, sendMessage, clearTriggers } =
    useChat(conversationId);

  // Create conversation on mount
  useEffect(() => {
    if (initialized) return;

    async function createConversation() {
      try {
        const res = await fetch("/api/conversations", { method: "POST" });
        if (!res.ok) throw new Error("Failed to create conversation");
        const data = await res.json();
        setConversationId(data.id);
        setInitialized(true);
      } catch {
        console.error("Failed to create conversation");
      }
    }

    createConversation();
  }, [initialized]);

  // Send initial greeting when conversation is created
  useEffect(() => {
    if (conversationId && initialized && messages.length === 0) {
      sendMessage("שלום, אני רוצה ליצור סרטון");
    }
  }, [conversationId, initialized, messages.length, sendMessage]);

  // Watch for triggers
  useEffect(() => {
    if (triggers.length === 0) return;

    const lastTrigger = triggers[triggers.length - 1];

    if (lastTrigger === "LOGO_UPLOAD") {
      setShowLogoUpload(true);
    }
    if (lastTrigger === "COLOR_PICKER") {
      setShowColorPicker(true);
    }
    if (lastTrigger === "BRIEF_CONFIRMED") {
      setShowBriefSummary(true);
    }

    clearTriggers();
  }, [triggers, clearTriggers]);

  const handleLogoUploaded = useCallback(
    (url: string) => {
      setShowLogoUpload(false);
      sendMessage(`העליתי את הלוגו שלי: ${url}`);
    },
    [sendMessage]
  );

  const handleLogoSkip = useCallback(() => {
    setShowLogoUpload(false);
    sendMessage("אני מדלג על העלאת לוגו");
  }, [sendMessage]);

  const handleColorsSelected = useCallback(
    (colors: string[]) => {
      setShowColorPicker(false);
      sendMessage(`הצבעים שבחרתי: ${colors.join(", ")}`);
    },
    [sendMessage]
  );

  const handleColorSkip = useCallback(() => {
    setShowColorPicker(false);
    sendMessage("אין לי צבעי מותג מוגדרים, בחר צבעים מתאימים");
  }, [sendMessage]);

  const handleVideoConfirmed = useCallback(
    (videoId: string) => {
      router.push(`/videos/${videoId}`);
    },
    [router]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Interactive widgets */}
      <div className="px-4 space-y-3">
        {showLogoUpload && (
          <LogoUpload onUpload={handleLogoUploaded} onSkip={handleLogoSkip} />
        )}

        {showColorPicker && (
          <ColorPicker
            onSelect={handleColorsSelected}
            onSkip={handleColorSkip}
          />
        )}

        {showBriefSummary && conversationId && (
          <BriefSummary
            conversationId={conversationId}
            onConfirmed={handleVideoConfirmed}
          />
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive text-center">
          {error}
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={
          isLoading ||
          !conversationId ||
          showBriefSummary
        }
      />
    </div>
  );
}
