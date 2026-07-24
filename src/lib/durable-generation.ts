import { authJsonHeaders, refreshBearerHeader } from "@/lib/auth-header";

const JOB_PREFIX = "collabmanga.ai-job.";

export const GENERATION_ACTIVITY_EVENT = "collabmanga:generation-activity";

function clearLegacyJob(workspace: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${JOB_PREFIX}${workspace}`);
}

function setGenerationActivity(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GENERATION_ACTIVITY_EVENT, {
      detail: { active },
    }),
  );
}

async function readBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const text = await response.text().catch(() => "");
  return { error: text || `Generation failed (${response.status}).` };
}

async function directGeneration<T>(endpoint: string, payload: unknown): Promise<T> {
  let response = await fetch(endpoint, {
    method: "POST",
    headers: await authJsonHeaders(),
    body: JSON.stringify(payload),
  });

  // A 401 happens before the expensive generation starts, so refreshing the
  // session and retrying once cannot duplicate an OpenAI request.
  if (response.status === 401) {
    await refreshBearerHeader();
    response = await fetch(endpoint, {
      method: "POST",
      headers: await authJsonHeaders(),
      body: JSON.stringify(payload),
    });
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Generation failed (${response.status}).`,
    );
  }
  return body as T;
}

export async function runDurableGeneration<T>(
  workspace: string,
  endpoint: string,
  payload: unknown,
): Promise<T> {
  clearLegacyJob(workspace);
  setGenerationActivity(true);
  try {
    return await directGeneration<T>(endpoint, payload);
  } finally {
    setGenerationActivity(false);
  }
}

export async function resumeDurableGeneration<T>(workspace: string): Promise<T | null> {
  clearLegacyJob(workspace);
  return null;
}

export function hasPendingGeneration(_workspace: string) {
  return false;
}
