import { z } from "zod";
import {
  requestPulseNoteMangaImage,
  type MangaImageGenerationResult,
} from "@/server-functions/manga-image";

const characterReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  imageDataUrl: z.string().min(1),
  mimeType: z.string().optional(),
  view: z.string().optional(),
  description: z.string().optional(),
});

const swapCharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  profile: z.string().optional(),
  references: z.array(characterReferenceSchema).min(1),
});

const swapPairSchema = z.object({
  id: z.string(),
  original: swapCharacterSchema,
  replacement: swapCharacterSchema,
});

const swapImageInputSchema = z.object({
  pageImageDataUrl: z.string().min(1),
  pairs: z.array(swapPairSchema).min(1),
  prompt: z.string().optional(),
  aspectRatio: z.enum(["2:3", "3:2"]).default("2:3"),
});

export type SwapImageInput = z.infer<typeof swapImageInputSchema>;
export type SwapImageResult = MangaImageGenerationResult;

export function parseSwapImageInput(data: unknown) {
  return swapImageInputSchema.parse(data);
}

export function buildSwapPrompt(input: SwapImageInput) {
  const mappings = input.pairs
    .map(
      (pair, index) =>
        `SWAP_${index + 1}: ORIGINAL_${index + 1} (${pair.original.name}) -> REPLACEMENT_${index + 1} (${pair.replacement.name}).`,
    )
    .join("\n");

  return `MULTI-CHARACTER SWAP BACKEND PROMPT
STRICT CHARACTER REPLACEMENT WITH PAGE PRESERVATION

You are editing an existing illustrated or manga page by replacing one or more original characters with externally provided replacement characters.

This is a strict character-exchange task. The final page must preserve the original page's structure, storytelling, composition, action, text, and visual style. The original characters must be replaced by their corresponding replacement characters.

1. INPUT ROLES

PAGE IMAGE is the mandatory page to edit. It defines the complete page layout, panels, compositions, camera angles, framing, poses, expressions, gestures, interactions, objects, backgrounds, dialogue bubbles, sound effects, text, and visual style.

Each ORIGINAL character reference identifies the character currently present in the page who must be located and removed. Each paired REPLACEMENT character reference defines who must replace that original character. The USER PROMPT provides optional explicit overrides.

2. FUNDAMENTAL RULE

The PAGE defines WHERE the character appears, HOW the character is posed and framed, WHAT expression and action the character has, and HOW the character interacts with the scene. The ORIGINAL reference defines WHICH character must be replaced. The paired REPLACEMENT reference defines WHO appears instead: face, hairstyle, morphology, distinguishing traits, and outfit by default.

3. CHARACTER-DETECTION PHASE

Before editing, identify every reliable occurrence of each original character across all panels using face, hairstyle, silhouette, outfit, accessories, body proportions, distinguishing features, and contextual continuity. Handle front, back, profile, three-quarter, occluded, small, moving, close-up, and partial-body appearances. Replace every reliable occurrence by default. Never replace an uncertain character at random.

4. MULTIPLE-SWAP MAPPING LOCK

${mappings}

Each original is permanently mapped only to its paired replacement. Never swap mappings, mix faces, hairstyles or outfits, merge identities, or transfer features between pairs. Analyze all pairs before editing.

5. IDENTITY REPLACEMENT LOCK

Remove the original identity completely. Replace face identity, hairstyle, hair structure, distinguishing facial traits, recognizable body identity, and outfit by default. Preserve pose, expression, gaze, body orientation, perspective, scale, placement, action, and interaction. The result must be unmistakably the replacement, never a hybrid.

6. EXACT POSE AND EXPRESSION LOCK

The replacement must adopt the exact pose and expression of the original occurrence. Preserve head position and tilt, neck and shoulder angles, torso and hip rotation, every limb and joint placement, hands and fingers, balance, body mechanics, eyebrows, eye openness, gaze, facial tension, mouth shape, and emotional intensity. Ignore the pose and expression shown in replacement references unless the user explicitly overrides them.

7. ORIENTATION, PERSPECTIVE, AND SILHOUETTE LOCK

Preserve viewing direction, camera distance, scale, foreshortening, perspective distortion, scene depth, body footprint, center of gravity, and action silhouette. Never rotate a replacement toward the camera. Infer back/profile details from its identity references while preserving the original orientation.

8. INTERACTION AND OCCLUSION LOCK

Preserve every interaction, object held, touch point, overlap, foreground/background relationship, crop, and occlusion. Do not reveal hidden areas or hide visible scene elements.

9. CLOTHING RULE

By default, use the replacement character's own outfit, reconstructed for the original pose, perspective, crop, orientation, and action. Adapt folds, fabric direction, hidden parts, and movement without changing the action or composition. An explicit user instruction may instead request the original outfit, a hybrid outfit, or a custom outfit.

10. ACCESSORIES AND PROPS

Preserve replacement identity accessories when they do not break the scene. Preserve every scene prop independently from clothing, including weapons, phones, bags, tools, sports equipment, and manipulated objects.

11. PAGE-STYLE PRESERVATION

Render each replacement using the page's exact lineart, shading, screentones, color logic, contrast, detail level, hair-rendering logic, and face-rendering logic. Replacement references define identity, not final rendering style. The replacement must look naturally drawn inside the original page, never pasted from another artwork.

12. TEXT AND BALLOON PRESERVATION

Preserve all dialogue, speech bubbles, tails, captions, sound effects, typography, and placement exactly. Keep each tail pointing to the same spatial position. Do not rewrite, remove, or move text unless explicitly requested.

13. USER-PROMPT OVERRIDES

Apply only explicit user overrides concerning panel or occurrence scope, clothing, accessories, expression, pose, style, preserved elements, or removed elements. Do not infer unrequested overrides.

14. PAGE PRESERVATION LOCK

Preserve panel count, layout, geometry, borders, framing, camera angles, backgrounds, objects, storytelling, reading order, and page rhythm. Do not regenerate a new composition, redesign the page, move panels, or change the narrative.

15. FINAL MANDATORY INSTRUCTION

Edit the provided page directly. For every mapped pair, locate the original character, remove its identity, and insert only its assigned replacement while preserving the original pose, expression, orientation, perspective, body mechanics, action, interactions, composition, text, and page style. Use the replacement outfit by default unless explicitly overridden.

The final result must clearly read as the exact same original page, with every selected original character perfectly replaced by its assigned replacement character.
${input.prompt?.trim() ? `\nUSER PROMPT - EXPLICIT OVERRIDES ONLY:\n${input.prompt.trim()}` : ""}`;
}

export async function requestPulseNoteSwap(input: SwapImageInput): Promise<SwapImageResult> {
  const prompt = buildSwapPrompt(input);
  const selectedAssets = input.pairs.flatMap((pair, pairIndex) => {
    const pairLabel = pairIndex + 1;
    return [
      ...pair.original.references.map((reference, imageIndex) => ({
        id: `swap-${pair.id}-original-${reference.id}-${imageIndex}`,
        name: `ORIGINAL_${pairLabel} - ${pair.original.name} - ${reference.name}`,
        role: "Character" as const,
        imageDataUrl: reference.imageDataUrl,
        mimeType: reference.mimeType,
        characterId: `original-${pair.id}`,
        characterName: `ORIGINAL_${pairLabel}: ${pair.original.name}`,
        characterProfile: pair.original.profile,
        description:
          `Identity reference for ORIGINAL_${pairLabel}. Locate and replace this character only. ${reference.view || ""} ${reference.description || ""}`.trim(),
      })),
      ...pair.replacement.references.map((reference, imageIndex) => ({
        id: `swap-${pair.id}-replacement-${reference.id}-${imageIndex}`,
        name: `REPLACEMENT_${pairLabel} - ${pair.replacement.name} - ${reference.name}`,
        role: "Character" as const,
        imageDataUrl: reference.imageDataUrl,
        mimeType: reference.mimeType,
        characterId: `replacement-${pair.id}`,
        characterName: `REPLACEMENT_${pairLabel}: ${pair.replacement.name}`,
        characterProfile: pair.replacement.profile,
        description:
          `Identity reference for REPLACEMENT_${pairLabel}. This character replaces ORIGINAL_${pairLabel}. ${reference.view || ""} ${reference.description || ""}`.trim(),
      })),
    ];
  });

  return requestPulseNoteMangaImage({
    operation: "edit",
    prompt,
    editPrompt: input.prompt,
    editScope: "full",
    activePage: 1,
    pages: [1],
    panelCount: 1,
    panelInstructions: [],
    selectedAssets,
    characters: input.pairs.flatMap((pair, index) => [
      {
        id: `original-${pair.id}`,
        name: `ORIGINAL_${index + 1}: ${pair.original.name}`,
        identityLock: pair.original.profile,
      },
      {
        id: `replacement-${pair.id}`,
        name: `REPLACEMENT_${index + 1}: ${pair.replacement.name}`,
        identityLock: pair.replacement.profile,
      },
    ]),
    styleMode: "auto",
    backgroundLevel: "auto",
    readingDirection: "right-to-left",
    aspectRatio: input.aspectRatio,
    existingImageDataUrl: input.pageImageDataUrl,
  });
}
