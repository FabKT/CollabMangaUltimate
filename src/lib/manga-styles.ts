import faceCurrent from "@/assets/char-styles/face-current.webp";
import cardCurrent from "@/assets/char-styles/card-current.webp";
import face90 from "@/assets/char-styles/face-90.webp";
import card90 from "@/assets/char-styles/card-90.webp";
import faceClassic from "@/assets/char-styles/face-classic.webp";
import cardClassic from "@/assets/char-styles/card-classic.webp";
import faceRealistic from "@/assets/char-styles/face-realistic.webp";
import cardRealistic from "@/assets/char-styles/card-realistic.webp";

export type MangaStyle = {
  id: string;
  name: string;
  description: string;
  samplePrompt: string;
  /** Main "face" visual shown on the style card. */
  face: string;
  /** Full "card" visual shown in the confirmation popup. */
  card: string;
};

export const MANGA_STYLES: MangaStyle[] = [
  {
    id: "current",
    name: "Style actuel",
    description: "Shonen moderne : encrage net, trames dynamiques, N&B contrasté.",
    samplePrompt:
      "Full-body manga character turnaround, modern shonen manga style, clean crisp inking, dynamic screentones, high contrast black and white, expressive face, detailed hair, plain white background.",
    face: faceCurrent,
    card: cardCurrent,
  },
  {
    id: "retro90",
    name: "Années 90",
    description: "Rétro 80/90 : traits épais, hachures denses, proportions vintage.",
    samplePrompt:
      "Full-body manga character, late 1980s to 1990s retro manga style, heavier ink lines, dense cross-hatching and screentone gradients, vintage cel-era proportions, black and white, plain white background.",
    face: face90,
    card: card90,
  },
  {
    id: "classic",
    name: "Classique",
    description: "Manga classique : lignes claires, rendu équilibré, intemporel.",
    samplePrompt:
      "Full-body manga character, classic manga style, clean balanced linework, timeless proportions, tasteful screentones, black and white, plain white background.",
    face: faceClassic,
    card: cardClassic,
  },
  {
    id: "realistic",
    name: "Réaliste",
    description: "Semi-réaliste type manhwa/webtoon : anatomie et rendu détaillés.",
    samplePrompt:
      "Full-body character, semi-realistic manga and manhwa style, detailed anatomy and facial features, refined shading and rendering, polished lineart, plain background.",
    face: faceRealistic,
    card: cardRealistic,
  },
];
