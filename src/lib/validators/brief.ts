import { z } from "zod";

export const briefSchema = z.object({
  videoType: z
    .enum(["promotional", "branding", "social_media", "product", "other"])
    .nullable(),
  businessName: z.string().nullable(),
  industry: z.string().nullable(),
  businessDesc: z.string().nullable(),
  brandColors: z.array(z.string()).nullable(),
  style: z
    .enum(["modern", "classic", "playful", "minimalist", "luxury"])
    .nullable(),
  targetAudience: z.string().nullable(),
  videoLength: z.number().nullable(),
  mood: z.enum(["energetic", "calm", "warm", "luxury", "happy"]).nullable(),
  additionalNotes: z.string().nullable(),
});

export type BriefInput = z.infer<typeof briefSchema>;
