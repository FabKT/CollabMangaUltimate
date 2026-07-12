import { z } from "zod";

/**
 * Character-card generation plan.
 *
 * Builds the optimized prompt for a full character "card": in a single 3:2
 * image the same character is shown front / profile / back, plus six
 * head-and-shoulders expressions. For now the plan focuses on the card
 * DISPOSITION; precise per-style rendering details will be layered in later.
 *
 * The image itself is produced by the shared PulseNote backend. This module
 * owns the prompt engineering and forwards it; PulseNote must expose a
 * `/api/character/generate` endpoint that uses the provided prompt as-is
 * (passthrough, no manga-page locks) and renders at the requested size.
 */

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;
const CHARACTER_IMAGE_SIZE = "1536x1024"; // 3:2 landscape

const referenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageDataUrl: z.string().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

const characterInputSchema = z.object({
  prompt: z.string().default(""),
  identityImageDataUrl: z.string().min(1),
  identityReferenceName: z.string().optional(),
  styleId: z.string().default("current"),
  styleName: z.string().default("Style actuel"),
  styleDescription: z.string().default(""),
  styleImageDataUrl: z.string().optional(),
  structureImageDataUrl: z.string().optional(),
  references: z.array(referenceSchema).default([]),
});

export type CharacterImageInput = z.infer<typeof characterInputSchema>;

export type CharacterImageResult = {
  imageUrl: string;
  finalPrompt: string;
  model: string;
  size: string;
  createdAt: string;
  creditsUsed?: number;
};

type PulseNoteCharacterResponse = {
  imageDataUrl?: string;
  imageUrl?: string;
  finalPrompt?: string;
  model?: string;
  size?: string;
  createdAt?: string;
  creditsUsed?: number;
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

export function parseCharacterImageInput(data: unknown) {
  return characterInputSchema.parse(data);
}

/**
 * THE PLAN — builds the character-card prompt (disposition-focused for now).
 */
export function buildCharacterCardPrompt(input: CharacterImageInput): string {
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
    'Generate ONE character reference sheet (a "character card") as a single landscape 3:2 image, on a clean plain near-white background.',
    "",
    "CHARACTER DESCRIPTION (from the user, authoritative for identity):",
    input.prompt || "Use Image A as the authoritative character identity reference.",
    "",
    `TARGET STYLE: ${input.styleName}${input.styleDescription ? ` — ${input.styleDescription}` : ""}.`,
    "Image A is the mandatory character identity reference.",
    "Image B, when attached, is the character-card structure reference.",
    "Style reference images define the target rendering style.",
    "",
    "OUTFIT / REFERENCES:",
    references,
    "",
    "MANDATORY CARD DISPOSITION:",
    "The single image MUST show the SAME character with a strictly consistent design (identical hair, face, outfit, colors, proportions, and accessories) in every figure.",
    "",
    "TOP BAND — three full-body turnaround views, evenly spaced, same scale, standing in a neutral relaxed A-pose:",
    "  1) FRONT view (de face)",
    "  2) SIDE PROFILE view (de profil)",
    "  3) BACK view (de dos)",
    "",
    "BOTTOM BAND — six head-and-shoulders portraits of the SAME character, evenly spaced in a readable row, one distinct expression each, in this order:",
    "  1) very happy (très heureux)",
    "  2) angry (en colère)",
    "  3) sad (triste)",
    "  4) pleased / content (content)",
    "  5) arrogant (arrogant)",
    "  6) neutral (neutre)",
    "",
    "COMPOSITION RULES:",
    "- Clean gutters between every figure; nothing overlapping, nothing cut off by the frame.",
    "- Consistent lighting, line weight and identity across all figures.",
    "- Plain near-white background, model-sheet presentation, no decorative scenery, no text labels.",
    "- Landscape 3:2 orientation, all figures fitting comfortably inside the frame.",
  ].join("\n");
}

export async function requestPulseNoteCharacterImage(
  input: CharacterImageInput,
): Promise<CharacterImageResult> {
  const backendUrl = getBackendUrl();
  const appToken = getAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote.",
    );
  }

  const finalPrompt = buildCharacterCardPrompt(input);

  const response = await fetch(`${backendUrl}/api/character/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": "manga-forge",
      "x-app-token": appToken,
    },
    body: JSON.stringify({
      project: "manga-forge",
      task: "character_card_generation",
      prompt: input.prompt,
      size: CHARACTER_IMAGE_SIZE,
      aspectRatio: "3:2",
      identityImageDataUrl: input.identityImageDataUrl,
      identityReferenceName: input.identityReferenceName,
      styleId: input.styleId,
      styleName: input.styleName,
      styleDescription: input.styleDescription,
      styleImageDataUrl: input.styleImageDataUrl,
      structureImageDataUrl: input.structureImageDataUrl,
      references: input.references,
    }),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: PulseNoteCharacterResponse = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(
      payload.error || `PulseNote character generation failed with status ${response.status}.`,
    );
  }

  const imageUrl = payload.imageDataUrl || payload.imageUrl;
  if (!imageUrl) {
    throw new Error("PulseNote returned no character image.");
  }

  return {
    imageUrl,
    finalPrompt: payload.finalPrompt ?? finalPrompt,
    model: payload.model ?? "gpt-image-2",
    size: payload.size ?? CHARACTER_IMAGE_SIZE,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    creditsUsed: payload.creditsUsed,
  };
}
