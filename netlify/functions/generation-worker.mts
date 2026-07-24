import { processGenerationJob } from "../../src/server-functions/generation-job-worker";
import { enforceRequestRateLimit } from "../../src/lib/rate-limit-server";

export default async function generationWorker(request: Request) {
  const body = (await request.json()) as { jobId?: string; authorization?: string };
  if (!body.jobId || !body.authorization) {
    console.error("[generation-worker] Missing job credentials.");
    return;
  }

  console.info("[generation-worker] Starting job", body.jobId);
  const limited = await enforceRequestRateLimit(request, {
    scope: "generation-worker",
    identityLimit: 15,
    ipLimit: 300,
    windowSeconds: 60,
  });
  if (limited) {
    console.error("[generation-worker] Rate limit rejected job", body.jobId);
    return;
  }

  await processGenerationJob(body.jobId, body.authorization);
  console.info("[generation-worker] Finished job", body.jobId);
}

export const config = {
  background: true,
};
