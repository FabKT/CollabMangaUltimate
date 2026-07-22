import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";
import { errorMessage } from "@/lib/error-message";

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";
const PULSENOTE_STATUS_TIMEOUT_MS = 45_000;
const PULSENOTE_GENERATION_TIMEOUT_MS = 15 * 60 * 1000;
const PULSENOTE_GENERATION_ATTEMPTS = 2;
const PULSENOTE_RETRYABLE_STATUSES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524,
]);

const roleSchema = z.enum([
  "Character",
  "Background",
  "Object",
  "Storyboard",
  "Pose",
  "Style",
  "Inspiration",
  "Target",
  "Generated Page",
]);

const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  storyRole: z.string().optional(),
  identityLock: z.string().optional(),
  defaultExpression: z.string().optional(),
});

const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: roleSchema,
  thumbHue: z.number().optional(),
  imageDataUrl: z.string().optional(),
  mimeType: z.string().optional(),
  imageWidth: z.number().positive().optional(),
  imageHeight: z.number().positive().optional(),
  omitFromImageGeneration: z.boolean().optional(),
  characterId: z.string().optional(),
  characterName: z.string().optional(),
  characterProfile: z.string().optional(),
  description: z.string().optional(),
});

const generationInputSchema = z.object({
  operation: z.enum(["generate", "edit", "regenerate"]),
  prompt: z.string().min(1),
  editPrompt: z.string().optional(),
  editScope: z.enum(["single", "full"]).optional(),
  activePage: z.number().int().positive(),
  pages: z.array(z.number().int().positive()).min(1),
  panelCount: z.number().int().positive().default(6),
  panelInstructions: z.array(z.string()).default([]),
  selectedAssets: z.array(assetSchema).default([]),
  characters: z.array(characterSchema).default([]),
  styleMode: z.enum(["auto", "black-white", "color"]).default("auto"),
  backgroundLevel: z.enum(["auto", "empty", "minimal", "detailed"]).default("auto"),
  readingDirection: z.enum(["right-to-left", "left-to-right"]).default("right-to-left"),
  aspectRatio: z.enum(["2:3", "3:2"]).default("2:3"),
  existingImageDataUrl: z.string().optional(),
});

export type MangaImageGenerationInput = z.infer<typeof generationInputSchema>;

export type MangaImageTaskType =
  | "free_creation_with_references"
  | "storyboard_page_creation"
  | "existing_image_modification"
  | "strict_character_replacement"
  | "targeted_correction";

export type MangaImageDiagnostics = {
  taskType?: string;
  promptLength?: number;
  promptLimit?: number;
  promptCompacted?: boolean;
  maxImages?: number;
  providedImageCount?: number;
  imagesSentToOpenAI?: number;
  droppedImageCount?: number;
  structureImages?: number;
  referenceImages?: number;
  charactersUsed?: number;
  perCharacterImageCount?: Record<string, number>;
  charactersWithoutImage?: string[];
};

export type MangaImageGenerationResult = {
  imageUrl: string;
  finalPrompt: string;
  taskType: MangaImageTaskType;
  model: string;
  size: string;
  quality: string;
  createdAt: string;
  creditsUsed?: number;
  diagnostics?: MangaImageDiagnostics;
  costUsd?: number;
  usage?: GenerationUsage;
};

export type MangaBackendStatusResult = {
  ok: boolean;
  backendUrl: string;
  appTokenConfigured: boolean;
  health?: {
    ok?: boolean;
    service?: string;
  };
  manga?: {
    ok?: boolean;
    service?: string;
    mangaForgeEnabled?: boolean;
    imageModel?: string;
    imageSize?: string;
    supportedImageSizes?: string[];
    imageQuality?: string;
    imageFormat?: string;
    creditCost?: number;
    referenceImagesEnabled?: boolean;
    referenceImageAspectGuard?: boolean;
    generationEndpoint?: string;
    error?: string;
  };
  error?: string;
  checkedAt: string;
};

type PulseNoteMangaResponse = {
  imageDataUrl?: string;
  imageUrl?: string;
  finalPrompt?: string;
  taskType?: MangaImageTaskType;
  model?: string;
  size?: string;
  quality?: string;
  createdAt?: string;
  creditsUsed?: number;
  costUsd?: number;
  usage?: GenerationUsage;
  diagnostics?: MangaImageDiagnostics;
  error?: string;
  details?: {
    message?: string;
    status?: number | null;
    type?: string | null;
    code?: string | null;
  };
};

type PulseNoteStatusResponse = NonNullable<MangaBackendStatusResult["manga"]> & {
  error?: string;
};

function getEnv(name: string) {
  if (typeof process !== "undefined" && process.env[name]) {
    return process.env[name];
  }

  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name];
}

function getPulseNoteBackendUrl() {
  const rawUrl =
    getEnv("PULSENOTE_BACKEND_URL") || getEnv("AI_BACKEND_URL") || DEFAULT_PULSENOTE_BACKEND_URL;
  return rawUrl.replace(/\/+$/, "");
}

function getPulseNoteAppToken() {
  return getEnv("PULSENOTE_APP_TOKEN") || getEnv("APP_CLIENT_TOKEN");
}

function imageSizeForAspectRatio(aspectRatio: MangaImageGenerationInput["aspectRatio"]) {
  return aspectRatio === "3:2" ? "1536x1024" : "1024x1536";
}

function responseErrorMessage(status: number, payload: PulseNoteMangaResponse) {
  const detail = payload.details?.message || payload.details?.code;
  const base = payload.error || `PulseNote manga generation failed with status ${status}.`;
  return detail ? `${base} ${detail}` : base;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorText(error: unknown) {
  return errorMessage(error);
}

function shouldRetryPulseNoteNetworkError(error: unknown) {
  const message = errorText(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  return (
    name.includes("typeerror") ||
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("und_err")
  );
}

function shouldRetryPulseNoteResponse(status: number, payload: PulseNoteMangaResponse) {
  const detail = `${payload.error ?? ""} ${payload.details?.message ?? ""} ${
    payload.details?.code ?? ""
  }`.toLowerCase();

  return (
    PULSENOTE_RETRYABLE_STATUSES.has(status) ||
    detail.includes("fetch failed") ||
    detail.includes("temporarily unavailable") ||
    detail.includes("timeout")
  );
}

async function parsePulseNoteResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as PulseNoteMangaResponse;
  }

  const text = await response.text();
  return {
    error: text || "PulseNote returned a non-JSON response.",
  } satisfies PulseNoteMangaResponse;
}

async function parseResponseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return { error: text || "Backend returned a non-JSON response." } as T;
}

export function parseMangaImageGenerationInput(data: unknown) {
  return generationInputSchema.parse(data);
}

export async function checkPulseNoteMangaBackend() {
  const backendUrl = getPulseNoteBackendUrl();
  const appToken = getPulseNoteAppToken();
  const checkedAt = new Date().toISOString();
  const result: MangaBackendStatusResult = {
    ok: false,
    backendUrl,
    appTokenConfigured: Boolean(appToken),
    checkedAt,
  };

  try {
    const healthResponse = await fetch(`${backendUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(PULSENOTE_STATUS_TIMEOUT_MS),
    });
    result.health = await parseResponseJson<MangaBackendStatusResult["health"]>(healthResponse);

    if (!healthResponse.ok) {
      result.error = `PulseNote health check failed with status ${healthResponse.status}.`;
      return result;
    }

    if (!appToken) {
      result.error =
        "PULSENOTE_APP_TOKEN is missing on the CollabManga service. Copy APP_CLIENT_TOKEN from the PulseNote service into PULSENOTE_APP_TOKEN.";
      return result;
    }

    const mangaStatusResponse = await fetch(`${backendUrl}/api/manga/status`, {
      method: "GET",
      headers: {
        "x-app-id": "manga-forge",
        "x-app-token": appToken,
      },
      signal: AbortSignal.timeout(PULSENOTE_STATUS_TIMEOUT_MS),
    });
    result.manga = await parseResponseJson<PulseNoteStatusResponse>(mangaStatusResponse);

    if (!mangaStatusResponse.ok) {
      result.error =
        result.manga?.error ||
        `PulseNote manga status failed with status ${mangaStatusResponse.status}.`;
      return result;
    }

    if (result.manga?.mangaForgeEnabled === false) {
      result.error = "Manga Forge generation is disabled on the PulseNote backend.";
      return result;
    }

    result.ok = Boolean(result.health?.ok && result.manga?.ok);
    if (!result.ok) {
      result.error = "PulseNote responded, but the manga backend did not report ready.";
    }
    return result;
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : "Unable to reach the PulseNote manga backend.";
    return result;
  }
}

export async function requestPulseNoteMangaImage(data: MangaImageGenerationInput) {
  const backendUrl = getPulseNoteBackendUrl();
  const appToken = getPulseNoteAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the Manga Forge server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote Render.",
    );
  }

  const size = imageSizeForAspectRatio(data.aspectRatio);
  const body = JSON.stringify({
    project: "manga-forge",
    task: "manga_page_generation",
    size,
    ...data,
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= PULSENOTE_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${backendUrl}/api/manga/generate-page`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-id": "manga-forge",
          "x-app-token": appToken,
        },
        body,
        signal: AbortSignal.timeout(PULSENOTE_GENERATION_TIMEOUT_MS),
      });

      const payload = await parsePulseNoteResponse(response);
      if (!response.ok) {
        const message = responseErrorMessage(response.status, payload);
        if (
          attempt < PULSENOTE_GENERATION_ATTEMPTS &&
          shouldRetryPulseNoteResponse(response.status, payload)
        ) {
          await wait(1200 * attempt);
          continue;
        }

        throw new Error(message);
      }

      const imageUrl = payload.imageDataUrl || payload.imageUrl;
      if (!imageUrl) {
        throw new Error("PulseNote returned no generated image.");
      }

      return {
        imageUrl,
        finalPrompt: payload.finalPrompt ?? data.prompt,
        taskType: payload.taskType ?? "storyboard_page_creation",
        model: payload.model ?? "gpt-image-2",
        size: payload.size ?? size,
        quality: payload.quality ?? "high",
        createdAt: payload.createdAt ?? new Date().toISOString(),
        creditsUsed: payload.creditsUsed,
        diagnostics: payload.diagnostics,
        costUsd: payload.costUsd,
        usage: payload.usage,
      } satisfies MangaImageGenerationResult;
    } catch (error) {
      lastError = error;
      if (attempt < PULSENOTE_GENERATION_ATTEMPTS && shouldRetryPulseNoteNetworkError(error)) {
        await wait(1200 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw new Error(errorText(lastError) || "PulseNote manga generation failed.");
}

export const generateMangaImage = createServerFn({ method: "POST" })
  .validator((data: MangaImageGenerationInput) => generationInputSchema.parse(data))
  .handler(async ({ data }) => requestPulseNoteMangaImage(data));

export const checkMangaImageBackend = createServerFn({ method: "GET" }).handler(() =>
  checkPulseNoteMangaBackend(),
);
