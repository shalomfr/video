import RunwayML from "@runwayml/sdk";

const runway = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET!,
});

export async function createVideoFromImage(
  promptText: string,
  imageUrl: string,
  duration: number = 5
) {
  const task = await runway.imageToVideo.create({
    model: "gen4_turbo",
    promptImage: imageUrl,
    promptText,
    duration: duration as 5 | 10,
    ratio: "1280:720",
  });
  return task.id;
}

export async function createVideoFromText(
  promptText: string,
  duration: number = 5
) {
  // veo3.1 supports duration of 4, 6, or 8 seconds
  // Map 5->6 and 10->8
  const veoFourDuration = duration <= 5 ? 6 : 8;

  const task = await runway.textToVideo.create({
    model: "veo3.1",
    promptText,
    duration: veoFourDuration as 4 | 6 | 8,
    ratio: "1280:720",
  });
  return task.id;
}

export async function getTaskStatus(taskId: string) {
  const task = await runway.tasks.retrieve(taskId);
  return {
    status: task.status,
    output: "output" in task ? task.output : undefined,
    failure: "failure" in task ? task.failure : undefined,
  };
}
