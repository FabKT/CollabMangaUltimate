import { getServiceSupabase } from "@/lib/stripe-server";

const PUBLIC_MEDIA_PATH_MARKER = "/storage/v1/object/public/media/";
const TEMPORARY_FOLDER_MARKER = "/ai-generation-jobs/";

function publicMediaPath(value: string) {
  if (!value.startsWith("http") || !value.includes(PUBLIC_MEDIA_PATH_MARKER)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const markerIndex = pathname.indexOf(PUBLIC_MEDIA_PATH_MARKER);
    if (markerIndex < 0) return null;
    return pathname.slice(markerIndex + PUBLIC_MEDIA_PATH_MARKER.length);
  } catch {
    return null;
  }
}

function temporaryMediaPath(value: string) {
  const path = publicMediaPath(value);
  return path?.includes(TEMPORARY_FOLDER_MARKER) ? path : null;
}

function collectTemporaryPaths(value: unknown, paths: Set<string>) {
  if (typeof value === "string") {
    const path = temporaryMediaPath(value);
    if (path) paths.add(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTemporaryPaths(item, paths));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectTemporaryPaths(item, paths),
    );
  }
}

async function hydrateValue(value: unknown): Promise<unknown> {
  if (typeof value === "string") {
    // Persistent AI-library images are stored as public Supabase URLs. PulseNote
    // accepts image data URLs only, so restore every owned media URL to bytes
    // before validating and forwarding the generation payload.
    if (!publicMediaPath(value)) return value;
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Unable to load a generation reference (${response.status}).`);
    }
    const mimeType = response.headers.get("content-type") || "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  }
  if (Array.isArray(value)) return Promise.all(value.map(hydrateValue));
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [
        key,
        await hydrateValue(item),
      ]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

export async function hydrateGenerationPayload(payload: unknown) {
  return hydrateValue(payload);
}

export async function removeStagedGenerationImages(payload: unknown) {
  const paths = new Set<string>();
  collectTemporaryPaths(payload, paths);
  if (!paths.size) return;
  const removed = await getServiceSupabase()
    .storage.from("media")
    .remove([...paths]);
  if (removed.error) {
    console.error("[generation-jobs] Unable to remove staged images", removed.error.message);
  }
}
