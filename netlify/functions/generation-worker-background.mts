import { processGenerationJob } from "../../src/server-functions/generation-job-worker";

export default async function generationWorker(request: Request) {
  const body = (await request.json()) as { jobId?: string; authorization?: string };
  if (!body.jobId || !body.authorization) {
    throw new Error("Missing generation job credentials.");
  }
  await processGenerationJob(body.jobId, body.authorization);
}

export const config = {
  background: true,
};
