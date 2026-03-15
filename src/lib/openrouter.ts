import { GoogleGenerativeAI } from "@google/generative-ai";

let gemini: GoogleGenerativeAI | null = null;

function getGemini(): GoogleGenerativeAI {
  if (!gemini) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
    gemini = new GoogleGenerativeAI(key);
  }
  return gemini;
}

const MODEL = "gemini-2.5-flash";

export async function streamChatResponse(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
) {
  const model = getGemini().getGenerativeModel({ model: MODEL });

  // Separate system instruction from chat messages
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const chat = model.startChat({
    systemInstruction: systemMessage?.content,
    history: chatMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const lastMessage = chatMessages[chatMessages.length - 1];
  const result = await chat.sendMessageStream(lastMessage.content);

  // Return an async iterable that mimics the OpenAI SDK format
  // so the chat route doesn't need to change
  return {
    [Symbol.asyncIterator]: async function* () {
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            choices: [{ delta: { content: text } }],
          };
        }
      }
    },
  };
}

export async function extractBriefFromConversation(
  conversationMessages: { role: string; content: string }[]
) {
  const { BRIEF_EXTRACTION_PROMPT } = await import(
    "./prompts/brief-extraction"
  );

  const model = getGemini().getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    BRIEF_EXTRACTION_PROMPT,
    `Here is the conversation to extract from:\n${JSON.stringify(conversationMessages)}`,
  ]);

  const content = result.response.text();
  if (!content) throw new Error("No response from Gemini");

  const cleanText = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleanText);
}

export async function generateVideoPrompt(briefData: Record<string, unknown>) {
  const { VIDEO_PROMPT_GENERATION } = await import("./prompts/video-prompt");

  const model = getGemini().getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    VIDEO_PROMPT_GENERATION,
    JSON.stringify(briefData),
  ]);

  const content = result.response.text();
  if (!content) throw new Error("No response from Gemini");
  return content;
}
