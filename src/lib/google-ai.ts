import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

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

// ===== 1. Scene Planning with Gemini =====

export async function planVideoScenes(
  briefData: Record<string, unknown>
): Promise<VideoScenePlan> {
  const model = getGemini().getGenerativeModel({ model: "gemini-2.5-flash" });

  const estimatedDuration = (briefData.videoLength as number) || 60;
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
  const text = result.response.text();
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleanText);
}

// ===== 2. Video Generation with Veo 3.1 =====

/**
 * Generate video from text prompt using Google Veo 3.1.
 * Uses the @google/genai SDK with predictLongRunning + polling.
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
  const ai = getGenAI();

  console.log(`  [Veo 3.1] Generating video...`);

  let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt,
    config: {
      aspectRatio: options.aspectRatio || "16:9",
      personGeneration: "allow_all" as any,
    },
  });

  // Poll until done (every 10 seconds)
  while (!operation.done) {
    console.log(`  [Veo 3.1] Still generating...`);
    await sleep(10000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  // Download the video
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) {
    throw new Error("Veo 3.1 returned no video");
  }

  await ai.files.download({ file: video, downloadPath: outputPath });
  console.log(`  [Veo 3.1] Video saved to ${outputPath}`);

  return outputPath;
}

/**
 * Generate video from image + text prompt using Veo 3.1.
 * Uses the first frame as reference for visual continuity.
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
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  console.log(`  [Veo 3.1] Generating video from image...`);

  // Read the image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  // Use REST API directly for image-to-video (SDK doesn't support it well yet)
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances: [
          {
            prompt,
            image: {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64,
              },
            },
          },
        ],
        parameters: {
          aspectRatio: options.aspectRatio || "16:9",
          personGeneration: "allow_all",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Veo 3.1 API error: ${response.status} — ${err}`);
  }

  const { name: operationName } = await response.json();

  // Poll until done
  let done = false;
  let videoUri = "";

  while (!done) {
    await sleep(10000);
    console.log(`  [Veo 3.1] Still generating from image...`);

    const statusResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
      {
        headers: { "x-goog-api-key": apiKey },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Polling failed: ${statusResponse.status}`);
    }

    const status = await statusResponse.json();

    if (status.done) {
      done = true;
      videoUri =
        status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) {
        throw new Error("Veo 3.1 returned no video URI");
      }
    }
  }

  // Download the video
  const videoResponse = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }

  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  fs.mkdirSync(require("path").dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, videoBuffer);

  console.log(`  [Veo 3.1] Video saved to ${outputPath}`);
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
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleanText);
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

// ===== 5. Veo Operation Status Polling =====

export interface VeoOperationStatus {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string; // video URI
  failure?: string;
}

/**
 * Check the status of a Veo 3.1 operation by its operation name.
 * Returns a status object compatible with the video status route.
 */
export async function getVeoOperationStatus(
  operationName: string
): Promise<VeoOperationStatus> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
    {
      headers: { "x-goog-api-key": apiKey },
    }
  );

  if (!response.ok) {
    throw new Error(`Veo operation polling failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.done) {
    const videoUri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (videoUri) {
      // Construct downloadable URL with API key
      const downloadUrl = `${videoUri}&key=${apiKey}`;
      return {
        status: "SUCCEEDED",
        output: downloadUrl,
      };
    }
    // Done but no video = error
    const error = data.error?.message || "Veo returned no video";
    return {
      status: "FAILED",
      failure: error,
    };
  }

  // Not done yet
  if (data.metadata) {
    return { status: "RUNNING" };
  }

  return { status: "PENDING" };
}

// ===== Utilities =====

// ===== Legacy Aliases (for existing routes) =====

/**
 * Legacy wrapper — existing routes call generateVideoSegment() which returns a taskId.
 * Now uses Veo 3.1 REST API directly and returns the operation name as "taskId".
 */
export async function generateVideoSegment(
  prompt: string,
  referenceImages?: string[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const instances: any[] = [{ prompt }];
  if (referenceImages?.length) {
    instances[0].referenceImages = referenceImages.map((img) => ({
      image: { inlineData: { mimeType: "image/png", data: img } },
      referenceType: "asset",
    }));
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances,
        parameters: {
          aspectRatio: "16:9",
          resolution: "720p",
          personGeneration: "allow_all",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Veo 3.1 API error: ${response.status} — ${err}`);
  }

  const { name } = await response.json();
  return name; // operation name used as taskId
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
