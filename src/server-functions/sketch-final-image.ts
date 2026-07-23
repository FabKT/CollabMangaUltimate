import { z } from "zod";
import type { GenerationUsage } from "@/lib/generation-metrics";

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

const sketchFinalInputSchema = z
  .object({
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
  })
  .refine((data) => data.sketchImageDataUrl || data.baseImageDataUrl, {
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
  costUsd?: number;
  usage?: GenerationUsage;
};

type PulseNoteSketchFinalResponse = {
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

export function parseSketchFinalInput(data: unknown) {
  return sketchFinalInputSchema.parse(data);
}

function finishingMode(input: SketchFinalInput) {
  const style = `${input.styleId} ${input.styleName}`.toLowerCase();
  return style.includes("classic") || style.includes("classique") ? "CLASSIC" : "MODERN";
}

export function buildSketchFinalPrompt(input: SketchFinalInput): string {
  const references = [...input.elementReferences, ...input.references];
  const mode = finishingMode(input);
  const referencePlan = references.length
    ? references
        .map(
          (reference, index) =>
            `REFERENCE ${index + 1} (${reference.name || "unnamed"}): ${
              reference.description?.trim() ||
              "Inspect it directly and use it only to identify the matching character or element already present in Image A."
            }`,
        )
        .join("\n")
    : "No additional character or element identity reference is provided.";
  const userInstructions = (input.notes || input.prompt || "").trim();

  return `MANGA SKETCH TO FINISHED PAGE BACKEND PLAN

0. OBJECTIVE
Transform Image A, a rough manga page or rough manga illustration, into a clean, finished, readable and publishable manga rendering. Preserve its composition and intent exactly while interpreting and consolidating the sketch instead of mechanically tracing its rough noise.

OUTPUT PRESET: ${mode}
SELECTED STYLE: ${input.styleName}${input.styleDescription ? ` - ${input.styleDescription}` : ""}

1. PROVIDED IMAGE ROLES
Image A is the DIRECT SKETCH TARGET. It controls WHAT is represented and WHERE it is placed:
- canvas and page composition;
- panel count, panel geometry, separators, hierarchy and reading flow;
- camera angle, framing, shot scale, perspective and depth;
- character count, placement, pose, gesture, expression, gaze and action;
- hand placement, body orientation, props, environment and movement effects;
- bubbles, tails, visible dialogue, captions and sound effects.
Image A does not control the quality or multiplicity of final lines.

Image B is the FINISHING STYLE REFERENCE. It reinforces rendering only:
- lineart and line-weight logic;
- face, eye, hair and clothing rendering;
- black, white and gray distribution;
- hatching, screentone and texture policy;
- finish and polish level.
Image B must never contribute identity, pose, outfit, content, text, layout or camera.

Image C and following, when present, are CHARACTER OR ELEMENT IDENTITY REFERENCES. They define only the matching subject's face, hairstyle, silhouette, build, age impression, outfit, accessories, asymmetries and distinguishing details. Image A remains authoritative for pose, expression, action, camera, crop and placement.

ADDITIONAL REFERENCE ASSIGNMENTS:
${referencePlan}

2. TWO-STAGE INTERNAL PIPELINE
Perform these stages silently. Do not print analysis, labels or instructions in the image.

STAGE A - SKETCH INTERPRETATION
1. Classify Image A as a single illustration or manga page.
2. Segment canvas borders, panels, gutters, bubbles, text, sound effects, characters, anatomy, clothing, objects, backgrounds and motion effects.
3. Identify the intended camera, pose, action, emotion, depth and visual hierarchy in every panel.
4. Distinguish structural marks from exploratory noise.
5. Convert bundles of nearby hesitant strokes into one intended form and one final contour.
6. Detect ambiguous or incomplete areas and infer only the minimum conservative completion supported by the visible intent.

STAGE B - FINISHED RECONSTRUCTION
1. Rebuild clean anatomy, hands, faces, hair, clothing, props and environment without changing the gesture or staging.
2. Apply identity references only to their matching subjects.
3. Apply the locked ${mode} finishing system.
4. Restore bubbles, exact readable text and requested onomatopoeia.
5. Finalize with clean blacks, line-based shadows, controlled hatching or uniform screentones.

3. SKETCH CONSOLIDATION LOCK
A rough sketch commonly contains exploration lines, corrections, construction guides, repeated contours and incomplete volumes. Interpret their shared intention.
- Merge several jaw strokes into one clean jaw contour.
- Merge repeated limb, garment, hair and perspective lines into one deliberate construction.
- Remove accidental marks, abandoned corrections, construction circles, duplicate lines and sketch dirt.
- Preserve important anatomy, folds, gaze, expression, hair structure, hand position and motion direction.
The final result must look completed, never like cleaned-up rough lineart with all hesitant strokes retained.

4. PANEL STRUCTURE LOCK
When Image A is a page, preserve exactly:
- panel count and reading order;
- panel borders, shapes, proportions and relative sizes;
- vertical, horizontal, diagonal, inclined or irregular separators;
- dominant panel and secondary-panel hierarchy;
- gutters and overall page ratio.
Do not add, remove, merge, split, resize or redesign panels.

5. CAMERA AND STAGING LOCK
Preserve exactly for the page and for every panel:
- front, profile or three-quarter orientation;
- high angle, low angle, oblique angle or eye-level view;
- close-up, extreme close-up, medium, American, wide or counter-shot scale;
- focal length impression, perspective, tilt and foreshortening;
- framing distance, crop, occlusion and depth hierarchy;
- gaze direction, action direction and spatial relationships.
Cleanup may improve readability but must never replace the shot or pose.

6. CHARACTER IDENTITY AND OUTFIT LOCK
If identity references are supplied, preserve the same face, hairstyle, body build, apparent age, outfit, accessories, silhouette, asymmetries and recognizable features. The sketch defines pose and expression; identity references define who the character is.
Never borrow identity or clothing from Image B. Never swap, merge, duplicate or redesign characters. Preserve the target outfit unless the user explicitly requests a change.

7. AMBIGUOUS AREAS AND ANATOMY CLEANUP
Allowed:
- clarify fingers, hands, feet and joints;
- correct unstable proportions while preserving gesture;
- complete a partially suggested face, garment or background;
- organize hair and clothing folds;
- remove construction lines and resolve overlapping contours.
Required approach:
- remain faithful to the clearest visible intention;
- complete conservatively;
- avoid specific invented accessories, textures or scenery without evidence.
Forbidden:
- moving hands or changing body direction;
- changing expression, gaze, action or silhouette;
- replacing vague scenery with unrelated elaborate scenery.

8. COMMON FINISHING RULES - STRICT
- Clean, unified, readable manga lineart.
- Clear silhouettes and controlled internal detail.
- Flat, unified colors only if color is explicitly requested.
- Shadows only through solid black shapes, flat darker color shapes, line-based shading, hatching, cross-hatching or uniform screentones.
- No soft color gradient, airbrush, painterly shadow, diffuse colored glow, smooth 3D modeling or glossy photorealistic rendering.
- No rough unfinished sketch noise.
- Preserve a clear value hierarchy and coherent rendering across every panel.

9. ${mode} STYLE FINGERPRINT
${
  mode === "CLASSIC"
    ? `- Clean but simpler and more direct manga lineart.
- Immediate readability, iconic shapes and restrained micro-detail.
- Simpler expressive eyes, sober faces and less fragmented hair masses.
- Simple structured folds, direct black fills and restrained hatching.
- Classic, stable and readable finish; flat unified colors only if requested.`
    : `- Clean contemporary manga lineart with precise controlled contours.
- Moderately stronger exterior contours and finer internal details.
- Clearly constructed faces, precise expressive eyes and organized readable hair masses.
- Structured clothing folds, clean anatomy and crisp action silhouettes.
- Sharp solid blacks, controlled hatching and optional uniform screentones.
- Dynamic, polished and contemporary finish; flat shadows only if color is requested.`
}

10. TEXT, BUBBLES AND SOUND EFFECTS
- Preserve bubble type, shape, location, scale, tail and probable speaker.
- Preserve every legible dialogue, caption and environmental text exactly, including language and spelling.
- If text is partially legible, use explicit user instructions to resolve it.
- If no written instruction resolves unreadable text, do not invent detailed dialogue.
- Distinguish dialogue bubbles, free text, captions, signs and onomatopoeia.
- Preserve visible sound effects or add them only when explicitly requested, using coherent manga lettering.

11. BACKGROUND AND ENVIRONMENT
Preserve every clearly suggested setting element and the original perspective. Finish incomplete areas conservatively. Clarify stadiums, stands, rocks, smoke, terrain, ruins or other indicated elements without replacing them or overcrowding the scene.

12. CRITICAL RESTRICTIONS
Do not:
- literally reproduce sketch clutter or hesitant duplicate strokes;
- alter composition, camera, framing, panel structure or reading order;
- alter character count, identity, outfit, pose, expression, gaze or hand placement;
- add or remove important narrative content;
- import subjects, clothing, layout or text from the style reference;
- use gradients, soft painted shadows, airbrush or 3D gloss;
- invent complex dialogue or unsupported details.

13. FINAL QUALITY CONTROL
Before returning the image, silently verify:
- correct panel count, separators, hierarchy and proportions;
- correct framing, camera, depth and character placement;
- rough duplicates and construction guides fully removed;
- each intended form rebuilt with one clean coherent contour;
- identity, hairstyle, outfit, accessories and expression preserved;
- hands, anatomy, clothing and background clean and readable;
- ${mode} fingerprint dominant and coherent;
- no gradients or painterly shading;
- bubbles, readable text and sound effects preserved correctly;
- no missing, duplicated, swapped or invented narrative element.

USER INSTRUCTIONS - HIGHEST PRIORITY:
${userInstructions || "No additional instruction. Finish Image A faithfully using the locked defaults above."}

FINAL MANDATORY INSTRUCTION:
Produce the same scene and the same page as Image A, faithfully reconstructed as finished professional manga art. Interpret and consolidate the rough sketch into clean final contours. Preserve structure, camera, poses, expressions, identities, outfits, environment and readable text. Apply the locked ${mode} manga finish with flat values and line-based shadows only, never gradients or painterly rendering.`;
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
    costUsd: payload.costUsd,
    usage: payload.usage,
  };
}
