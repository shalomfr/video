export type VideoType =
  | "promotional"
  | "branding"
  | "social_media"
  | "product"
  | "other";

export type VideoStyle =
  | "modern"
  | "classic"
  | "playful"
  | "minimalist"
  | "luxury";

export type VideoMood =
  | "energetic"
  | "calm"
  | "warm"
  | "luxury"
  | "happy";

export interface BriefData {
  id: string;
  conversationId: string;
  userId: string;
  videoType: VideoType | null;
  businessName: string | null;
  industry: string | null;
  businessDesc: string | null;
  logoUrl: string | null;
  brandColors: string[] | null;
  style: VideoStyle | null;
  targetAudience: string | null;
  videoLength: number | null;
  mood: VideoMood | null;
  additionalNotes: string | null;
  generatedPrompt: string | null;
  isConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
