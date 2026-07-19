import { saveSession } from "./manga-session";

export type ImageEditReferenceRole =
  "Background" | "Object" | "Storyboard" | "Pose" | "Style" | "Inspiration" | "Target";

export type ImageEditReference = {
  id: string;
  name: string;
  imageDataUrl: string;
  mimeType?: string;
  description?: string;
  role?: ImageEditReferenceRole;
};

export type ImageEditDraft = {
  originalImageUrl: string;
  currentImageUrl: string;
  prompt: string;
  selectedCharacterIds: string[];
  references: ImageEditReference[];
  aspectRatio: "2:3" | "3:2";
  source?: string;
};

export const IMAGE_EDIT_SESSION_KEY = "image-edit";

export async function openImageEditor(draft: ImageEditDraft) {
  await saveSession(IMAGE_EDIT_SESSION_KEY, draft);
  window.location.assign("/ai/image-edit");
}
