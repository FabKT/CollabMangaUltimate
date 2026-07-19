import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";

/**
 * Decor / background generation plan.
 *
 * Mirrors the character-card flow but produces a single reusable manga
 * background scene. For now the plan focuses on the DISPOSITION; precise
 * per-style rendering details will be layered in later. PulseNote must expose
 * a `/api/decor/generate` endpoint that uses the provided prompt as-is.
 */

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;
const DECOR_IMAGE_SIZE = "1536x1024"; // 3:2 landscape

const referenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageDataUrl: z.string().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

const decorInputSchema = z.object({
  prompt: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Style actuel"),
  styleDescription: z.string().default(""),
  styleImageDataUrl: z.string().optional(),
  references: z.array(referenceSchema).default([]),
});

export type DecorImageInput = z.infer<typeof decorInputSchema>;

export type DecorImageResult = {
  imageUrl: string;
  finalPrompt: string;
  model: string;
  size: string;
  createdAt: string;
  creditsUsed?: number;
  costUsd?: number;
  usage?: GenerationUsage;
};

type PulseNoteDecorResponse = {
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

export function parseDecorImageInput(data: unknown) {
  return decorInputSchema.parse(data);
}

export function buildDecorPrompt(input: DecorImageInput): string {
  const references =
    input.references
      .filter((reference) => reference.name || reference.description)
      .map(
        (reference, index) =>
          `  - Reference ${index + 1}: ${reference.name}${
            reference.description ? ` — ${reference.description}` : ""
          }`,
      )
      .join("\n") || "  - none provided";

  return [
    "OBJECTIVE:",
    "Generate ONE detailed manga background / decor scene as a single landscape 3:2 image, clean and reusable as a manga page background.",
    "",
    "DECOR DESCRIPTION (from the user, authoritative):",
    input.prompt,
    "",
    `TARGET STYLE: ${input.styleName}${input.styleDescription ? ` — ${input.styleDescription}` : ""}.`,
    "If a style reference image is attached, it is the authoritative look for linework, shading and rendering.",
    "",
    "REFERENCES:",
    references,
    "",
    "MANDATORY COMPOSITION:",
    "- A single cohesive establishing scene, usable as a page background (no character focus; only incidental silhouettes if any).",
    "- Clear readable depth: foreground, midground and background well separated.",
    "- Consistent lighting, perspective and vanishing points.",
    "- Match the target style's linework, shading and rendering.",
    "- Landscape 3:2 orientation, nothing important cropped by the frame, no text.",
  ].join("\n");
}

export async function requestPulseNoteDecorImage(
  input: DecorImageInput,
): Promise<DecorImageResult> {
  const backendUrl = getBackendUrl();
  const appToken = getAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote.",
    );
  }

  const finalPrompt = buildDecorPrompt(input);
  const referenceImages = input.references
    .map((reference) => reference.imageDataUrl)
    .filter((url): url is string => Boolean(url));

  const response = await fetch(`${backendUrl}/api/decor/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": "manga-forge",
      "x-app-token": appToken,
    },
    body: JSON.stringify({
      project: "manga-forge",
      task: "decor_generation",
      prompt: finalPrompt,
      size: DECOR_IMAGE_SIZE,
      aspectRatio: "3:2",
      styleId: input.styleId,
      styleName: input.styleName,
      styleImageDataUrl: input.styleImageDataUrl,
      referenceImages,
    }),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: PulseNoteDecorResponse = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(
      payload.error || `PulseNote decor generation failed with status ${response.status}.`,
    );
  }

  const imageUrl = payload.imageDataUrl || payload.imageUrl;
  if (!imageUrl) {
    throw new Error("PulseNote returned no decor image.");
  }

  return {
    imageUrl,
    finalPrompt: payload.finalPrompt ?? finalPrompt,
    model: payload.model ?? "gpt-image-2",
    size: payload.size ?? DECOR_IMAGE_SIZE,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    creditsUsed: payload.creditsUsed,
    costUsd: payload.costUsd,
    usage: payload.usage,
  };
}
