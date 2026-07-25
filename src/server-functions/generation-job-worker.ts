import { withCredits, type GenerationMeta } from "@/lib/billing-credits";
import { getServiceSupabase } from "@/lib/stripe-server";
import {
  parseMangaImageGenerationInput,
  requestPulseNoteMangaImage,
} from "@/server-functions/manga-image";
import {
  parseCharacterImageInput,
  requestPulseNoteCharacterImage,
} from "@/server-functions/character-image";
import {
  parseSketchFinalInput,
  requestPulseNoteSketchFinal,
} from "@/server-functions/sketch-final-image";
import {
  parseStyleTransferInput,
  requestPulseNoteStyleTransfer,
} from "@/server-functions/style-transfer-image";
import {
  parsePlancheTransferInput,
  requestPulseNotePlancheTransfer,
} from "@/server-functions/planche-transfer-image";
import { parseDecorImageInput, requestPulseNoteDecorImage } from "@/server-functions/decor-image";
import { parseFreeImageInput, requestPulseNoteFreeImage } from "@/server-functions/free-image";
import {
  hydrateGenerationPayload,
  removeStagedGenerationImages,
} from "@/server-functions/generation-payload-transport";

type GenerationResult = {
  imageUrl?: string;
  imageDataUrl?: string;
  finalPrompt?: string;
  taskType?: string;
  model?: string;
  quality?: string;
  size?: string;
  costUsd?: number;
};

type StoredJob = {
  id: string;
  user_id: string;
  workspace: string;
  endpoint: string;
  request_payload: unknown;
  status: "queued" | "running" | "completed" | "failed";
};

function extensionForMime(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  return "png";
}

function sourceName(endpoint: string) {
  const names: Record<string, string> = {
    "/api/manga/generate-page": "Manga Page Creator",
    "/api/character/generate": "Creation de personnage",
    "/api/sketch-final/generate": "Raw vers Final",
    "/api/style-transfer/generate": "Transfert de style",
    "/api/planche-transfer/generate": "Transfert de planche",
    "/api/decor/generate": "Creation de decor",
    "/api/free-studio/generate": "Studio libre",
  };
  return names[endpoint] ?? "CollabManga AI";
}

function promptFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const prompt = record.prompt ?? record.editPrompt ?? record.description;
  return typeof prompt === "string" ? prompt : "";
}

async function persistGeneratedResult({
  userId,
  jobId,
  workspace,
  endpoint,
  payload,
  result,
}: {
  userId: string;
  jobId: string;
  workspace: string;
  endpoint: string;
  payload: unknown;
  result: GenerationResult;
}): Promise<GenerationResult> {
  const supabase = getServiceSupabase();
  const originalImage = result.imageDataUrl || result.imageUrl;
  if (!originalImage) throw new Error("The generation returned no image to persist.");

  let imageUrl = originalImage;
  if (!originalImage.includes("/storage/v1/object/public/media/")) {
    const response = await fetch(originalImage);
    if (!response.ok) throw new Error(`Unable to persist generated image (${response.status}).`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("The generation returned an invalid image.");
    }
    const path = `${userId}/ai/generated/${jobId}.${extensionForMime(blob.type)}`;
    const uploaded = await supabase.storage.from("media").upload(path, blob, {
      contentType: blob.type || "image/png",
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploaded.error)
      throw new Error(`Unable to persist generated image: ${uploaded.error.message}`);
    imageUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  }

  const prompt = promptFromPayload(payload);
  const inserted = await supabase.from("ai_generated_images").upsert(
    {
      id: jobId,
      user_id: userId,
      job_id: jobId,
      image_url: imageUrl,
      prompt,
      final_prompt: result.finalPrompt ?? prompt,
      task_type: result.taskType ?? workspace,
      model: result.model ?? "gpt-image-2",
      size: result.size ?? "unknown",
      quality: result.quality ?? "high",
      source: sourceName(endpoint),
      title: sourceName(endpoint),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (inserted.error)
    throw new Error(`Unable to save generation history: ${inserted.error.message}`);

  return { ...result, imageUrl, imageDataUrl: undefined };
}

async function executeEndpoint(
  endpoint: string,
  payload: unknown,
  request: Request,
  jobId: string,
  userId: string,
  workspace: string,
): Promise<GenerationResult> {
  let meta: GenerationMeta;
  let run: () => Promise<GenerationResult>;

  switch (endpoint) {
    case "/api/manga/generate-page": {
      const input = parseMangaImageGenerationInput(payload);
      meta = {
        workspace: "manga-page",
        operationType:
          input.operation === "edit"
            ? "edit"
            : input.operation === "regenerate"
              ? "regenerate"
              : "generate",
        durableJobId: jobId,
      };
      run = () => requestPulseNoteMangaImage(input);
      break;
    }
    case "/api/character/generate": {
      const input = parseCharacterImageInput(payload);
      meta = { workspace: "character-create", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNoteCharacterImage(input);
      break;
    }
    case "/api/sketch-final/generate": {
      const input = parseSketchFinalInput(payload);
      meta = { workspace: "raw-final", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNoteSketchFinal(input);
      break;
    }
    case "/api/style-transfer/generate": {
      const input = parseStyleTransferInput(payload);
      meta = { workspace: "style-transfer", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNoteStyleTransfer(input);
      break;
    }
    case "/api/planche-transfer/generate": {
      const input = parsePlancheTransferInput(payload);
      meta = { workspace: "planche-transfer", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNotePlancheTransfer(input);
      break;
    }
    case "/api/decor/generate": {
      const input = parseDecorImageInput(payload);
      meta = { workspace: "decor-create", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNoteDecorImage(input);
      break;
    }
    case "/api/free-studio/generate": {
      const input = parseFreeImageInput(payload);
      meta = { workspace: "free-studio", operationType: "generate", durableJobId: jobId };
      run = () => requestPulseNoteFreeImage(input);
      break;
    }
    default:
      throw new Error("Unsupported generation endpoint.");
  }

  const requestImage = run;
  run = async () => {
    const result = await requestImage();
    return persistGeneratedResult({ userId, jobId, workspace, endpoint, payload, result });
  };

  const outcome = await withCredits(request, meta, run);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

export async function processGenerationJob(jobId: string, authorization: string) {
  const supabase = getServiceSupabase();
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const authenticated = await supabase.auth.getUser(token);
    const userId = authenticated.data.user?.id;
    if (!userId) throw new Error("Authentication required.");

    const queried = await supabase
      .from("ai_generation_jobs")
      .select("id,user_id,workspace,endpoint,request_payload,status")
      .eq("id", jobId)
      .maybeSingle();
    if (queried.error || !queried.data) throw new Error("Generation job not found.");

    const job = queried.data as StoredJob;
    if (job.user_id !== userId) throw new Error("Generation job does not belong to this user.");
    if (job.status === "completed" || job.status === "failed") return;

    const now = new Date().toISOString();
    const claimed = await supabase
      .from("ai_generation_jobs")
      .update({ status: "running", started_at: now, updated_at: now })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimed.error) throw new Error(claimed.error.message);
    if (!claimed.data) return;

    try {
      const request = new Request("https://collabmanga.internal/api/generation", {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
      });
      const hydratedPayload = await hydrateGenerationPayload(job.request_payload);
      const result = await executeEndpoint(
        job.endpoint,
        hydratedPayload,
        request,
        job.id,
        userId,
        job.workspace,
      );
      const completedAt = new Date().toISOString();
      const updated = await supabase
        .from("ai_generation_jobs")
        .update({
          status: "completed",
          result_payload: result,
          error_message: null,
          completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", job.id);
      if (updated.error) throw new Error(updated.error.message);
    } catch (error) {
      const completedAt = new Date().toISOString();
      await supabase
        .from("ai_generation_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Generation failed.",
          completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq("id", job.id);
    } finally {
      await removeStagedGenerationImages(job.request_payload);
    }
  } catch (error) {
    const completedAt = new Date().toISOString();
    await supabase
      .from("ai_generation_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Generation failed.",
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", jobId)
      .in("status", ["queued", "running"]);
    throw error;
  }
}
