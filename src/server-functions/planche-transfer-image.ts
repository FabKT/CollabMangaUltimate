import { z } from "zod";
import {
  sendPulseNoteStyleTransfer,
  type StyleTransferResult,
} from "@/server-functions/style-transfer-image";
import { buildStylePlan } from "@/lib/ai-style-plans";

/**
 * Manga PAGE style-transfer plan (« planche »).
 *
 * Takes an existing manga page (Image A) and re-renders it in a target style
 * (Image B = attached style reference images, or a named preset style) while
 * strictly preserving the page structure, panels, composition, characters,
 * balloons and text. Only the visual rendering changes. This module owns the
 * prompt engineering and forwards it to PulseNote's image-to-image endpoint.
 */

const plancheTransferInputSchema = z.object({
  baseImageDataUrl: z.string().min(1),
  styleId: z.string().default("current"),
  styleName: z.string().default("Moderne"),
  styleDescription: z.string().default(""),
  customStyleImages: z.array(z.string()).default([]),
  aspectRatio: z.enum(["2:3", "3:2"]).default("2:3"),
});

export type PlancheTransferInput = z.infer<typeof plancheTransferInputSchema>;

export function parsePlancheTransferInput(data: unknown) {
  return plancheTransferInputSchema.parse(data);
}

/**
 * Prompt de préservation stricte de la page : la planche (Image A) est
 * conservée à l'identique (structure, cases, composition, personnages, textes),
 * seul le rendu visuel est remplacé par celui du style de référence (Image B).
 */
export function buildPlancheTransferPrompt(input: PlancheTransferInput): string {
  const hasStyleRef = input.customStyleImages.length > 0;
  const stylePlan = buildStylePlan({
    styleId: input.styleId,
    styleName: input.styleName,
    styleDescription: input.styleDescription,
    hasReferenceImages: hasStyleRef,
    usage: "page-transfer",
  });
  const styleClause = hasStyleRef
    ? "Image B is provided as the attached style reference image(s). Use it as the PRIMARY STYLE REFERENCE."
    : `No separate style reference image is attached. Image B (the PRIMARY STYLE REFERENCE) is defined textually as the target style: "${input.styleName}"${
        input.styleDescription ? ` — ${input.styleDescription}` : ""
      }. Apply this style exactly as if it were Image B.`;

  return `MANGA PAGE STYLE-TRANSFER BACKEND PROMPT
STRICT PAGE PRESERVATION + MANDATORY STYLE REFERENCE

You are editing an existing manga page.

This is a STYLE-TRANSFER task applied to a pre-existing manga page.

The goal is NOT to redesign the page.
The goal is NOT to reinterpret the scene.
The goal is NOT to create a new composition.
The goal is NOT to generate a new page inspired by the original.

The goal is to keep the original page exactly the same in content and structure, while changing only the visual rendering style.

--------------------------------------------------
1. IMAGE ROLES
--------------------------------------------------

Image A is the TARGET MANGA PAGE.
Image A is the page that must be transformed.

Image A defines, and must strictly preserve:
- the full page structure;
- the number of panels;
- the shape of each panel;
- the size of each panel;
- the relative panel proportions;
- the reading order;
- the composition inside each panel;
- the camera angle in each panel;
- the framing in each panel;
- the shot distance in each panel;
- all characters present;
- all character placements;
- all character poses;
- all character expressions;
- all face directions;
- all body directions;
- all hand placements;
- all objects and props;
- all background elements;
- all dialogue balloons;
- all balloon tails;
- all sound effects / onomatopoeia;
- all text content;
- all narrative emphasis;
- the complete storytelling of the page.

Image B is the PRIMARY STYLE REFERENCE.
Image B defines the visual rendering style that must be applied to Image A.
${styleClause}

${stylePlan}

Image B defines:
- the lineart style;
- the face rendering style;
- the eye rendering style;
- the hair rendering style;
- the clothing rendering style;
- the shading style;
- the contrast logic;
- the black / white / gray treatment;
- the screentone / texture / grain treatment, if any;
- the detail density;
- the finishing level;
- the overall manga aesthetic.

If additional style references are provided, use them only as supporting style references.
They must reinforce the style of Image B, not alter the content of Image A.

--------------------------------------------------
2. CORE RULE
--------------------------------------------------

Image A controls WHAT must be shown.
Image B controls HOW it must look.

Never let the style reference change the page structure.
Never let the style reference change the panel composition.
Never let the style reference change the pose, acting, or storytelling.

This is a strict page-preservation style-transfer task.

--------------------------------------------------
3. FINAL OBJECTIVE
--------------------------------------------------

Create a finished manga page that preserves the exact content and structure of Image A, while rendering it in the style defined by Image B.

The final result must look like:
the exact same manga page from Image A, but redrawn / re-rendered in the style of Image B.

--------------------------------------------------
4. STRICT PAGE PRESERVATION
--------------------------------------------------

The following elements are locked and must remain unchanged:

- number of panels;
- panel arrangement;
- panel shapes;
- panel sizes;
- panel borders;
- reading flow;
- internal panel composition;
- camera angle;
- framing;
- perspective;
- character count;
- character placement;
- character pose;
- face angle;
- body angle;
- hand placement;
- object placement;
- background placement;
- dialogue balloon placement;
- balloon tail direction;
- onomatopoeia placement;
- text content;
- narrative intent;
- pacing and emphasis.

Do not alter the structure of the page.
Do not redesign the page.
Do not reinterpret the storytelling.

--------------------------------------------------
5. STYLE TRANSFER SCOPE
--------------------------------------------------

Change only the VISUAL RENDERING.

The style transfer may affect:
- line quality;
- shape language;
- eye design;
- hair rendering;
- face rendering;
- nose and mouth treatment;
- clothing treatment;
- shading treatment;
- black fill treatment;
- grayscale treatment;
- screentones;
- grain or no grain;
- texture level;
- realism vs simplification level;
- finishing polish.

Do not change the underlying scene.

--------------------------------------------------
6. TEXT / BALLOONS / SOUND EFFECTS
--------------------------------------------------

Unless explicitly requested otherwise, preserve all text exactly as it appears in Image A.

Preserve:
- all dialogue content;
- balloon placement;
- balloon scale;
- balloon shape;
- balloon tail direction;
- sound effects / onomatopoeia placement.

Do not rewrite dialogue.
Do not invent text.
Do not remove text.
Do not move text unnecessarily.

If the text is legible in Image A, reproduce it faithfully.

--------------------------------------------------
7. CHARACTER PRESERVATION
--------------------------------------------------

Keep the same characters from Image A.

Do not turn them into different characters.
Do not alter their identity.
Do not alter their outfit design.
Do not alter their hairstyle structure.
Do not alter their age impression.
Do not alter their role in the page.

Only adapt their rendering so they visually match the style of Image B.

--------------------------------------------------
8. CLEANUP RULE
--------------------------------------------------

You may clean and refine the page where needed, but only in a way that preserves the original page.

Allowed:
- cleaner anatomy;
- cleaner hands;
- cleaner facial construction;
- clearer lineart;
- cleaner edges;
- improved readability;
- better finish consistency.

Not allowed:
- changing poses;
- changing expressions;
- changing framing;
- changing panel layout;
- changing dialogue;
- adding new narrative content;
- removing important content.

--------------------------------------------------
9. STYLE LOCK
--------------------------------------------------

The final page must strongly match Image B in style.

Pay special attention to:
- the exact feeling of the lineart;
- the rendering of the eyes;
- the rendering of the face;
- the rendering of the hair;
- the rendering of the shadows;
- the rendering of the clothing;
- the rendering of textures or the absence of textures;
- the global polish level.

Do not produce a generic style.
Do not ignore the style reference.
Do not drift toward another manga style.

--------------------------------------------------
10. SPECIAL STYLE CONDITIONS
--------------------------------------------------

If the requested style is simple black-and-white manga:
- keep the rendering clean and 2D;
- use clear lineart;
- use simple black/white/gray logic;
- avoid unnecessary realism.

If the requested style requires flat clothing values:
- keep clothing colors/values visually uniform;
- avoid fabric grain;
- avoid noisy texture;
- avoid accidental mottling.

If the requested style requires no grain:
- remove visual grain;
- remove noisy shading;
- avoid textured fabric rendering.

If the requested style requires screentones:
- use them consistently and in the visual logic of Image B.

--------------------------------------------------
11. RESTRICTIONS
--------------------------------------------------

Do not:
- create a new page;
- redesign the composition;
- change the panel layout;
- change the storytelling;
- change the acting;
- change the dialogue;
- change the reading order;
- change who is present;
- add major new elements;
- remove major existing elements;
- loosely "take inspiration" from Image A.

This is not inspiration.
This is not reinterpretation.
This is exact page preservation with style substitution.

--------------------------------------------------
12. FINAL INSTRUCTION
--------------------------------------------------

Render Image A as the exact same manga page, preserving its full structure and content, but fully translated into the style defined by Image B.

The final result must be immediately recognizable as the same page as Image A, with the same storytelling and the same layout, but visually rendered in the style of Image B.`;
}

export async function requestPulseNotePlancheTransfer(
  input: PlancheTransferInput,
): Promise<StyleTransferResult> {
  const finalPrompt = buildPlancheTransferPrompt(input);
  return sendPulseNoteStyleTransfer({
    task: "page_style_transfer",
    prompt: finalPrompt,
    baseImageDataUrl: input.baseImageDataUrl,
    styleId: input.styleId,
    styleName: input.styleName,
    styleReferenceImages: input.customStyleImages,
    aspectRatio: input.aspectRatio,
  });
}
