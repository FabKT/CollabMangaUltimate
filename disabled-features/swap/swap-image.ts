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

  return `STRICT FULL-CHARACTER SWAP BACKEND
COMPLETE CHARACTER REPLACEMENT + IMMUTABLE SCENE PRESERVATION

0. OBJECTIVE AND DEFAULT MODE

Edit the provided source image directly. The default operation is FULL_CHARACTER_SWAP, never face-only or head-only replacement. Replace every authorized visible occurrence of each mapped ORIGINAL character with its paired REPLACEMENT character.

Replace the complete visible character. Preserve the complete original scene. Use the original character only as an immutable geometric scaffold for pose, perspective, interaction, visibility and occlusion.

1. SOURCE ROLES

SOURCE PAGE IMAGE is the absolute authority for canvas dimensions, aspect ratio, page and panel structure, borders, gutters, reading order, composition, framing, camera, perspective, pose skeleton, action, expression, gaze, interactions, objects, backgrounds, text, effects, visibility, cropping, occlusion and final graphic style.

ORIGINAL references identify only which character must be found and removed. They may define face, hair, morphology, outfit, accessories and continuity between occurrences, but they define no final content.

REPLACEMENT references define only the replacement's identity: face geometry, eyes, brows, nose, mouth, ears, hair and hairline, skin value or color, morphology, permanent marks, personal accessories and authorized outfit. Their pose, expression, camera, framing, composition and source rendering style must never be copied.

The latest explicit USER instruction wins only for the exact property it mentions. Everything else remains locked.

2. PERMANENT MULTI-SWAP MAPPING

${mappings}

Analyze every pair before editing. Each original is permanently linked to exactly one replacement. Never exchange mappings, mix faces, bodies, skin, hairstyles, clothing or accessories between pairs, place replacement A's face on replacement B's body, or merge identities.

3. OCCURRENCE DETECTION

Locate every reliable authorized occurrence of each ORIGINAL across all panels using face, hair, silhouette, outfit, accessories, proportions, marks and narrative continuity. Detect front, back, profile, three-quarter, close-up, full body, small, moving, cropped and partially occluded appearances.

Replace every reliable occurrence by default. Do not replace uncertain bystanders. Respect explicit inclusions or exclusions from the user. Track each occurrence by panel, bounds, orientation, visible body regions, crop and occluders before editing.

4. COMPLETE BODY-PART COVERAGE

For every occurrence, inventory all visible or partially visible character-owned regions:
- head, hair, face, ears and neck;
- shoulders, torso, chest, back, waist and pelvis;
- left and right upper arms, elbows, forearms, wrists, hands and fingers;
- left and right thighs, knees, lower legs, ankles and feet;
- exposed skin, permanent marks, body-specific features and personal accessories;
- clothing according to the active clothing rule.

Replace every inventoried visible region. A replaced face with the original neck, arms, hands, legs, skin, morphology or hair is a complete failure. A hidden or panel-cropped region must remain hidden or cropped and must not be invented.

5. IMMUTABLE POSE SCAFFOLD

Keep the source coordinates and trajectories of head center, chin, neck base, shoulders, elbows, wrists, hands, pelvis, hips, knees, ankles and feet. Fit the replacement morphology around this skeleton.

Do not move a joint, shorten or lengthen a limb, rotate a hand, change body direction, alter the center of gravity, add or remove a limb, make the pose more comfortable, or modify the action silhouette.

6. LIMB OWNERSHIP AND ANATOMICAL CONTINUITY

Assign every visible limb to one character and preserve continuous chains:
shoulder -> upper arm -> elbow -> forearm -> wrist -> hand -> fingers;
hip -> thigh -> knee -> lower leg -> ankle -> foot.

No duplicated, missing, fused, interrupted or reassigned limb; no hand on the wrong forearm; no fingers from a neighboring character; no ownership change at intersections. Preserve readable anatomy while retaining exact source geometry.

7. SKIN CONTINUITY AND NO ORIGINAL RESIDUE

Apply the replacement's skin color or monochrome skin value consistently to every exposed region: face, ears, neck, shoulders, arms, elbows, forearms, wrists, hands, fingers, thighs, knees, legs, ankles and feet.

In black-and-white manga, translate that skin into the source grammar using consistent white paper, flat gray, screentone, hatching or controlled local blacks. Never recolor only the face.

After the swap, no identity-specific residue of the original may remain: no original face, jaw, ears, hairline, hair, skin, body build, marks, accessories or unauthorized clothing.

8. IDENTITY, MORPHOLOGY, FACE AND HAIR

Transfer the replacement's complete recognizable identity and morphology within the immutable source pose: facial construction, eyes, hair, neck volume, shoulder width, torso, waist, hips, limb thickness, hands and permanent traits.

Reconstruct face and hair at the source head angle, tilt, perspective, crop and visibility. Never create a hybrid jaw, mixed hairline, mixed ear, mixed skin or blended identity. Morphology may change surface volume but must not move joints, break perspective, cover important objects or disturb neighboring characters.

9. EXPRESSION, GAZE AND ORIENTATION

The replacement adopts the source occurrence's exact expression and acting: brows, eyelids, iris and pupil direction, gaze target, mouth shape, jaw tension, sweat, stress marks and emotional intensity.

Preserve head, torso, pelvis and leg orientations independently. A character shown from behind remains from behind. Never turn a profile or back view toward the camera because the reference is frontal.

10. PERSPECTIVE, VISIBILITY, OCCLUSION AND INTERACTION

Preserve camera distance and height, field of view, depth, scale, foreshortening, projected limb size, foreground/background order and every crop. Preserve every overlap and occluder.

Keep all contact points and interactions exactly: held object, touching surface, strike, block, gaze target, person contact, object contact and motion direction. Do not reveal hidden areas, hide visible areas, move a neighbor, displace a prop or change depth order.

11. CLOTHING MODES

Default: KEEP_REPLACEMENT_OUTFIT. Reconstruct the replacement's outfit around the immutable source skeleton, action, perspective, crop and occlusion. Adapt folds and hidden edges without changing the pose.

If the user explicitly requests KEEP_ORIGINAL_OUTFIT, preserve source garments, numbers, logos and folds, but still replace all exposed skin, face, hair, neck, arms, hands, legs, morphology and body identity.

HYBRID_OUTFIT and CUSTOM_OUTFIT apply only when explicitly described. Clothing rules never authorize preservation of the original skin or body. Treat garment numbers, names and logos separately and change them only when explicitly requested.

12. EDIT MASK, PROTECTION MASK AND TRANSITIONS

The edit mask must cover the complete visible target occurrence from hair to feet, including every visible limb, skin region, authorized garment, accessory and the minimal extension needed for hair or clothing.

Protect all non-target characters, their limbs, backgrounds, objects, panel borders, gutters, bubbles, text, sound effects and scene props. At mask boundaries, reconstruct only the minimum hair edges, garment folds, outlines, shadows and occlusion seams required for a natural integration.

Never use a face-only or head-only mask in full-character mode.

13. GLOBAL PAGE AND TEXT LOCK

Preserve canvas, ratio, panel count and geometry, borders, gutters, reading order, composition, camera, backgrounds, non-target characters, objects, action, storytelling, dialogue, balloon shapes and tails, captions, sound effects, typography and placement.

Do not redesign, reframe, rewrite, translate, erase or invent. A requested character swap is not permission to regenerate the page.

14. SOURCE STYLE MATCHING

Render the replacement in the exact visual language of the source page: line weight, contour logic, face and eye treatment, hair masses, flat colors or monochrome values, screentones, hatching, shadows, contrast, texture density and finish.

The source page defines final style. Replacement references define identity only. Never paste their art style, lighting, background, pose, expression or composition. In flat-color or flat-value art, preserve clean unified fills and avoid gradients, painterly volume, photorealism or unnecessary texture.

15. SOURCE ISOLATION

Use source page only for scene geometry and style. Use ORIGINAL references only for detection. Use REPLACEMENT references only for replacement identity. Use USER text only for explicit exceptions. Do not borrow unrelated people, poses, clothes, scenery, text or lighting from any reference.

16. QUALITY CONTROL AND REJECTION

Before returning the image, verify for every mapped occurrence:
- complete body coverage equals all visible inventoried regions;
- no original identity or skin residue remains;
- mapping and identity are correct and not hybridized;
- all joints, limb chains, hands and feet are anatomically continuous;
- source pose, expression, gaze, camera, perspective and silhouette are unchanged;
- crops, occlusions, depth and contact points are unchanged;
- clothing mode is correctly applied;
- style, tones and skin values match the source page;
- all protected pixels, panels, backgrounds, characters, objects and text remain unchanged.

Reject and internally correct any face-only result, residual original body part, wrong mapping, mixed identity, duplicated or missing limb, skin discontinuity, altered pose, altered panel, moved text, changed background or mismatched style.

17. FINAL MANDATORY INSTRUCTION

Perform a complete local replacement of every authorized visible occurrence for every permanent mapping. Replace the entire visible character identity and body from head to feet while preserving the exact source skeleton, pose, expression, gaze, orientation, perspective, action, interaction, occlusion, composition, text and manga style.

The final image must be unmistakably the exact same original scene with only the selected complete characters replaced.
${input.prompt?.trim() ? `\nUSER INSTRUCTIONS - EXPLICIT PROPERTY OVERRIDES ONLY:\n${input.prompt.trim()}` : ""}`;
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
