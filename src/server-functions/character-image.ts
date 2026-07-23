import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";
import { buildStylePlan } from "@/lib/ai-style-plans";
import { isLocalAiServerMode } from "@/lib/local-ai-mode";
import { fitPromptToApiLimit } from "@/lib/prompt-limit";

/**
 * Character-card generation plan.
 *
 * Builds the optimized prompt for a full character "card": in a single 3:2
 * image the same character is shown front / back / profile, plus five
 * head-and-shoulders expressions. The selected style plan is shared with the
 * other style-conversion workspaces.
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
  styleName: z.string().default("Moderne"),
  styleDescription: z.string().default(""),
  styleImageDataUrl: z.string().optional(),
  styleReferenceImages: z.array(z.string()).default([]),
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
  costUsd?: number;
  usage?: GenerationUsage;
};

type PulseNoteCharacterResponse = {
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

export function parseCharacterImageInput(data: unknown) {
  return characterInputSchema.parse(data);
}

function supportingIdentityReferences(input: CharacterImageInput) {
  return input.references
    .filter((reference) => Boolean(reference.imageDataUrl))
    .map((reference, index) => {
      const userFocus = reference.description?.trim();
      return {
        ...reference,
        description: `Supporting identity reference ${index + 1} of the SAME target character as Image A. Inspect and use every visible identity fact that this view reveals: facial proportions, eye shape, hairstyle construction, body build, outfit, accessories, colors or monochrome values, asymmetrical details and silhouette. Reconcile it with Image A; do not copy its pose, framing, background, text or source rendering style.${userFocus ? ` User-provided focus: ${userFocus}` : ""}`,
      };
    });
}

/**
 * THE PLAN — builds the character-card prompt (disposition-focused for now).
 */
export function buildCharacterCardPrompt(input: CharacterImageInput): string {
  const normalizedStyleId = input.styleId.toLowerCase();
  const styleReferenceIsImageB =
    normalizedStyleId === "current" ||
    normalizedStyleId === "classic" ||
    normalizedStyleId === "retro90" ||
    normalizedStyleId.includes("90");
  const references =
    supportingIdentityReferences(input)
      .filter((reference) => reference.name || reference.description)
      .map(
        (reference, index) =>
          `  - Reference ${index + 1}: ${reference.name}${
            reference.description ? ` — ${reference.description}` : ""
          }`,
      )
      .join("\n") || "  - none provided";

  const stylePlan = buildStylePlan({
    styleId: input.styleId,
    styleName: input.styleName,
    styleDescription: input.styleDescription,
    hasReferenceImages: Boolean(input.styleImageDataUrl || input.styleReferenceImages.length),
    usage: "character-card",
  });

  return [
    "CHARACTER CARD GENERATION PLAN:",
    "Generate ONE professional character sheet as a single horizontal 3:2 image on a clean white or near-white background.",
    "",
    "IMAGE ROLES AND SOURCE ISOLATION:",
    "Image A is the mandatory character identity reference. It alone defines who the character is: face, recognizable eye shape, hairstyle, age impression, build, outfit, accessories, silhouette and distinguishing features.",
    styleReferenceIsImageB
      ? "Image B and any additional style-library images define target rendering mechanisms only. They must not transfer their depicted person, pose, clothing, scene, text or composition."
      : "Image B, when attached, defines character-card structure only. It must not transfer its depicted character or style.",
    styleReferenceIsImageB
      ? "Image C, when attached, defines character-card structure only. It must not transfer its depicted character or style."
      : "Image C and any additional style-library images define target rendering mechanisms only. They must not transfer their depicted person, pose, clothing, scene, text or composition.",
    "Every attached extra identity reference is mandatory supporting evidence of the SAME target character. Inspect each one and actively preserve the additional face, hair, body, outfit, accessory, color/value, silhouette and asymmetrical facts it reveals. Never silently ignore an attached identity reference.",
    "Reconcile supporting references with Image A: Image A remains authoritative when facts conflict. Supporting references must never transfer their pose, framing, background, text, composition or source rendering style.",
    "User instructions override defaults only where explicit. Preserve all unrelated identity facts.",
    "",
    "USER INSTRUCTIONS:",
    input.prompt || "Use Image A as the authoritative character identity reference.",
    "",
    stylePlan,
    "",
    "EXTRA REFERENCE INVENTORY:",
    references,
    "",
    "MANDATORY CARD STRUCTURE:",
    "Follow Image C strictly when supplied. Otherwise use this default layout without adding labels or annotations:",
    "- one horizontal 3:2 canvas with generous clean margins and a subtle horizontal separation between rows;",
    "- upper row: three evenly spaced full-body views at the same scale, fully visible from head to feet;",
    "- lower row: five evenly spaced head-and-shoulders portraits, large enough for clear facial comparison.",
    "",
    "UPPER ROW - EXACT ORDER:",
    "1) FRONT view on the left: full outfit and facial identity readable; neutral reference stance.",
    "2) BACK view in the center: exact hairstyle, outfit and accessories reconstructed from behind; same proportions and scale.",
    "3) STRICT SIDE/PROFILE view on the right: true profile of face, nose, chin, hair silhouette and outfit; do not turn toward the camera.",
    "",
    "LOWER ROW - EXACT ORDER:",
    "1) content / lightly pleased: restrained soft smile;",
    "2) very happy: clearly cheerful open smile;",
    "3) neutral: calm and composed;",
    "4) angry: tense brows, sharper gaze and firm mouth;",
    "5) sad: softened eyes, subdued mouth and restrained emotional weight.",
    "",
    "IDENTITY AND ORTHOGRAPHIC LOCK:",
    "Every view is the same person. Keep facial ratios, hairstyle construction, age, gender presentation, body build, outfit, colors/values, accessories and asymmetrical details stable. Expressions may deform expression muscles only, never identity.",
    "Infer hidden back/profile details conservatively from Image A and supporting references. Do not invent decorative features. Keep hands readable and anatomy coherent.",
    "",
    "TEXT AND CLEANLINESS LOCK:",
    "Do not add title, labels, captions, measurements, notes, logos, decorative typography, extra views, props or scenery unless explicitly requested. Nothing may overlap or be cropped by the canvas.",
    "",
    "FINAL CHECK:",
    "Confirm horizontal 3:2 format, exact 3+5 view count and order, one locked identity, one locked outfit, true back/profile reconstruction, target-style dominance, clean background and no unauthorized text.",
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

  const finalPrompt = fitPromptToApiLimit(buildCharacterCardPrompt(input));
  const localPlanEnabled = isLocalAiServerMode();
  const identityReferences = supportingIdentityReferences(input);
  const styleLibraryReferences = input.styleReferenceImages
    .filter((imageDataUrl) => Boolean(imageDataUrl && imageDataUrl !== input.styleImageDataUrl))
    .map((imageDataUrl, index) => ({
      id: `style-library-${index + 1}`,
      name: `${input.styleName} style reference ${index + 1}`,
      imageDataUrl,
      description:
        "Mandatory target rendering-style evidence only. Analyze and apply its lineart, shapes, value logic, eye/face/hair treatment, shading, texture and polish. Do not copy identity, pose, anatomy, outfit, scene, text or composition.",
    }));

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
      prompt: localPlanEnabled ? finalPrompt : fitPromptToApiLimit(input.prompt),
      size: CHARACTER_IMAGE_SIZE,
      aspectRatio: "3:2",
      identityImageDataUrl: input.identityImageDataUrl,
      identityReferenceName: input.identityReferenceName,
      styleId: input.styleId,
      styleName: input.styleName,
      styleDescription: input.styleDescription,
      styleImageDataUrl: input.styleImageDataUrl,
      styleReferenceImages: input.styleReferenceImages,
      structureImageDataUrl: input.structureImageDataUrl,
      references: [...identityReferences, ...styleLibraryReferences],
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
    costUsd: payload.costUsd,
    usage: payload.usage,
  };
}
