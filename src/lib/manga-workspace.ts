export type MangaCharacterImage = {
  id: string;
  name: string;
  view: string;
  imageDataUrl: string;
  mimeType?: string;
  notes?: string;
};

export type MangaCharacterProfile = {
  id: string;
  name: string;
  storyRole: string;
  identityLock: string;
  defaultExpression: string;
  age?: string;
  height?: string;
  bodyProportions?: string;
  outfit?: string;
  accessories?: string;
  colorNotes?: string;
  personality?: string;
  images?: MangaCharacterImage[];
};

const CHARACTER_STORAGE_KEY = "collabmanga.characterProfiles.v2";

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createBlankCharacter(index: number): MangaCharacterProfile {
  return {
    id: createId("character"),
    name: `Character ${index}`,
    storyRole: "",
    identityLock: "",
    defaultExpression: "",
    age: "",
    height: "",
    bodyProportions: "",
    outfit: "",
    accessories: "",
    colorNotes: "",
    personality: "",
    images: [],
  };
}

export function loadCharacterProfiles(): MangaCharacterProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((character) => ({
        id: typeof character?.id === "string" ? character.id : createId("character"),
        name: typeof character?.name === "string" ? character.name : "Character",
        storyRole: typeof character?.storyRole === "string" ? character.storyRole : "",
        identityLock: typeof character?.identityLock === "string" ? character.identityLock : "",
        defaultExpression:
          typeof character?.defaultExpression === "string" ? character.defaultExpression : "",
        age: typeof character?.age === "string" ? character.age : "",
        height: typeof character?.height === "string" ? character.height : "",
        bodyProportions:
          typeof character?.bodyProportions === "string" ? character.bodyProportions : "",
        outfit: typeof character?.outfit === "string" ? character.outfit : "",
        accessories: typeof character?.accessories === "string" ? character.accessories : "",
        colorNotes: typeof character?.colorNotes === "string" ? character.colorNotes : "",
        personality: typeof character?.personality === "string" ? character.personality : "",
        images: Array.isArray(character?.images)
          ? character.images
              .filter(
                (image: MangaCharacterImage) =>
                  typeof image?.id === "string" && typeof image?.imageDataUrl === "string",
              )
              .map((image: MangaCharacterImage) => ({
                id: image.id,
                name: typeof image.name === "string" ? image.name : "Reference image",
                view: typeof image.view === "string" ? image.view : "Reference",
                imageDataUrl: image.imageDataUrl,
                mimeType: typeof image.mimeType === "string" ? image.mimeType : undefined,
                notes: typeof image.notes === "string" ? image.notes : "",
              }))
          : [],
      }))
      .filter((character) => character.id);
  } catch {
    return [];
  }
}

export function saveCharacterProfiles(characters: MangaCharacterProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  } catch {
    // Local storage can fail when too many large base64 images are saved.
  }
}
