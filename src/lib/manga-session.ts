/**
 * Per-tab working-state persistence.
 *
 * Backed by sessionStorage so the Manga Page Creator keeps everything (canvas,
 * imports, prompt, selections, last result) across in-app navigation and page
 * reloads, and is cleared only when the browser tab itself is closed.
 */

const PREFIX = "collabmanga.session.";

export function loadSession<T>(key: string): T | null {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveSession<T>(key: string, value: T): void {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage quota exceeded (too many large base64 images) — best effort.
  }
}
