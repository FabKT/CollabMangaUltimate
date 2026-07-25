import { uploadAiImage } from "./ai-cloud-media";
import { supabase } from "./supabase";

export type MangaCharacterImage = {
  id: string;
  name: string;
  view: string;
  imageDataUrl: string;
  mimeType?: string;
  notes?: string;
  /** Image utilisée lors de la génération (actif par défaut). */
  enabled?: boolean;
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
  /** Carte de personnage consolidée (turnaround + expressions) générée à partir de la bibliothèque. */
  cardImageDataUrl?: string;
  cardImageGeneratedAt?: string;
  /** Utiliser la carte comme référence unique en génération (actif par défaut si la carte existe). */
  cardEnabled?: boolean;
};

const CHARACTER_STORAGE_KEY = "collabmanga.characterProfiles.v2";
const CHARACTER_DB_NAME = "collabmanga-characters";
const CHARACTER_DB_VERSION = 1;
const CHARACTER_STORE = "characterProfiles";
const CHARACTER_RECORD_ID = "profiles";
const CHARACTER_MIGRATION_KEY = "collabmanga.characterProfiles.supabaseMigration.v1";
let characterCloudSaveQueue: Promise<MangaCharacterProfile[]> = Promise.resolve([]);

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
    cardImageDataUrl: undefined,
    cardImageGeneratedAt: undefined,
  };
}

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function normalizeCharacterProfiles(value: unknown): MangaCharacterProfile[] {
  if (!Array.isArray(value)) return [];
  return value
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
      cardImageDataUrl:
        typeof character?.cardImageDataUrl === "string" ? character.cardImageDataUrl : undefined,
      cardImageGeneratedAt:
        typeof character?.cardImageGeneratedAt === "string"
          ? character.cardImageGeneratedAt
          : undefined,
      cardEnabled: typeof character?.cardEnabled === "boolean" ? character.cardEnabled : true,
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
              enabled: typeof image.enabled === "boolean" ? image.enabled : true,
            }))
        : [],
    }))
    .filter((character) => character.id);
}

function loadLegacyCharacterProfiles(): MangaCharacterProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return [];
    return normalizeCharacterProfiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveLegacyCharacterProfiles(characters: MangaCharacterProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  } catch {
    // Local storage can fail when too many large base64 images are saved. This is
    // only kept as a fallback for browsers without IndexedDB.
  }
}

function openCharacterDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CHARACTER_DB_NAME, CHARACTER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHARACTER_STORE)) {
        db.createObjectStore(CHARACTER_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadLocalCharacterProfiles(): Promise<MangaCharacterProfile[]> {
  if (typeof window === "undefined") return [];

  if (!hasIndexedDb()) {
    return loadLegacyCharacterProfiles();
  }

  try {
    const db = await openCharacterDb();
    const record = await new Promise<{ characters?: unknown[] } | undefined>((resolve, reject) => {
      const tx = db.transaction(CHARACTER_STORE, "readonly");
      const request = tx.objectStore(CHARACTER_STORE).get(CHARACTER_RECORD_ID);
      request.onsuccess = () => resolve(request.result as { characters?: unknown[] } | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();

    const indexedCharacters = normalizeCharacterProfiles(record?.characters);
    if (indexedCharacters.length > 0) return indexedCharacters;

    const legacyCharacters = loadLegacyCharacterProfiles();
    if (legacyCharacters.length > 0) {
      await saveCharacterProfiles(legacyCharacters);
    }
    return legacyCharacters;
  } catch {
    return loadLegacyCharacterProfiles();
  }
}

async function saveLocalCharacterProfiles(characters: MangaCharacterProfile[]): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!hasIndexedDb()) {
    try {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const db = await openCharacterDb();
    const tx = db.transaction(CHARACTER_STORE, "readwrite");
    tx.objectStore(CHARACTER_STORE).put({
      id: CHARACTER_RECORD_ID,
      characters,
      updatedAt: new Date().toISOString(),
    });
    await txDone(tx);
    db.close();
    return true;
  } catch {
    saveLegacyCharacterProfiles(characters);
    return false;
  }
}

async function currentCloudUserId() {
  if (!supabase) return null;
  const session = await supabase.auth.getSession();
  return session.data.session?.user.id ?? null;
}

async function uploadCharacterImages(
  userId: string,
  character: MangaCharacterProfile,
): Promise<MangaCharacterProfile> {
  if (!supabase) return character;
  const images = await Promise.all(
    (character.images ?? []).map(async (image) => ({
      ...image,
      imageDataUrl: await uploadAiImage(
        supabase,
        userId,
        image.imageDataUrl,
        `characters/${character.id}/references`,
        image.id,
      ),
    })),
  );
  const cardImageDataUrl = character.cardImageDataUrl
    ? await uploadAiImage(
        supabase,
        userId,
        character.cardImageDataUrl,
        `characters/${character.id}/card`,
        "character-card",
      )
    : undefined;
  return { ...character, images, cardImageDataUrl };
}

async function saveCloudCharacterProfiles(
  userId: string,
  characters: MangaCharacterProfile[],
): Promise<MangaCharacterProfile[]> {
  if (!supabase) return characters;
  const uploadedCharacters = await Promise.all(
    characters.map((character) => uploadCharacterImages(userId, character)),
  );
  const now = new Date().toISOString();

  if (uploadedCharacters.length > 0) {
    const upserted = await supabase.from("ai_character_profiles").upsert(
      uploadedCharacters.map((character) => ({
        user_id: userId,
        id: character.id,
        profile: character,
        updated_at: now,
      })),
      { onConflict: "user_id,id" },
    );
    if (upserted.error) throw new Error(upserted.error.message);
  }

  const existing = await supabase.from("ai_character_profiles").select("id").eq("user_id", userId);
  if (existing.error) throw new Error(existing.error.message);
  const retainedIds = new Set(uploadedCharacters.map((character) => character.id));
  const removedIds = (existing.data ?? [])
    .map((row) => String(row.id))
    .filter((id) => !retainedIds.has(id));
  if (removedIds.length > 0) {
    const removed = await supabase
      .from("ai_character_profiles")
      .delete()
      .eq("user_id", userId)
      .in("id", removedIds);
    if (removed.error) throw new Error(removed.error.message);
  }
  return uploadedCharacters;
}

export async function loadCharacterProfiles(): Promise<MangaCharacterProfile[]> {
  if (typeof window === "undefined") return [];
  const localCharacters = await loadLocalCharacterProfiles();
  const userId = await currentCloudUserId();
  if (!supabase || !userId) return localCharacters;

  try {
    const queried = await supabase
      .from("ai_character_profiles")
      .select("id,profile,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (queried.error) throw new Error(queried.error.message);

    const cloudCharacters = normalizeCharacterProfiles(
      (queried.data ?? []).map((row) => row.profile),
    );
    const migrationKey = `${CHARACTER_MIGRATION_KEY}.${userId}`;
    const migrationDone = window.localStorage.getItem(migrationKey) === "done";
    const missingLocalCharacters = migrationDone
      ? []
      : localCharacters.filter((local) => !cloudCharacters.some((cloud) => cloud.id === local.id));

    if (missingLocalCharacters.length > 0 || (!cloudCharacters.length && localCharacters.length)) {
      const merged = [...cloudCharacters, ...missingLocalCharacters];
      const uploaded = await saveCloudCharacterProfiles(userId, merged);
      await saveLocalCharacterProfiles(uploaded);
      window.localStorage.setItem(migrationKey, "done");
      return uploaded;
    }

    window.localStorage.setItem(migrationKey, "done");
    await saveLocalCharacterProfiles(cloudCharacters);
    return cloudCharacters;
  } catch {
    return localCharacters;
  }
}

export async function saveCharacterProfiles(characters: MangaCharacterProfile[]): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const localSaved = await saveLocalCharacterProfiles(characters);
  const userId = await currentCloudUserId();
  if (!supabase || !userId) return localSaved;

  try {
    const queuedSave = characterCloudSaveQueue.then(() =>
      saveCloudCharacterProfiles(userId, characters),
    );
    characterCloudSaveQueue = queuedSave.catch(() => characters);
    const uploaded = await queuedSave;
    await saveLocalCharacterProfiles(uploaded);
    window.localStorage.setItem(`${CHARACTER_MIGRATION_KEY}.${userId}`, "done");
    return true;
  } catch {
    return false;
  }
}
