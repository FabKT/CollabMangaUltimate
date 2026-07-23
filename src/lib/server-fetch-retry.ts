const DEFAULT_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524]);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("und_err")
  );
}

export async function fetchGenerationWithRetry(
  url: string,
  createInit: () => RequestInit,
  attempts = DEFAULT_ATTEMPTS,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, createInit());
      if (attempt < attempts && RETRYABLE_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        await wait(1_200 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts && isRetryableNetworkError(error)) {
        await wait(1_200 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Image backend connection failed.");
}
