export type MessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  status: ConversationStatus;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus =
  | "ACTIVE"
  | "BRIEF_READY"
  | "GENERATING"
  | "COMPLETED"
  | "FAILED";

export interface ChatStreamEvent {
  text?: string;
  event?: "LOGO_UPLOAD" | "COLOR_PICKER" | "BRIEF_CONFIRMED" | "DONE";
}

export interface SendMessagePayload {
  conversationId: string;
  message: string;
  metadata?: Record<string, unknown>;
}
