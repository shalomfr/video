import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

// ===== Clients =====

let genAiClient: GoogleGenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAiClient) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
    genAiClient = new GoogleGenAI({ apiKey: key });
  }
  return genAiClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
    geminiClient = new GoogleGenerativeAI(key);
  }
  return geminiClient;
}

// ===== Types =====

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

// ===== 1. Scene Planning with OpenRouter =====

export async function planVideoScenes(
  briefData: Record<string, unknown>
): Promise<VideoScenePlan> {
  const OpenAI = (await import("openai")).default;
  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY!,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "Video AI Creator",
    },
  });

  const estimatedDuration = (briefData.videoLength as number) || 60;
  const sceneCount = Math.ceil(estimatedDuration / 8);

  const response = await openrouter.chat.completions.create({
    model: "anthropic/claude-sonnet-4",
    messages: [
      {
        role: "system",
        content: `אתה תסריטאי מומחה לסרטונים פרסומיים. צור תסריט ל-${estimatedDuration} שניות (${sceneCount} סצנות של 8 שניות). החזר JSON בלבד.`,
      },
      {
        role: "user",
        content: `פרטי העסק:\n${JSON.stringify(briefData, null, 2)}\n\nהחזר JSON:\n{"scenes": [{"sceneNumber": 1, "description": "תיאור בעברית", "prompt": "Detailed English prompt for Veo", "duration": 8, "cameraAngle": "wide shot / close-up / etc", "transition": "fade / cut / zoom"}], "overallStyle": "סגנון כללי", "colorPalette": ["#hex1", "#hex2"]}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response for scene planning");
  return JSON.parse(extractJSON(content));
}

// ===== 2. Video Generation with Veo 3.1 =====

/**
 * Generate video from text prompt using Runway Gen 4.5.
 * Submits task, polls until done, downloads to disk.
 * Returns the local file path of the downloaded video.
 */
export async function generateVideoFromText(
  prompt: string,
  outputPath: string,
  options: {
    resolution?: "720p" | "1080p";
    aspectRatio?: "16:9" | "9:16";
    durationSeconds?: "4" | "6" | "8";
  } = {}
): Promise<string> {
  const RunwayML = (await import("@runwayml/sdk")).default;
  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET! });

  // Runway limits promptText to 1000 characters
  const truncatedPrompt = prompt.length > 1000 ? prompt.slice(0, 997) + '...' : prompt;
  console.log(`  [Runway] Generating video... (prompt: ${truncatedPrompt.length} chars)`);

  const ratio = options.aspectRatio === "9:16" ? "720:1280" : "1280:720";
  const task = await client.textToVideo.create({
    model: "gen4.5",
    promptText: truncatedPrompt,
    ratio,
    duration: 5,
  });

  // Poll until done (handle THROTTLED status too)
  let status = "PENDING";
  let videoUrl = "";
  let attempts = 0;
  while (attempts < 120) {
    await sleep(5000);
    attempts++;
    const result = await client.tasks.retrieve(task.id) as any;
    status = result.status;
    console.log(`  [Runway] Status: ${status} (attempt ${attempts})`);

    if (status === "SUCCEEDED" && result.output) {
      videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      break;
    } else if (status === "FAILED") {
      throw new Error(`Runway video generation failed: ${JSON.stringify(result.failure || result.failureCode || 'unknown')}`);
    }
    // PENDING, RUNNING, THROTTLED — keep polling
  }

  if (!videoUrl) {
    throw new Error(`Runway generation timed out after ${attempts} attempts (last status: ${status})`);
  }

  // Download the video
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  const path = await import("path");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, videoBuffer);

  console.log(`  [Runway] Video saved to ${outputPath}`);
  return outputPath;
}

/**
 * Generate video from image + text prompt using Runway Gen 4.5.
 * Uses the image as reference for visual continuity.
 */
export async function generateVideoFromImage(
  prompt: string,
  imagePath: string,
  outputPath: string,
  options: {
    resolution?: "720p" | "1080p";
    aspectRatio?: "16:9" | "9:16";
  } = {}
): Promise<string> {
  const RunwayML = (await import("@runwayml/sdk")).default;
  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET! });

  // Runway limits promptText to 1000 characters
  const truncatedPrompt = prompt.length > 1000 ? prompt.slice(0, 997) + '...' : prompt;
  console.log(`  [Runway] Generating video from image... (prompt: ${truncatedPrompt.length} chars)`);

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUri = `data:${mimeType};base64,${imageBase64}`;

  const ratio = options.aspectRatio === "9:16" ? "720:1280" : "1280:720";
  const task = await client.imageToVideo.create({
    model: "gen4_turbo",
    promptImage: dataUri,
    promptText: truncatedPrompt,
    ratio,
    duration: 5,
  });

  // Poll until done (handle THROTTLED status too)
  let status = "PENDING";
  let videoUrl = "";
  let attempts = 0;
  while (attempts < 120) {
    await sleep(5000);
    attempts++;
    const result = await client.tasks.retrieve(task.id) as any;
    status = result.status;
    console.log(`  [Runway] Image-to-video status: ${status} (attempt ${attempts})`);

    if (status === "SUCCEEDED" && result.output) {
      videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      break;
    } else if (status === "FAILED") {
      throw new Error(`Runway image-to-video failed: ${JSON.stringify(result.failure || result.failureCode || 'unknown')}`);
    }
    // PENDING, RUNNING, THROTTLED — keep polling
  }

  if (!videoUrl) {
    throw new Error(`Runway image-to-video timed out after ${attempts} attempts (last status: ${status})`);
  }

  // Download the video
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  const pathMod = await import("path");
  fs.mkdirSync(pathMod.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, videoBuffer);

  console.log(`  [Runway] Video saved to ${outputPath}`);
  return outputPath;
}

// ===== 3. Video Quality Analysis with Gemini =====

export async function analyzeVideoQuality(
  videoUrl: string,
  expectedPrompt: string
): Promise<QualityResult> {
  const model = getGemini().getGenerativeModel({
    model: "gemini-2.5-flash",
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
    return JSON.parse(extractJSON(text));
  } catch (error) {
    console.error("Video quality analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      matchesPrompt: false,
      qualityScore: 1,
      issues: [`Analysis failed: ${errorMessage}`],
      shouldRegenerate: true,
    };
  }
}

// ===== 4. FFmpeg Concatenation =====

export async function concatenateVideoScenes(
  sceneUrls: string[],
  outputPath: string
): Promise<ConcatenationResult> {
  return new Promise((resolve) => {
    import("fluent-ffmpeg")
      .then(({ default: ffmpeg }) => {
        ffmpeg()
          .input(`concat:${sceneUrls.join("|")}`)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy", "-avoid_negative_ts make_zero"])
          .output(outputPath)
          .on("end", () => {
            resolve({ success: true, videoUrl: outputPath });
          })
          .on("error", (err: Error) => {
            console.error("FFmpeg concatenation failed:", err);
            resolve({ success: false, error: `Concatenation failed: ${err.message}` });
          })
          .run();
      })
      .catch((error) => {
        resolve({ success: false, error: `Failed to load ffmpeg: ${error}` });
      });
  });
}

// ===== 5. Runway Task Status Polling =====

export interface VeoOperationStatus {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string; // video URL
  failure?: string;
}

/**
 * Check the status of a Runway task by its ID.
 */
export async function getVeoOperationStatus(
  taskId: string
): Promise<VeoOperationStatus> {
  const RunwayML = (await import("@runwayml/sdk")).default;
  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET! });

  const task = await client.tasks.retrieve(taskId);

  switch (task.status) {
    case "SUCCEEDED":
      return {
        status: "SUCCEEDED",
        output: Array.isArray(task.output) ? task.output[0] : task.output,
      };
    case "FAILED":
      return {
        status: "FAILED",
        failure: (task as any).failure || "Video generation failed",
      };
    case "RUNNING":
      return { status: "RUNNING" };
    default:
      return { status: "PENDING" };
  }
}

// ===== Utilities =====

// ===== Legacy Aliases (for existing routes) =====

/**
 * Submit a video generation task to Runway Gen 4.5.
 * Returns the task ID for polling.
 */
export async function generateVideoSegment(
  prompt: string,
  _referenceImages?: string[]
): Promise<string> {
  const RunwayML = (await import("@runwayml/sdk")).default;
  const client = new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET! });

  const task = await client.textToVideo.create({
    model: "gen4.5",
    promptText: prompt,
    ratio: "1280:720",
    duration: 5,
  });

  return task.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
