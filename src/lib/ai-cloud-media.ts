import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "media";
const DATA_IMAGE_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const uploadedImageCache = new Map<string, Promise<string>>();

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "image";
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  return "png";
}

function isSupabaseMediaUrl(value: string) {
  return value.includes("/storage/v1/object/public/media/");
}

async function imageBlob(value: string) {
  const response = await fetch(value);
  if (!response.ok) throw new Error(`Unable to read image (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("The selected resource is not an image.");
  return blob;
}

export async function uploadAiImage(
  supabase: SupabaseClient,
  userId: string,
  imageValue: string,
  folder: string,
  imageId: string,
): Promise<string> {
  if (!imageValue || isSupabaseMediaUrl(imageValue)) return imageValue;
  if (!DATA_IMAGE_PATTERN.test(imageValue) && !/^https?:\/\//i.test(imageValue)) return imageValue;

  const cacheKey = `${userId}:${folder}:${imageId}:${imageValue}`;
  const cached = uploadedImageCache.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const blob = await imageBlob(imageValue);
    const path = `${userId}/ai/${safeSegment(folder)}/${safeSegment(imageId)}.${extensionForMime(
      blob.type,
    )}`;
    const uploaded = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || "image/png",
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploaded.error) throw new Error(`Unable to save AI image: ${uploaded.error.message}`);
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  })();

  uploadedImageCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    uploadedImageCache.delete(cacheKey);
    throw error;
  }
}

export async function replaceEmbeddedAiImages(
  supabase: SupabaseClient,
  userId: string,
  value: unknown,
  folder: string,
): Promise<unknown> {
  let index = 0;

  async function replace(item: unknown): Promise<unknown> {
    if (typeof item === "string" && DATA_IMAGE_PATTERN.test(item)) {
      const currentIndex = index;
      index += 1;
      return uploadAiImage(supabase, userId, item, folder, `embedded-${currentIndex}`);
    }
    if (Array.isArray(item)) return Promise.all(item.map(replace));
    if (item && typeof item === "object") {
      const entries = await Promise.all(
        Object.entries(item as Record<string, unknown>).map(async ([key, child]) => [
          key,
          await replace(child),
        ]),
      );
      return Object.fromEntries(entries);
    }
    return item;
  }

  return replace(value);
}

export function mediaStoragePath(publicUrl: string): string | null {
  const marker = "/storage/v1/object/public/media/";
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;
  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length).split("?")[0]);
}

export async function removeAiMedia(supabase: SupabaseClient, urls: string[]) {
  const paths = [
    ...new Set(urls.map(mediaStoragePath).filter((path): path is string => Boolean(path))),
  ];
  if (!paths.length) return;
  const result = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (result.error) throw new Error(result.error.message);
}
