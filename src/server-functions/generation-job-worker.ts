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
import { parseSwapImageInput, requestPulseNoteSwap } from "@/server-functions/swap-image";
import { parseDecorImageInput, requestPulseNoteDecorImage } from "@/server-functions/decor-image";
import { parseFreeImageInput, requestPulseNoteFreeImage } from "@/server-functions/free-image";

type GenerationResult = {
  imageUrl?: string;
  imageDataUrl?: string;
  model?: string;
  quality?: string;
  size?: string;
  costUsd?: number;
};

type StoredJob = {
  id: string;
  user_id: string;
  endpoint: string;
  request_payload: unknown;
  status: "queued" | "running" | "completed" | "failed";
};

async function executeEndpoint(
  endpoint: string,
  payload: unknown,
  request: Request,
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
      };
      run = () => requestPulseNoteMangaImage(input);
      break;
    }
    case "/api/character/generate": {
      const input = parseCharacterImageInput(payload);
      meta = { workspace: "character-create", operationType: "generate" };
      run = () => requestPulseNoteCharacterImage(input);
      break;
    }
    case "/api/sketch-final/generate": {
      const input = parseSketchFinalInput(payload);
      meta = { workspace: "raw-final", operationType: "generate" };
      run = () => requestPulseNoteSketchFinal(input);
      break;
    }
    case "/api/style-transfer/generate": {
      const input = parseStyleTransferInput(payload);
      meta = { workspace: "style-transfer", operationType: "generate" };
      run = () => requestPulseNoteStyleTransfer(input);
      break;
    }
    case "/api/planche-transfer/generate": {
      const input = parsePlancheTransferInput(payload);
      meta = { workspace: "planche-transfer", operationType: "generate" };
      run = () => requestPulseNotePlancheTransfer(input);
      break;
    }
    case "/api/swap/generate": {
      const input = parseSwapImageInput(payload);
      meta = { workspace: "swap", operationType: "edit" };
      run = () => requestPulseNoteSwap(input);
      break;
    }
    case "/api/decor/generate": {
      const input = parseDecorImageInput(payload);
      meta = { workspace: "decor-create", operationType: "generate" };
      run = () => requestPulseNoteDecorImage(input);
      break;
    }
    case "/api/free-studio/generate": {
      const input = parseFreeImageInput(payload);
      meta = { workspace: "free-studio", operationType: "generate" };
      run = () => requestPulseNoteFreeImage(input);
      break;
    }
    default:
      throw new Error("Unsupported generation endpoint.");
  }

  const outcome = await withCredits(request, meta, run);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

export async function processGenerationJob(jobId: string, authorization: string) {
  const supabase = getServiceSupabase();
  const token = authorization.replace(/^Bearer\s+/i, "");
  const authenticated = await supabase.auth.getUser(token);
  const userId = authenticated.data.user?.id;
  if (!userId) throw new Error("Authentication required.");

  const queried = await supabase
    .from("ai_generation_jobs")
    .select("id,user_id,endpoint,request_payload,status")
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
    const result = await executeEndpoint(job.endpoint, job.request_payload, request);
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
  }
}
