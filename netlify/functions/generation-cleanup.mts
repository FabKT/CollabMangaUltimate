import { recoverStaleGenerationJobs } from "../../src/lib/generation-job-recovery";

export default async function generationCleanup() {
  const recovered = await recoverStaleGenerationJobs();
  console.info("[generation-cleanup] Recovered stale jobs:", recovered);
}

export const config = {
  schedule: "*/5 * * * *",
};
