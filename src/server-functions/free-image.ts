import { z } from "zod";
import {
  requestPulseNoteMangaImage,
  type MangaImageGenerationResult,
} from "@/server-functions/manga-image";

const freeReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageDataUrl: z.string().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

const freeImageInputSchema = z.object({
  prompt: z.string().min(1),
  references: z.array(freeReferenceSchema).default([]),
  aspectRatio: z.enum(["2:3", "3:2"]).default("2:3"),
});

export type FreeImageInput = z.infer<typeof freeImageInputSchema>;
export type FreeImageResult = MangaImageGenerationResult;

export function parseFreeImageInput(data: unknown) {
  return freeImageInputSchema.parse(data);
}

export function buildFreeImagePrompt(input: FreeImageInput) {
  const referencePlan = input.references.length
    ? input.references
        .map(
          (reference, index) =>
            `REFERENCE_${index + 1} (${reference.name}): ${reference.description?.trim() || "Analyze its useful visual information and apply it only where relevant to the user's request."}`,
        )
        .join("\n")
    : "No reference image is provided.";

  return `FREE CREATION PROMPT OPTIMIZATION PLAN

Create the image requested by the user. First convert the request into a precise, production-ready visual plan, then generate the image from that plan. Preserve the user's intent and never add a major narrative element that was not requested.

1. REQUEST ANALYSIS
- Identify the image type: single illustration, manga panel, manga page, character scene, environment, object, or another requested format.
- Identify every mandatory subject, action, relationship, setting, visual style, text element, and restriction.
- Resolve only harmless ambiguities through visually coherent choices. Do not contradict explicit instructions.

2. COMPOSITION AND CAMERA
- Define the framing, shot scale, camera angle, perspective, focal point, depth, foreground, middle ground, and background.
- Make spatial relationships and visual hierarchy unambiguous.
- Keep all important subjects readable and correctly placed.

3. CHARACTERS
- For every character, define identity, placement, body orientation, pose, gesture, gaze, facial expression, emotional intensity, outfit, and interaction.
- Maintain anatomy, hands, proportions, and identity consistency.
- If references define a character, preserve that identity while adapting pose and expression to the request.

4. MANGA PAGE OR MULTI-PANEL STRUCTURE
- Apply this section only when the user requests a page or multiple panels.
- State the exact page division and panel geometry, including vertical, horizontal, diagonal, or irregular separators.
- Preserve reading order and narrative rhythm.
- Describe every panel separately: composition, camera, characters, action, expression, environment, effects, bubbles, and text.
- Keep recurring characters and locations consistent from panel to panel.

5. STYLE AND FINISH
- Translate the requested style into concrete lineart, shapes, color or monochrome logic, shading, texture, contrast, lighting, and detail level.
- Keep the finish coherent across the entire image.
- Do not let a reference's incidental composition replace the user's requested composition unless explicitly requested.

6. REFERENCE IMAGE ROLES
${referencePlan}
- Inspect every supplied image directly.
- Extract the useful identity, pose, composition, environment, object, lighting, or style information indicated by its description and by the user request.
- References support the final prompt but do not override explicit user instructions.

7. FINAL LOCK
- Generate one complete image in ${input.aspectRatio} format.
- Follow the optimized visual plan faithfully.
- Do not output planning text, labels, annotations, or explanations inside the image unless the user explicitly requests them.

USER REQUEST:
${input.prompt.trim()}`;
}

export async function requestPulseNoteFreeImage(input: FreeImageInput): Promise<FreeImageResult> {
  const optimizedPrompt = buildFreeImagePrompt(input);
  return requestPulseNoteMangaImage({
    operation: "generate",
    prompt: optimizedPrompt,
    activePage: 1,
    pages: [1],
    panelCount: 1,
    panelInstructions: [],
    selectedAssets: input.references.map((reference) => ({
      id: reference.id,
      name: reference.name,
      role: "Inspiration" as const,
      imageDataUrl: reference.imageDataUrl,
      mimeType: reference.mimeType,
      description: reference.description,
    })),
    characters: [],
    styleMode: "auto",
    backgroundLevel: "auto",
    readingDirection: "right-to-left",
    aspectRatio: input.aspectRatio,
  });
}
