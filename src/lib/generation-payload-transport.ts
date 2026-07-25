import { getSupabase } from "@/lib/supabase";

const MAX_INLINE_PAYLOAD_CHARACTERS = 3_750_000;
const TEMPORARY_FOLDER = "ai-generation-jobs";

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  return "png";
}

function containsEmbeddedImage(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("data:image/");
  if (Array.isArray(value)) return value.some(containsEmbeddedImage);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsEmbeddedImage);
  }
  return false;
}

async function replaceEmbeddedImages(
  value: unknown,
  upload: (dataUrl: string) => Promise<string>,
): Promise<unknown> {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? upload(value) : value;
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => replaceEmbeddedImages(item, upload)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [
        key,
        await replaceEmbeddedImages(item, upload),
      ]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Netlify limits synchronous request bodies. Large Manga Page Creator jobs can
 * contain many base64 references, so stage those images directly in Supabase
 * Storage and keep only their short public URLs in the queue record.
 */
export async function stageLargeGenerationPayload(
  payload: unknown,
  jobId: string,
): Promise<unknown> {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_INLINE_PAYLOAD_CHARACTERS || !containsEmbeddedImage(payload)) {
    return payload;
  }

  const supabase = getSupabase();
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error("Authentication required.");

  const uploadedPaths: string[] = [];
  const uploadedUrls = new Map<string, Promise<string>>();
  let imageIndex = 0;

  const upload = (dataUrl: string) => {
    const cached = uploadedUrls.get(dataUrl);
    if (cached) return cached;

    const pending = (async () => {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const path = `${userId}/${TEMPORARY_FOLDER}/${jobId}/${imageIndex}.${extensionForMime(
        blob.type,
      )}`;
      imageIndex += 1;
      const result = await supabase.storage.from("media").upload(path, blob, {
        contentType: blob.type || "image/png",
        upsert: false,
      });
      if (result.error) {
        throw new Error(`Unable to stage generation reference: ${result.error.message}`);
      }
      uploadedPaths.push(path);
      return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    })();

    uploadedUrls.set(dataUrl, pending);
    return pending;
  };

  try {
    return await replaceEmbeddedImages(payload, upload);
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage
        .from("media")
        .remove(uploadedPaths)
        .catch(() => undefined);
    }
    throw error;
  }
}
