export type StylePlanUsage = "character-card" | "character-transfer" | "page-transfer";

const STYLE_ANALYSIS_AXES = `STYLE REFERENCE ANALYSIS PROTOCOL:
Before rendering, inspect every attached style reference and silently build one coherent style fingerprint. Analyze only recurring, reliable mechanisms, never the depicted identity, pose, scene, text, panel layout, or clothing design.
- medium and finish: inked manga, digital manga, screentone, grayscale, color, cel shading, print texture;
- value system: white-space ratio, solid-black ratio, discrete gray/tone count, gradients, contrast and density;
- linework: contour thickness, line-weight variation, internal-line density, foreground/background hierarchy, cleanliness;
- shadows: black shapes, hatching, cross-hatching, screentones, grayscale, edge hardness and transition logic;
- faces: geometry, eye/eyelid/iris/pupil/highlight construction, eyebrows, nose, mouth, facial shadow density;
- hair: silhouette, grouped locks, black masses, highlights, strand density and internal texture;
- anatomy and clothing: stylization level, proportions, joints, hands, fold construction, material/value treatment;
- environments and effects: perspective/detail density, negative space, speed/radial lines, debris, impact shapes and lettering treatment.
Resolve variation by prioritizing features repeated across several references. Treat isolated features as uncertain. Convert the findings into explicit rendering rules that remain useful even if the images are no longer visible. The references remain authoritative visual evidence and must still be supplied to generation.`;

const STYLE_PROFILES: Record<string, string> = {
  current: `TARGET STYLE FINGERPRINT - CURRENT MODERN MANGA:
- Clean current digital manga design: sharp, controlled, polished, simplified and emotionally restrained; never photorealistic, painterly, glossy-webtoon, rough, retro-1990s or heavily textured.
- Face: smooth planes, clean jaw and cheeks, minimal texture, refined stylized anatomy without deep realistic modeling.
- Eyes are the primary marker: moderately sized and streamlined, slightly narrow, strong sharp upper lid, restrained lower lid, controlled iris and dark pupil, subtle internal detail and small highlight; calm direct gaze. Never giant round retro eyes, ornate classic eyes or photographic eyes.
- Nose and mouth: small, clean, understated, minimal linework and controlled expression.
- Hair: preserve hairstyle identity; grouped sleek locks, decisive silhouette, solid black masses where appropriate, clean white highlights and limited internal lines; no strand noise.
- Anatomy: believable modern manga proportions, elegant silhouette and stable construction.
- Clothing: preserve design; clean contours and folds, flat unified black/white/gray masses, controlled shadow shapes, no grain, speckling or dirty fabric texture.
- Line/value system: crisp deliberate contours, minimal internal detail, clean black fills, white negative space and smooth limited grays; no muddy gradients, dense cross-hatching or random noise.`,
  retro90: `TARGET STYLE FINGERPRINT - 1990s MANGA / ANIME:
- Iconic old-generation black-and-white manga/anime design: expressive, simplified, graphic and clean; never realistic, modern semi-realistic, glossy webtoon or painterly.
- Face: flatter simplified planes, softer iconic geometry and less anatomical depth than modern realistic manga.
- Eyes are the highest-priority marker: clearly larger and more open, large iris/pupil area, at least one strong readable white highlight inside each iris, clean upper lid and simple lower lid. Preserve the character's eye identity through shape cues while translating it into this retro system. Never narrow realistic eyes, empty circles or modern glossy eyes.
- Nose: very small classic anime indication with minimal line/shadow. Mouth: small simple line shapes, expanding only when the expression requires it.
- Hair: preserve hairstyle identity through grouped graphic locks and a clear silhouette; for dark hair use solid black masses, clean white highlights and sparse internal strands.
- Anatomy: stylized but believable classic anime proportions, never chibi unless explicitly requested.
- Clothing: simple folds and clean silhouettes with solid unified black/white/gray values; no grain, dirty screentone or fabric speckling.
- Line/value system: clean slightly old-school contours, strong black/white readability, one or two controlled screentones, minimal hatching, no realistic grayscale modeling.
- Every expression must retain the same large retro eye construction and unmistakable identity.`,
  classic: `TARGET STYLE FINGERPRINT - CLASSIC MANGA / ANIME:
- Refined timeless monochrome manga: clean, elegant, controlled, expressive and polished; neither photorealistic nor painterly, rough, oversized-retro, hyper-realistic or glossy-webtoon.
- Face: smooth stylized construction, elegant proportions, lightly defined planes and clean skin areas.
- Eyes are the primary marker: moderately large almond/softly rounded manga eyes, strongest line on the upper lid, subtle lower lid, visible carefully structured iris, clean dark pupil, controlled small highlight and refined minimal lashes. More detailed than flat modern eyes, less exaggerated than 1990s eyes, never photographic.
- Eyebrows clean and expressive. Nose small and lightly indicated. Mouth restrained with thin, precise lines.
- Hair: preserve identity using organized readable lock groups, strong silhouette, solid blacks and clean highlights; polished without chaotic strands.
- Anatomy: elegant believable manga proportions, consistent across angles.
- Clothing: preserve design with controlled folds, stable silhouettes and flat unified black/white/gray surfaces; no grain or noisy fabric texture.
- Line/value system: deliberate contours, refined facial lines, controlled weight variation, clean black fills, negative white and restrained tones/hatching only where useful.`,
  realistic: `TARGET STYLE FINGERPRINT - REALISTIC BLACK-AND-WHITE MANGA / MANHWA:
- Refined semi-realistic illustrated manga/manhwa, mature and anatomically grounded but unmistakably drawn; never photographic, painterly, flat-anime or glossy 3D.
- Face: believable planes and refined cheek, jaw, chin and nose-bridge construction with elegant proportions and controlled realism.
- Eyes remain manga-based: expressive detailed eyelids, readable iris/pupil structure, subtle highlights and delicate lower-lid treatment; never oversized retro eyes, flat simplified eyes or photographic human eyes.
- Nose: integrated bridge/nostril information and restrained shading. Mouth: natural, understated and emotionally precise.
- Hair: preserve hairstyle identity with layered grouped locks, dimensional controlled detail and coherent black masses; no blocky flat anime hair or individual-hair photorealism.
- Anatomy: slender or identity-appropriate, believable and stable; coherent neck, shoulders, torso, limbs and readable hands across views.
- Clothing: structurally believable construction and elegant controlled folds; preserve outfit and use clean readable values without needless texture noise.
- Line/value system: polished line-weight variation, monochrome value hierarchy, refined grayscale or controlled screentone, localized hatching and clear shadows. Detail creates form without producing photographic volume or 3D gloss.`,
};

const USAGE_RULES: Record<StylePlanUsage, string> = {
  "character-card": `APPLICATION TO A CHARACTER CARD:
Image A controls WHO the character is. Style references and the style fingerprint control HOW the character is redrawn. A structure reference controls only the sheet organization. Preserve identity, age, build, hairstyle, outfit, accessories and asymmetrical details while discarding the source rendering style. Maintain strict orthographic consistency across front, back and strict side views and identity consistency across all expressions.`,
  "character-transfer": `APPLICATION TO A CHARACTER TRANSFER:
The base image controls identity, pose, expression, gaze, anatomy, outfit, accessories, camera, crop and composition. Change only the rendering mechanisms. Do not copy a person, pose, outfit, scene, text or composition from a style reference. The result must be the exact same character image translated into the target visual language.`,
  "page-transfer": `APPLICATION TO A MANGA PAGE TRANSFER:
The source page controls every narrative and spatial fact: canvas, panel count and geometry, gutters, reading order, framing, camera, characters, identity, pose, expression, action, objects, backgrounds, bubbles, tails, dialogue and sound effects. Change only rendering mechanisms. Never import layout, characters, text or scene content from style references.`,
};

function normalizeStyleId(styleId: string) {
  const id = styleId.trim().toLowerCase();
  if (id === "1990s" || id.includes("90")) return "retro90";
  if (id.includes("class")) return "classic";
  if (id.includes("real")) return "realistic";
  if (id.includes("current") || id.includes("actuel") || id.includes("modern")) return "current";
  return id;
}

export function buildStylePlan(input: {
  styleId: string;
  styleName: string;
  styleDescription?: string;
  hasReferenceImages: boolean;
  usage: StylePlanUsage;
}) {
  const profile = STYLE_PROFILES[normalizeStyleId(input.styleId)];
  const target = profile
    ? profile
    : `TARGET CUSTOM STYLE - ${input.styleName}:
${input.styleDescription || "The target style is defined by the attached user style library."}
${STYLE_ANALYSIS_AXES}`;

  return [
    `SELECTED STYLE: ${input.styleName}.`,
    input.hasReferenceImages
      ? "Attached style images are mandatory visual references. Analyze them using the rules below and keep them attached to generation."
      : "No style image is attached; follow the textual fingerprint exactly.",
    target,
    input.styleDescription ? `USER STYLE NOTES: ${input.styleDescription}` : "",
    USAGE_RULES[input.usage],
    `SOURCE ISOLATION LOCK:
Identity references define identity only. Structure references define layout only. Style references define rendering only. User instructions override defaults. Never transfer an unauthorized identity, pose, anatomy, outfit, object, background, layout, framing, text or narrative fact between sources.`,
    `QUALITY CONTROL:
Before returning the image, verify target identity/content preservation, target-style dominance, consistent geometry and anatomy, clean line/value treatment, absence of hybrids or duplicated elements, exact preservation of requested text, and no labels or annotations unless explicitly requested.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const LOCAL_MANGA_PAGE_PLAN = `LOCAL MANGA PAGE BACKEND PLAN:
Perform a detailed internal analysis, then generate from a compact, self-sufficient final specification. Do not narrate the analysis in the image.

1. Classify the task before rendering: complete creation, storyboard-based page, description-only creation, modification, targeted correction, replacement, sketch-to-final or style transformation. For edits, the current target image outranks all lower-priority references for unchanged content.
2. Assign every image exactly one bounded role: character identity, structure/storyboard, pose/action, camera, style, inspiration, background/object or target. Conflict order: explicit user request > target image for edits > assigned roles > structure > identity > pose/camera > inspiration > style > free interpretation. Never let inspiration/style override identity, structure, dialogue or action.
3. Inspect references and transcribe only useful facts into a self-contained specification. Character sheets: face, hair, silhouette, body, outfit, accessories, asymmetry and invariants. Structure: page ratio, panel count/geometry, gutters, reading order, dominant panel and cross-panel continuity. Camera: scale, vertical/horizontal angle, tilt, lens feel, framing, occlusion and narrative function. Pose: orientation, weight, joints, hands, contact points, action direction and foreshortening.
4. Build a dynamic style fingerprint from recurring mechanisms, not named imitation: value distribution, line weight, internal detail, shadows/hatching/tones, faces, eyes, hair, anatomy, folds, environments, movement effects, density and polish. Style references control rendering only.
5. Specify every panel independently: narrative function; exact geometry; shot/camera; foreground, midground and background; each character's identity, role, position, orientation, pose, gaze and expression; objects/interactions; effects; exact text and speaker. Preserve readable anatomy and action-bearing limbs unless intentionally cropped.
6. Non-negotiable locks: never merge or swap characters; preserve role assignment and distinguishing traits; preserve requested front/back/profile direction; maintain panel count, hierarchy, reading order and gutters; keep exact dialogue language, spelling, speaker, bubble and panel placement; add no text unless requested.
7. Rendering: finished original manga, clean and intentional. Follow requested color mode. In black-and-white use clear white space, solid blacks, controlled tones/hatching and strong silhouettes. Avoid photorealism, painterly/3D gloss, muddy gray, random grain, AI-smudge lines and needless detail. Background density follows the request and panel function.
8. Final check: all requested characters and references used in their declared roles; no identity contamination; panel geometry and camera correct; action and expressions correct; text exact; style coherent; no missing, duplicated or invented narrative element.

The user's scene request remains authoritative and must be preserved in full.`;
