import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";

/**
 * Style-transfer plan.
 *
 * Takes a base character image and re-renders it in a target manga style while
 * preserving identity, outfit, pose and composition. This module owns the
 * prompt engineering and forwards it to PulseNote; PulseNote must expose a
 * `/api/style-transfer/generate` endpoint that performs the image-to-image
 * restyle using the provided base image + prompt.
 */

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const styleTransferInputSchema = z.object({
  baseImageDataUrl: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Style actuel"),
  styleDescription: z.string().default(""),
  customStyleImages: z.array(z.string()).default([]),
});

export type StyleTransferInput = z.infer<typeof styleTransferInputSchema>;

export type StyleTransferResult = {
  imageUrl: string;
  finalPrompt: string;
  model: string;
  size: string;
  createdAt: string;
  creditsUsed?: number;
  costUsd?: number;
  usage?: GenerationUsage;
};

type PulseNoteStyleTransferResponse = {
  imageDataUrl?: string;
  imageUrl?: string;
  finalPrompt?: string;
  model?: string;
  size?: string;
  createdAt?: string;
  creditsUsed?: number;
  costUsd?: number;
  usage?: GenerationUsage;
  error?: string;
};

function getEnv(name: string) {
  if (typeof process !== "undefined" && process.env[name]) {
    return process.env[name];
  }
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name];
}

function getBackendUrl() {
  const rawUrl =
    getEnv("PULSENOTE_BACKEND_URL") || getEnv("AI_BACKEND_URL") || DEFAULT_PULSENOTE_BACKEND_URL;
  return rawUrl.replace(/\/+$/, "");
}

function getAppToken() {
  return getEnv("PULSENOTE_APP_TOKEN") || getEnv("APP_CLIENT_TOKEN");
}

export function parseStyleTransferInput(data: unknown) {
  return styleTransferInputSchema.parse(data);
}

export function buildStyleTransferPrompt(input: StyleTransferInput): string {
  const custom = input.customStyleImages.length > 0;

  return [
    "OBJECTIVE:",
    "Redraw the SAME character shown in the provided base image, changing ONLY the art style.",
    "",
    "IDENTITY & COMPOSITION LOCK:",
    "Preserve exactly the character's identity, face, hair, outfit, accessories, body proportions, pose, camera angle, framing and overall composition from the base image.",
    "Do not change who the character is, what they wear, or how they are posed. Do not add or remove elements.",
    "",
    custom
      ? "TARGET STYLE: match the art style of the attached style reference images — their linework, shading, color treatment and rendering."
      : `TARGET STYLE: ${input.styleName}${
          input.styleDescription ? ` — ${input.styleDescription}` : ""
        }. Re-render the character's linework, shading and rendering to fully match this style.`,
    "",
    "ONLY the rendering style changes; the character and the composition stay identical to the base image.",
  ].join("\n");
}

export async function requestPulseNoteStyleTransfer(
  input: StyleTransferInput,
): Promise<StyleTransferResult> {
  const backendUrl = getBackendUrl();
  const appToken = getAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote.",
    );
  }

  const finalPrompt = buildStyleTransferPrompt(input);

  const response = await fetch(`${backendUrl}/api/style-transfer/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": "manga-forge",
      "x-app-token": appToken,
    },
    body: JSON.stringify({
      project: "manga-forge",
      task: "style_transfer",
      prompt: finalPrompt,
      baseImageDataUrl: input.baseImageDataUrl,
      styleId: input.styleId,
      styleName: input.styleName,
      styleReferenceImages: input.customStyleImages,
    }),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: PulseNoteStyleTransferResponse = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(
      payload.error || `PulseNote style transfer failed with status ${response.status}.`,
    );
  }

  const imageUrl = payload.imageDataUrl || payload.imageUrl;
  if (!imageUrl) {
    throw new Error("PulseNote returned no restyled image.");
  }

  return {
    imageUrl,
    finalPrompt: payload.finalPrompt ?? finalPrompt,
    model: payload.model ?? "gpt-image-2",
    size: payload.size ?? "unknown",
    createdAt: payload.createdAt ?? new Date().toISOString(),
    creditsUsed: payload.creditsUsed,
    costUsd: payload.costUsd,
    usage: payload.usage,
  };
}
