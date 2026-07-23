import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";
import { buildStylePlan } from "@/lib/ai-style-plans";
import { requestPulseNoteMangaImage } from "@/server-functions/manga-image";

/**
 * Style-transfer plan.
 *
 * Takes a base character image and re-renders it in a target manga style while
 * preserving identity, outfit, pose and composition. This module owns the
 * prompt engineering and forwards the edit to PulseNote's shared manga image
 * endpoint using the provided base image + style references.
 */

const styleTransferInputSchema = z.object({
  baseImageDataUrl: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Moderne"),
  styleDescription: z.string().default(""),
  customStyleImages: z.array(z.string()).default([]),
  aspectRatio: z.enum(["2:3", "3:2"]).default("2:3"),
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
  aspectRatio: "2:3" | "3:2";
}): Promise<StyleTransferResult> {
  const result = await requestPulseNoteMangaImage({
    operation: "edit",
    prompt: input.prompt,
    editPrompt: input.prompt,
    editScope: "full",
    activePage: 1,
    pages: [1],
    panelCount: input.task === "page_style_transfer" ? 6 : 1,
    panelInstructions: [],
    selectedAssets: input.styleReferenceImages.map((imageDataUrl, index) => ({
      id: `style-reference-${index + 1}`,
      name: `${input.styleName} style reference ${index + 1}`,
      role: "Style" as const,
      imageDataUrl,
      description:
        "Mandatory rendering-style reference only. Extract lineart, faces, eyes, hair, shading, tones, texture and finish; never copy its depicted content.",
    })),
    characters: [],
    styleMode: "auto",
    backgroundLevel: "auto",
    readingDirection: "right-to-left",
    aspectRatio: input.aspectRatio,
    existingImageDataUrl: input.baseImageDataUrl,
  });

  return {
    imageUrl: result.imageUrl,
    finalPrompt: result.finalPrompt,
    model: result.model,
    size: result.size,
    createdAt: result.createdAt,
    creditsUsed: result.creditsUsed,
    costUsd: result.costUsd,
    usage: result.usage,
  };
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
    aspectRatio: input.aspectRatio,
  });
}
