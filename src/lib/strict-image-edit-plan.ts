type StrictEditAsset = {
  name: string;
  role: string;
  characterName?: string;
  characterProfile?: string;
  description?: string;
};

type StrictEditPlanInput = {
  editRequest: string;
  assets: StrictEditAsset[];
  hasTargetImage: boolean;
};

const ROLE_LIMITS: Record<string, string> = {
  Character:
    "identity, face, hair, body build, outfit and permanent traits only; never copy pose, camera, composition or background unless explicitly requested",
  Background:
    "environment, architecture, objects, depth and atmosphere only; never transfer characters, poses or page structure",
  Object: "the referenced object's shape, construction, markings, materials and proportions only",
  Storyboard:
    "panel structure, spatial organization and reading flow only; never copy identities, outfits or narrative content",
  Pose: "pose, articulation, balance, limb direction and center of gravity only; never transfer identity, face, hair or outfit",
  Style:
    "lineart, values, shading, hatching, screentones, color logic and detail density only; never transfer identity, pose, outfit or scene content",
  Inspiration:
    "only the visual facts explicitly relevant to the user's requested edit; no broad or automatic influence",
  Target:
    "the explicitly targeted visual property only; it does not replace the authority of the base image",
  "Generated Page":
    "only the explicitly requested visual property; do not copy unrelated page content",
};

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

function buildReferenceManifest(assets: StrictEditAsset[]) {
  if (!assets.length) {
    return [
      "No supplementary reference image is provided.",
      "Use only the target image and the written edit request.",
    ].join("\n");
  }

  return assets
    .map((asset, index) => {
      const label = `IMAGE ${String.fromCharCode(66 + Math.min(index, 24))}`;
      const details = [
        `${label} - ${clean(asset.name) || `Reference ${index + 1}`}`,
        `Assigned role: ${asset.role}.`,
        `Authorized influence: ${ROLE_LIMITS[asset.role] ?? ROLE_LIMITS.Inspiration}.`,
      ];
      if (clean(asset.characterName)) {
        details.push(`Character identity: ${clean(asset.characterName)}.`);
      }
      if (clean(asset.characterProfile)) {
        details.push(`Identity facts to preserve: ${clean(asset.characterProfile)}.`);
      }
      if (clean(asset.description)) {
        details.push(`User-provided reference guidance: ${clean(asset.description)}.`);
      }
      details.push(
        "Analyze this image closely before rendering and transcribe its useful visual facts internally. Ignore every visual property outside its assigned role.",
      );
      return details.join("\n");
    })
    .join("\n\n");
}

export function buildStrictImageEditPrompt({
  editRequest,
  assets,
  hasTargetImage,
}: StrictEditPlanInput) {
  const request = editRequest.trim();
  const targetStatus = hasTargetImage
    ? "IMAGE A is present and is the mandatory target image."
    : "ERROR: no target image was supplied. Do not invent a replacement target.";

  return `STRICT MANGA IMAGE MODIFICATION PLAN

==================================================
1. OBJECTIVE AND NON-NEGOTIABLE RULE
==================================================

Modify IMAGE A only according to the user's explicit edit request.

PRESERVE EVERYTHING BY DEFAULT.
MODIFY ONLY WHAT THE USER EXPLICITLY REQUESTS.

${targetStatus}

IMAGE A is the highest visual authority for every property that the user did
not explicitly request to change. A local request must remain a local edit and
must never become an unnecessary full-image regeneration.

If an instruction is ambiguous, choose the smallest reasonable edit scope.
Do not beautify, redesign, simplify, enhance, restyle, rewrite or reinterpret
anything that was not requested.

==================================================
2. USER EDIT REQUEST - HIGHEST PRIORITY
==================================================

${request}

The request overrides IMAGE A only for the properties and regions it names.
All unnamed properties and regions remain locked to IMAGE A.

==================================================
3. TARGET IMAGE AUTHORITY
==================================================

Before editing, inspect IMAGE A in detail and internally map:

- format, aspect ratio, crop and resolution;
- panels, borders, gutters, separators and reading order;
- camera angle, framing, perspective and focal hierarchy;
- every character's identity, placement, scale, pose, gaze and expression;
- face, hair, anatomy, outfit, accessories and permanent traits;
- foreground, background, objects, effects and spatial relationships;
- speech bubbles, tails, dialogue, captions, sound effects and typography;
- line weight, black masses, values, colors, shading, hatching, screentones,
  gradients, texture and detail density.

This source analysis is the preservation lock. Unless explicitly changed,
preserve all of the above as closely as technically possible.

==================================================
4. PRESERVE / CHANGE / RECONSTRUCT CONTRACT
==================================================

Internally convert the request into exactly three lists before rendering:

PRESERVE:
- every unrequested region and property;
- every already-correct element of IMAGE A;
- all panels, characters, text and backgrounds outside the edit scope.

CHANGE:
- only explicitly requested targets;
- for each target, identify its region, property, final value and scope.

RECONSTRUCT:
- only pixels or geometry made incompatible by an authorized change;
- only the smallest transition area needed for clean lineart, anatomy,
  shadows, hair, clothing, background or bubble continuity.

Reconstruction is never permission to redraw the whole panel or page.

==================================================
5. MINIMUM-SCOPE EDIT AND PROTECTION MASKS
==================================================

Select the smallest scope that can satisfy the request:
local detail, character part, complete character, single panel, or full page.

Create an internal edit mask around only the authorized changes.
Create a protection mask over all unrequested content.
Use only a narrow transition zone to blend edited and protected regions.

Do not alter another panel, character, object, text region or background
because it is visually nearby.

==================================================
6. REFERENCE ROLES, DEEP ANALYSIS AND ISOLATION
==================================================

Supplementary references reinforce specific facts; they never replace the
authority of IMAGE A outside the requested edit.

${buildReferenceManifest(assets)}

For every reference:

1. inspect composition, pose, gaze, expression, anatomy, identity, clothing,
   foreground, background, lineart, values, shading and texture;
2. extract internally only the concrete visual facts authorized by its role;
3. adapt those facts to IMAGE A's existing camera, perspective, expression,
   composition and rendering unless the user explicitly requests otherwise;
4. prevent all unauthorized properties from leaking into the result.

A face or character reference must not change pose, camera, panel geometry or
background. A pose reference must not transfer identity or clothing. A style
reference must not transfer characters, age, body type, outfit or scene
content. A structure reference must not transfer its narrative content.

==================================================
7. STRUCTURE, COMPOSITION, CAMERA AND IDENTITY LOCKS
==================================================

Unless explicitly requested, preserve exactly:

- image ratio and orientation;
- panel count, geometry, borders, gutters and reading order;
- composition, subject placement, scale and foreground/background relations;
- camera position, shot scale, angle, tilt, perspective and crop;
- every character's identity, age, face, hair, body, outfit and accessories;
- every pose, hand placement, gaze and expression;
- every object, background element, effect and lighting relationship;
- all bubbles, tails, text placement and existing wording.

For a targeted character, preserve every identity or design property that the
request does not name. If only hair color changes, keep the exact hairstyle,
face, pose, expression, outfit and camera.

==================================================
8. STYLE MATCHING
==================================================

Unless a style change is explicitly requested, every edited region must use
the exact visual grammar of the surrounding original:

- contour hierarchy and line weight;
- internal line density and edge sharpness;
- black, white, gray or color value system;
- hatching, cross-hatching and screentone method;
- shadow construction and fold rendering;
- face, eye, hair, anatomy and background treatment;
- texture, polish and detail density.

If the image uses flat manga rendering, retain clean flat values and construct
shadows with hard shapes, linework, hatching or uniform screentones. Do not
introduce soft painterly gradients, airbrush shading or diffuse 3D gloss unless
the user explicitly asks for them.

==================================================
9. TEXT LOCK
==================================================

Preserve all existing text unless the user explicitly asks to replace, remove
or add text. For an authorized text edit, reproduce the requested wording,
spelling, punctuation, speaker, bubble position and tail direction exactly.
Do not add labels, captions, dialogue or sound effects on your own.

==================================================
10. CRITICAL RESTRICTIONS
==================================================

Do not:

- modify an unrequested region or property;
- redraw the full page for a local correction;
- change format, crop, panels, camera or composition without instruction;
- change a non-targeted character or identity;
- alter outfit, pose, expression, background, lighting or text incidentally;
- copy unrelated content from a reference;
- let one reference influence a domain assigned to another reference;
- add characters, props, effects, bubbles or typography without instruction;
- reduce fidelity by replacing precise source details with generic imagery.

==================================================
11. QUALITY CONTROL
==================================================

Before returning the image, compare the result against IMAGE A and verify:

- every requested change is clearly present;
- each visible difference is traceable to the explicit request or a strictly
  necessary transition;
- unrequested regions, structure, camera, identities, text and style remain
  stable;
- each reference affected only its authorized domain;
- edited regions are seamless and match surrounding lineart, values, texture
  and resolution;
- there are no doubled contours, broken anatomy, blurred patches, malformed
  text or visible compositing seams.

==================================================
12. FINAL MANDATORY INSTRUCTION
==================================================

Apply only this edit: ${request}

Preserve everything else from IMAGE A.
Use references only within their assigned roles.
Make the smallest possible coherent change and integrate it seamlessly into
the original manga image.`;
}
