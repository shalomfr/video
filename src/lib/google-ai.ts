import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export interface ScenePlan {
  sceneNumber: number;
  description: string;
  prompt: string;
  duration: number;
  cameraAngle: string;
  transition: string;
}

export interface VideoScenePlan {
  scenes: ScenePlan[];
  overallStyle: string;
  colorPalette: string[];
}

export interface QualityResult {
  matchesPrompt: boolean;
  qualityScore: number;
  issues: string[];
  shouldRegenerate: boolean;
}

export interface ConcatenationResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

// 1. תכנון תסריט עם Gemini
export async function planVideoScenes(
  briefData: Record<string, unknown>
): Promise<VideoScenePlan> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  // Estimate duration based on content complexity
  const estimatedDuration = (briefData.videoLength as number) || 60; // Default to 60 seconds
  const sceneCount = Math.ceil(estimatedDuration / 8);

  const prompt = `
אתה תסריטאי מומחה לסרטונים פרסומיים.
צור תסריט ל-${estimatedDuration} שניות (${sceneCount} סצנות של 8 שניות).

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

// 2. יצירת סגמנט וידאו עם Veo 3.1
export async function generateVideoSegment(
  prompt: string,
  referenceImages?: string[]
): Promise<string> {
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
        duration: 8, // Always 8 seconds for segments
        aspectRatio: "16:9",
        referenceImages: referenceImages || undefined,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Veo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.taskId; // מחזיר task ID למעקב
}

// 5. בדיקת סטטוס יצירת וידאו
export interface VideoTaskStatus {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  error?: string;
}

export async function checkVideoTaskStatus(taskId: string): Promise<VideoTaskStatus> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/tasks/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
  }

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
): Promise<QualityResult> {
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

  try {
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const video = {
      inlineData: {
        data: Buffer.from(videoBuffer).toString("base64"),
        mimeType: "video/mp4",
      },
    };

    const result = await model.generateContent([prompt, video]);
    const text = result.response.text();

    // Clean the response text (remove markdown formatting if present)
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Video quality analysis failed:', error);
    // Return default quality result on failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      matchesPrompt: false,
      qualityScore: 1,
      issues: [`Analysis failed: ${errorMessage}`],
      shouldRegenerate: true
    };
  }
}

// 3. הארכת סצנה קיימת
export async function extendVideoScene(
  videoUrl: string,
  duration: number
): Promise<string> {
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
        additionalDuration: duration, // Duration to extend
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Veo extend API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.taskId;
}

// 6. חיבור סגמנטים לווידאו מלא
export async function concatenateVideoScenes(
  sceneUrls: string[],
  outputPath: string
): Promise<ConcatenationResult> {
  return new Promise((resolve) => {
    // Dynamic import for fluent-ffmpeg to avoid require
    import('fluent-ffmpeg').then(({ default: ffmpeg }) => {
      ffmpeg()
        .input(`concat:${sceneUrls.join('|')}`)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c copy', // Copy streams without re-encoding for speed
          '-avoid_negative_ts make_zero' // Handle timestamp issues
        ])
        .output(outputPath)
        .on('end', () => {
          resolve({
            success: true,
            videoUrl: outputPath
          });
        })
        .on('error', (err: Error) => {
          console.error('FFmpeg concatenation failed:', err);
          resolve({
            success: false,
            error: `Concatenation failed: ${err.message}`
          });
        })
        .run();
    }).catch((error) => {
      resolve({
        success: false,
        error: `Failed to load ffmpeg: ${error}`
      });
    });
  });
}
