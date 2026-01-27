export type VideoStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface VideoData {
  id: string;
  conversationId: string | null;
  briefId: string | null;
  userId: string;
  runwayTaskId: string | null;
  status: VideoStatus;
  prompt: string | null;
  model: string | null;
  duration: number | null;
  ratio: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface VideoStatusEvent {
  status: VideoStatus;
  message?: string;
  videoUrl?: string;
  progress?: number;
}
