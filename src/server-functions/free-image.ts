import { z } from "zod";
import {
  requestPulseNoteMangaImage,
  type MangaImageGenerationResult,
} from "@/server-functions/manga-image";
import { LOCAL_MANGA_PAGE_PLAN } from "@/lib/ai-style-plans";

const freeReferenceRoleSchema = z.enum([
  "Character",
  "Background",
  "Object",
  "Storyboard",
  "Pose",
  "Style",
  "Inspiration",
]);

const freeReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageDataUrl: z.string().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
  role: freeReferenceRoleSchema.default("Inspiration"),
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
            `REFERENCE_${index + 1} (${reference.name}) - DECLARED ROLE: ${reference.role}. ${reference.description?.trim() || "Inspect the image directly and extract every reliable visual fact relevant to its declared role."}`,
        )
        .join("\n")
    : "No reference image is provided.";

  return `${LOCAL_MANGA_PAGE_PLAN}

FREE STUDIO ADAPTATION:
- Create one complete image in ${input.aspectRatio} format from the user's request.
- There is no dedicated mandatory structure image in this workspace. Never assume that the first reference controls layout.
- A reference declared as Storyboard controls panel/page structure only. If none is declared, derive structure from the user request and use a clear default only when needed.
- Analyze every supplied image directly and convert its reliable visual information into explicit, self-sufficient generation instructions before rendering.
- Respect each declared role strictly: Character controls identity; Pose controls body action; Storyboard controls layout; Background and Object control their named content; Style controls rendering mechanisms only; Inspiration supplies only relevant non-conflicting cues.
- For each useful reference, identify concrete facts such as identity markers, posture, gaze, expression, framing, foreground, middle ground, background, lighting, geometry, materials, linework and value treatment. Do not merely mention that a reference exists.

REFERENCE ASSIGNMENTS:
${referencePlan}

USER REQUEST - HIGHEST PRIORITY:
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
      role: reference.role,
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
