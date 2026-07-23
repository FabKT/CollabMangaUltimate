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
const NETWORK_ATTEMPTS = 4;

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

function isLocalBrowser() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function fetchWithNetworkRetry(input: RequestInfo | URL, init?: RequestInit) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < NETWORK_ATTEMPTS) await delay(750 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network connection failed.");
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
  let missingAttempts = 0;
  while (Date.now() < deadline) {
    let response: Response;
    try {
      response = await fetchWithNetworkRetry(`/api/generation-jobs?id=${encodeURIComponent(id)}`, {
        headers: await authJsonHeaders(),
      });
    } catch {
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    const job = (await response.json().catch(() => ({}))) as JobState<T>;
    if (response.status === 404 && missingAttempts < 8) {
      missingAttempts += 1;
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    if (response.status >= 500) {
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    if (!response.ok)
      throw new Error(job.error || `Unable to recover generation (${response.status}).`);
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
  throw new Error(
    "Generation is still running. It will be recovered automatically on your next visit.",
  );
}

export async function runDurableGeneration<T>(
  workspace: string,
  endpoint: string,
  payload: unknown,
): Promise<T> {
  const remembered = window.localStorage.getItem(pendingKey(workspace));
  if (remembered) return pollJob<T>(workspace, remembered);

  const id = crypto.randomUUID();
  rememberJob(workspace, id);
  let response: Response;
  try {
    response = await fetchWithNetworkRetry("/api/generation-jobs", {
      method: "POST",
      headers: await authJsonHeaders(),
      body: JSON.stringify({ id, workspace, endpoint, payload }),
    });
  } catch (error) {
    if (!isLocalBrowser()) return pollJob<T>(workspace, id);
    forgetJob(workspace);
    return directGeneration<T>(endpoint, payload);
  }
  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body.id) {
    forgetJob(workspace);
    if (isLocalBrowser()) return directGeneration<T>(endpoint, payload);
    throw new Error(body.error || `Unable to queue generation (${response.status}).`);
  }

  return pollJob<T>(workspace, body.id);
}

export async function resumeDurableGeneration<T>(workspace: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(pendingKey(workspace));
  if (!id) return null;
  return pollJob<T>(workspace, id);
}

export function hasPendingGeneration(workspace: string) {
  return (
    typeof window !== "undefined" && Boolean(window.localStorage.getItem(pendingKey(workspace)))
  );
}
