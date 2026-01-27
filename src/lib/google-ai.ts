import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// 1. תכנון תסריט עם Gemini
export async function planVideoScenes(
  briefData: Record<string, unknown>,
  duration: number
) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const sceneCount = Math.ceil(duration / 8);

  const prompt = `
אתה תסריטאי מומחה לסרטונים פרסומיים.
צור תסריט ל-${duration} שניות (${sceneCount} סצנות של 8 שניות).

פרטי העסק:
${JSON.stringify(briefData, null, 2)}

החזר JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "תיאור בעברית",
      "prompt": "Detailed English prompt for Veo",
      "duration": 8,
      "cameraAngle": "wide shot / close-up / etc",
      "transition": "fade / cut / zoom"
    }
  ],
  "overallStyle": "סגנון כללי",
  "colorPalette": ["#hex1", "#hex2"]
}`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

// 2. יצירת וידאו עם Veo 3.1
export async function generateVideoWithVeo(
  prompt: string,
  duration: number = 8,
  referenceImage?: string // לוגו
) {
  // Google Veo API endpoint (via AI Studio)
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/veo-3.1:generateVideo",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        duration, // 4, 6, or 8 seconds
        aspectRatio: "16:9", // or "9:16" for portrait
        referenceImages: referenceImage ? [referenceImage] : undefined,
      }),
    }
  );

  const data = await response.json();
  return data.taskId; // מחזיר task ID למעקב
}

// 3. בדיקת סטטוס יצירת וידאו
export async function checkVideoStatus(taskId: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/tasks/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
      },
    }
  );

  const data = await response.json();
  return {
    status: data.state, // PENDING, RUNNING, COMPLETED, FAILED
    videoUrl: data.result?.videoUrl,
    error: data.error,
  };
}

// 4. ניתוח איכות וידאו עם Gemini
export async function analyzeVideoQuality(
  videoUrl: string,
  expectedPrompt: string
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  const prompt = `
נתח את הסרטון הזה ובדוק:
1. האם הוא תואם את ה-prompt: "${expectedPrompt}"
2. האם האיכות הויזואלית טובה
3. האם יש בעיות טכניות

החזר JSON:
{
  "matchesPrompt": true/false,
  "qualityScore": 1-10,
  "issues": ["בעיה 1", "בעיה 2"],
  "shouldRegenerate": true/false
}`;

  const video = {
    inlineData: {
      data: Buffer.from(
        await (await fetch(videoUrl)).arrayBuffer()
      ).toString("base64"),
      mimeType: "video/mp4",
    },
  };

  const result = await model.generateContent([prompt, video]);
  return JSON.parse(result.response.text());
}

// 5. הארכת סצנה (Scene Extension)
export async function extendScene(
  videoUrl: string,
  additionalDuration: number = 7
) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1/models/veo-3.1:extendVideo",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        videoUrl,
        additionalDuration, // עד 7 שניות לכל הרחבה
      }),
    }
  );

  const data = await response.json();
  return data.taskId;
}
