export const BRIEF_EXTRACTION_PROMPT = `You are a data extraction assistant. Analyze the following Hebrew conversation between a user and an AI video creation assistant.

Extract the structured data from the conversation and return a JSON object with these exact fields:

{
  "videoType": "promotional" | "branding" | "social_media" | "product" | "other",
  "businessName": "string or null",
  "industry": "string or null",
  "businessDesc": "string (in Hebrew) or null",
  "brandColors": ["#hex1", "#hex2"] or null,
  "style": "modern" | "classic" | "playful" | "minimalist" | "luxury" or null,
  "targetAudience": "string (description in Hebrew) or null",
  "videoLength": 5 | 10 or null,
  "mood": "energetic" | "calm" | "warm" | "luxury" | "happy" or null,
  "additionalNotes": "string or null"
}

Rules:
- Extract data based on what the user explicitly mentioned in the conversation
- If a field was not discussed, set it to null
- Keep Hebrew text as-is for Hebrew fields
- Brand colors should be converted to hex format if possible
- Be precise and don't invent data that wasn't mentioned

Return ONLY the JSON object, no additional text.`;
