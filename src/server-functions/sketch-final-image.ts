import { z } from "zod";

/**
 * Sketch-to-final plan.
 *
 * Takes a near-finished manga sketch and turns it into a clean, polished final
 * illustration in a single pass, preserving the composition and content. This
 * module owns the prompt engineering and forwards it to PulseNote, which must
 * expose a `/api/sketch-final/generate` endpoint performing the image-to-image
 * finishing from the provided sketch + prompt.
 */

const DEFAULT_PULSENOTE_BACKEND_URL = "https://pulsenote.onrender.com";
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

const sketchReferenceSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  imageDataUrl: z.string().min(1),
  description: z.string().optional(),
});

const sketchFinalInputSchema = z.object({
  baseImageDataUrl: z.string().optional(),
  sketchImageDataUrl: z.string().optional(),
  styleImageDataUrl: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Style actuel"),
  styleDescription: z.string().default(""),
  elementReferences: z.array(sketchReferenceSchema).default([]),
  references: z.array(sketchReferenceSchema).default([]),
  notes: z.string().optional(),
  prompt: z.string().optional(),
  size: z.enum(["1024x1536", "1536x1024"]).optional(),
}).refine((data) => data.sketchImageDataUrl || data.baseImageDataUrl, {
  message: "Missing sketch image.",
  path: ["sketchImageDataUrl"],
});

export type SketchFinalInput = z.infer<typeof sketchFinalInputSchema>;

export type SketchFinalResult = {
  imageUrl: string;
  finalPrompt: string;
  model: string;
  size: string;
  createdAt: string;
  creditsUsed?: number;
};

type PulseNoteSketchFinalResponse = {
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

export function parseSketchFinalInput(data: unknown) {
  return sketchFinalInputSchema.parse(data);
}

export function buildSketchFinalPrompt(input: SketchFinalInput): string {
  const references = [...input.elementReferences, ...input.references];
  return [
    "SKETCH TO FINISHED IMAGE BACKEND PROMPT",
    "WITH MANDATORY STYLE REFERENCE",
    "",
    "Image A is the sketch reference. It controls composition, framing, camera angle, pose, expression, hand placement, body orientation, speech bubble placement, panel logic, and spatial relationships.",
    "Image B is the finished-style reference. It controls final rendering style, lineart, face rendering, eye rendering, hair rendering, shading, texture level, value logic, and polish level.",
    "Image C and following, if provided, are element or character identity references. They define who or what the sketched elements are, without changing Image A composition.",
    "",
    "CORE RULE:",
    "Image A controls WHAT is drawn and WHERE everything is placed.",
    "Image B controls HOW the final image is rendered.",
    "Reference images after Image B control WHO/WHAT specific elements are, if provided.",
    "Do not let style or element references change the sketch composition, pose, framing, or scene.",
    "",
    "FINAL OBJECTIVE:",
    "Create a polished finished version of Image A, faithfully rendered in the finished style of Image B.",
    "",
    "STRICT SKETCH LOCK:",
    "Do not change the pose, expression, framing, camera angle, hand placement, body direction, bubbles, panel logic, or spatial relationships.",
    "Do not add new characters, remove important elements, or invent a new scene.",
    "",
    "STYLE REFERENCE LOCK:",
    `Use the selected finished style: ${input.styleName}${input.styleDescription ? ` - ${input.styleDescription}` : ""}.`,
    "The final image must visually match Image B in line quality, finishing level, eye style, hair rendering, shading logic, value/color treatment, texture level, and polish.",
    "",
    "ELEMENT REFERENCES:",
    references.length
      ? references
          .map((reference, index) =>
            [
              `- Reference ${index + 1}: ${reference.name || "Element reference"}`,
              reference.description ? `  Utility: ${reference.description}` : "",
              "  Use this only to identify or finish the matching element already present in the sketch.",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n")
      : "- None provided.",
    "",
    "ANATOMY CLEANUP RULE:",
    "Correct rough anatomy only when necessary: clean proportions, clarify fingers, refine face, clean hair, finish clothes, and remove construction lines.",
    "Never change gesture, hand placement, body direction, expression, or scene.",
    input.notes?.trim() || input.prompt?.trim()
      ? `\nADDITIONAL USER INSTRUCTIONS:\n${(input.notes || input.prompt || "").trim()}`
      : "",
    "",
    "FINAL INSTRUCTION:",
    "Generate the same scene as Image A, faithfully finished in the style of Image B, using the optional element references only for identity and visual details.",
    "The result must look like the sketch from Image A was professionally completed using the visual style of Image B.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function requestPulseNoteSketchFinal(
  input: SketchFinalInput,
): Promise<SketchFinalResult> {
  const backendUrl = getBackendUrl();
  const appToken = getAppToken();

  if (!appToken) {
    throw new Error(
      "PULSENOTE_APP_TOKEN is not configured on the server. Add it to .env.local with the same value as APP_CLIENT_TOKEN in PulseNote.",
    );
  }

  const finalPrompt = buildSketchFinalPrompt(input);
  const sketchImageDataUrl = input.sketchImageDataUrl || input.baseImageDataUrl;
  const references = [...input.elementReferences, ...input.references];

  const response = await fetch(`${backendUrl}/api/sketch-final/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-id": "manga-forge",
      "x-app-token": appToken,
    },
    body: JSON.stringify({
      project: "manga-forge",
      task: "sketch_to_final",
      prompt: finalPrompt,
      sketchImageDataUrl,
      baseImageDataUrl: sketchImageDataUrl,
      styleImageDataUrl: input.styleImageDataUrl,
      styleId: input.styleId,
      styleName: input.styleName,
      styleDescription: input.styleDescription,
      elementReferences: references,
      notes: input.notes || input.prompt,
      size: input.size,
    }),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: PulseNoteSketchFinalResponse = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(
      payload.error || `PulseNote sketch finishing failed with status ${response.status}.`,
    );
  }

  const imageUrl = payload.imageDataUrl || payload.imageUrl;
  if (!imageUrl) {
    throw new Error("PulseNote returned no finished image.");
  }

  return {
    imageUrl,
    finalPrompt: payload.finalPrompt ?? finalPrompt,
    model: payload.model ?? "gpt-image-2",
    size: payload.size ?? "unknown",
    createdAt: payload.createdAt ?? new Date().toISOString(),
    creditsUsed: payload.creditsUsed,
  };
}
