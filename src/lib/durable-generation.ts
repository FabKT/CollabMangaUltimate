import { authJsonHeaders } from "@/lib/auth-header";

type JobState<T> = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: T;
  error?: string;
};

const JOB_PREFIX = "collabmanga.ai-job.";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

function pendingKey(workspace: string) {
  return `${JOB_PREFIX}${workspace}`;
}

function rememberJob(workspace: string, id: string) {
  window.localStorage.setItem(pendingKey(workspace), id);
}

function forgetJob(workspace: string) {
  window.localStorage.removeItem(pendingKey(workspace));
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function directGeneration<T>(endpoint: string, payload: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: await authJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Generation failed (${response.status}).`);
  return body as T;
}

async function pollJob<T>(workspace: string, id: string): Promise<T> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/generation-jobs?id=${encodeURIComponent(id)}`, {
      headers: await authJsonHeaders(),
    });
    const job = (await response.json().catch(() => ({}))) as JobState<T>;
    if (!response.ok) throw new Error(job.error || `Unable to recover generation (${response.status}).`);
    if (job.status === "completed" && job.result) {
      forgetJob(workspace);
      return job.result;
    }
    if (job.status === "failed") {
      forgetJob(workspace);
      throw new Error(job.error || "Generation failed.");
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("Generation is still running. It will be recovered automatically on your next visit.");
}

export async function runDurableGeneration<T>(
  workspace: string,
  endpoint: string,
  payload: unknown,
): Promise<T> {
  const response = await fetch("/api/generation-jobs", {
    method: "POST",
    headers: await authJsonHeaders(),
    body: JSON.stringify({ workspace, endpoint, payload }),
  });
  const body = await response.json().catch(() => ({}));

  // Local development and deployments awaiting the SQL migration keep working.
  if (!response.ok || !body.id) return directGeneration<T>(endpoint, payload);

  rememberJob(workspace, body.id);
  return pollJob<T>(workspace, body.id);
}

export async function resumeDurableGeneration<T>(workspace: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(pendingKey(workspace));
  if (!id) return null;
  return pollJob<T>(workspace, id);
}

export function hasPendingGeneration(workspace: string) {
  return typeof window !== "undefined" && Boolean(window.localStorage.getItem(pendingKey(workspace)));
}
