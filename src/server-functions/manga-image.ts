import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";

const roleSchema = z.enum(["Character", "Background", "Object", "Reference", "Generated Page"]);

const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: roleSchema,
  thumbHue: z.number().optional(),
});

const generationInputSchema = z.object({
  operation: z.enum(["generate", "edit", "regenerate"]),
  prompt: z.string().min(1),
  editPrompt: z.string().optional(),
  editScope: z.enum(["single", "full"]).optional(),
  activePage: z.number().int().positive(),
  pages: z.array(z.number().int().positive()).min(1),
  panelCount: z.number().int().positive().default(6),
  selectedAssets: z.array(assetSchema).default([]),
  existingImageDataUrl: z.string().optional(),
});

export type MangaImageGenerationInput = z.infer<typeof generationInputSchema>;

export type MangaImageTaskType =
  | "free_creation_with_references"
  | "storyboard_page_creation"
  | "existing_image_modification"
  | "strict_character_replacement"
  | "targeted_correction";

export type MangaImageGenerationResult = {
  imageUrl: string;
  finalPrompt: string;
  taskType: MangaImageTaskType;
  model: string;
  size: string;
  quality: string;
  createdAt: string;
  creditsUsed?: number;
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
    imageQuality?: string;
    imageFormat?: string;
    creditCost?: number;
    generationEndpoint?: string;
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

function responseErrorMessage(status: number, payload: PulseNoteMangaResponse) {
  const detail = payload.details?.message || payload.details?.code;
  const base = payload.error || `PulseNote manga generation failed with status ${status}.`;
  return detail ? `${base} ${detail}` : base;
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

async function checkPulseNoteMangaBackend() {
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
      signal: AbortSignal.timeout(10000),
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
      signal: AbortSignal.timeout(10000),
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

async function requestPulseNoteMangaImage(data: MangaImageGenerationInput) {
  const backendUrl = getPulseNoteBackendUrl();
  const appToken = getPulseNoteAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the Manga Forge server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote Render.",
    );
  }

  const response = await fetch(`${backendUrl}/api/manga/generate-page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": "manga-forge",
      "x-app-token": appToken,
    },
    body: JSON.stringify({
      project: "manga-forge",
      task: "manga_page_generation",
      ...data,
    }),
    signal: AbortSignal.timeout(140000),
  });

  const payload = await parsePulseNoteResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(response.status, payload));
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
    size: payload.size ?? "1024x1536",
    quality: payload.quality ?? "high",
    createdAt: payload.createdAt ?? new Date().toISOString(),
    creditsUsed: payload.creditsUsed,
  } satisfies MangaImageGenerationResult;
}

export const generateMangaImage = createServerFn({ method: "POST" })
  .validator((data: MangaImageGenerationInput) => generationInputSchema.parse(data))
  .handler(async ({ data }) => requestPulseNoteMangaImage(data));

export const checkMangaImageBackend = createServerFn({ method: "GET" }).handler(() =>
  checkPulseNoteMangaBackend(),
);
