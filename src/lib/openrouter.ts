import OpenAI from "openai";

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "Video AI Creator",
      },
    });
  }
  return _client;
}

const MODEL = "anthropic/claude-sonnet-4";

export async function streamChatResponse(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
) {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
  });
  return response;
}

export async function extractBriefFromConversation(
  conversationMessages: { role: string; content: string }[]
) {
  const { BRIEF_EXTRACTION_PROMPT } = await import(
    "./prompts/brief-extraction"
  );

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: BRIEF_EXTRACTION_PROMPT },
      {
        role: "user",
        content: JSON.stringify(conversationMessages),
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");
  return JSON.parse(extractJSON(content));
}

export async function generateVideoPrompt(briefData: Record<string, unknown>) {
  const { VIDEO_PROMPT_GENERATION } = await import("./prompts/video-prompt");

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: VIDEO_PROMPT_GENERATION },
      { role: "user", content: JSON.stringify(briefData) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");
  return content;
}
