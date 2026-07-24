import { processGenerationJob } from "../../src/server-functions/generation-job-worker";
import { enforceRequestRateLimit } from "../../src/lib/rate-limit-server";

export default async function generationWorker(request: Request) {
  const limited = await enforceRequestRateLimit(request, {
    scope: "generation-worker",
    identityLimit: 15,
    ipLimit: 300,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const body = (await request.json()) as { jobId?: string; authorization?: string };
  if (!body.jobId || !body.authorization) {
    throw new Error("Missing generation job credentials.");
  }
  await processGenerationJob(body.jobId, body.authorization);
  return new Response(null, { status: 202 });
}

export const config = {
  background: true,
};
