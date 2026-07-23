import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";
import { buildStylePlan } from "@/lib/ai-style-plans";
import { fitPromptToApiLimit } from "@/lib/prompt-limit";

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
const GENERATION_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524]);

const styleTransferInputSchema = z.object({
  baseImageDataUrl: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Moderne"),
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("und_err")
  );
}

export function parseStyleTransferInput(data: unknown) {
  return styleTransferInputSchema.parse(data);
}

export function buildStyleTransferPrompt(input: StyleTransferInput): string {
  const custom = input.customStyleImages.length > 0;
  const stylePlan = buildStylePlan({
    styleId: input.styleId,
    styleName: input.styleName,
    styleDescription: input.styleDescription,
    hasReferenceImages: custom,
    usage: "character-transfer",
  });

  return [
    "CHARACTER STYLE-TRANSFER PLAN:",
    "Redraw the SAME character shown in Image A while changing ONLY the rendering language.",
    "",
    "IMAGE ROLES:",
    "Image A is the target character image. It controls identity, face, hair, body, outfit, accessories, pose, expression, gaze, gesture, anatomy, camera, framing, crop, background and composition.",
    custom
      ? "Image B and every additional attached style-library image control rendering style only. They do not control identity or content."
      : `The target style is defined textually as ${input.styleName}.`,
    "",
    stylePlan,
    "",
    "STRICT PRESERVATION:",
    "Keep exact face identity, hairstyle structure, body proportions, clothing design, accessories and distinguishing marks. Keep exact head/body orientation, pose, hands, expression, gaze, camera perspective, scale, placement, crop and background content.",
    "Do not beautify, redesign, age-shift, gender-shift, simplify identity, alter anatomy, invent details, remove elements, add elements or borrow depicted content from the style references.",
    "",
    "STYLE SUBSTITUTION:",
    "Replace only lineart, facial/eye/hair rendering, value system, shadows, tones, hatching, texture policy, color logic and polish level. The target style must dominate without creating a hybrid with the source rendering.",
    "",
    "FINAL CHECK:",
    "The result must be immediately recognizable as the exact same character image and composition as Image A, professionally redrawn in the selected style, with no unauthorized content or text.",
  ].join("\n");
}

export async function sendPulseNoteStyleTransfer(input: {
  task: "style_transfer" | "page_style_transfer";
  prompt: string;
  baseImageDataUrl: string;
  styleId: string;
  styleName: string;
  styleReferenceImages: string[];
}): Promise<StyleTransferResult> {
  const backendUrl = getBackendUrl();
  const appToken = getAppToken();
  const boundedInput = { ...input, prompt: fitPromptToApiLimit(input.prompt) };
  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the server. Add it to the deployment environment with the same value as APP_CLIENT_TOKEN in PulseNote.",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${backendUrl}/api/style-transfer/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-id": "manga-forge",
          "x-app-token": appToken,
        },
        body: JSON.stringify({ project: "manga-forge", ...boundedInput }),
        signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload: PulseNoteStyleTransferResponse = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : { error: await response.text().catch(() => "") };

      if (!response.ok) {
        const error = new Error(
          payload.error || `PulseNote style transfer failed with status ${response.status}.`,
        );
        if (attempt < GENERATION_ATTEMPTS && RETRYABLE_STATUSES.has(response.status)) {
          lastError = error;
          await wait(1200 * attempt);
          continue;
        }
        throw error;
      }

      const imageUrl = payload.imageDataUrl || payload.imageUrl;
      if (!imageUrl) throw new Error("PulseNote returned no restyled image.");
      return {
        imageUrl,
        finalPrompt: payload.finalPrompt ?? boundedInput.prompt,
        model: payload.model ?? "gpt-image-2",
        size: payload.size ?? "unknown",
        createdAt: payload.createdAt ?? new Date().toISOString(),
        creditsUsed: payload.creditsUsed,
        costUsd: payload.costUsd,
        usage: payload.usage,
      };
    } catch (error) {
      lastError = error;
      if (attempt < GENERATION_ATTEMPTS && isRetryableNetworkError(error)) {
        await wait(1200 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Style transfer failed.");
}

export async function requestPulseNoteStyleTransfer(
  input: StyleTransferInput,
): Promise<StyleTransferResult> {
  const finalPrompt = buildStyleTransferPrompt(input);
  return sendPulseNoteStyleTransfer({
    task: "style_transfer",
    prompt: finalPrompt,
    baseImageDataUrl: input.baseImageDataUrl,
    styleId: input.styleId,
    styleName: input.styleName,
    styleReferenceImages: input.customStyleImages,
  });
}
