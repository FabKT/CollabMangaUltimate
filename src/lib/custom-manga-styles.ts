import { replaceEmbeddedAiImages } from "./ai-cloud-media";
import { supabase } from "./supabase";

export type CustomMangaStyle = {
  id: string;
  name: string;
  images: string[];
  createdAt: string;
  userId?: string;
};

const DB_NAME = "collabmanga-custom-styles";
const DB_VERSION = 2;
const STORE = "styles";
const MIGRATION_OWNER_KEY = "collabmanga.customStyles.supabaseMigrationOwner.v1";
export const CUSTOM_STYLES_CHANGED_EVENT = "collabmanga:custom-styles-changed";

type CloudCustomStyleRow = {
  user_id: string;
  id: string;
  name: string;
  images: unknown;
  created_at: string;
};

function deleteBrokenDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = async () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }

      db.close();
      try {
        await deleteBrokenDb();
        resolve(await openDb());
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadLocalStyles(): Promise<CustomMangaStyle[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const styles = await new Promise<CustomMangaStyle[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as CustomMangaStyle[]).filter(
            (style) => style.name && style.images?.length,
          ),
        );
      request.onerror = () => reject(request.error);
    });
    db.close();
    return styles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

async function saveLocalStyle(style: CustomMangaStyle) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(style);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

function fromCloudRow(row: CloudCustomStyleRow): CustomMangaStyle {
  return {
    id: row.id,
    name: row.name,
    images: Array.isArray(row.images)
      ? row.images.filter((image): image is string => typeof image === "string")
      : [],
    createdAt: row.created_at,
    userId: row.user_id,
  };
}

async function currentCloudUserId() {
  if (!supabase) return null;
  const session = await supabase.auth.getSession();
  return session.data.session?.user.id ?? null;
}

async function saveCloudStyle(userId: string, style: CustomMangaStyle): Promise<CustomMangaStyle> {
  if (!supabase) return style;
  const images = (await replaceEmbeddedAiImages(
    supabase,
    userId,
    style.images,
    `styles/${style.id}`,
  )) as string[];
  const cloudStyle = { ...style, images, userId };
  const saved = await supabase.from("ai_custom_styles").upsert(
    {
      user_id: userId,
      id: cloudStyle.id,
      name: cloudStyle.name,
      images: cloudStyle.images,
      created_at: cloudStyle.createdAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,id" },
  );
  if (saved.error) throw new Error(saved.error.message);
  await saveLocalStyle(cloudStyle);
  return cloudStyle;
}

export async function loadCustomMangaStyles(): Promise<CustomMangaStyle[]> {
  const localStyles = await loadLocalStyles();
  const userId = await currentCloudUserId();
  if (!supabase || !userId) {
    return localStyles
      .filter((style) => !style.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  try {
    const queried = await supabase
      .from("ai_custom_styles")
      .select("user_id,id,name,images,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (queried.error) throw new Error(queried.error.message);

    const cloudStyles = ((queried.data ?? []) as CloudCustomStyleRow[])
      .map(fromCloudRow)
      .filter((style) => style.name && style.images.length);

    const migrationOwner = window.localStorage.getItem(MIGRATION_OWNER_KEY);
    if (!migrationOwner || migrationOwner === userId) {
      const cloudIds = new Set(cloudStyles.map((style) => style.id));
      const legacyStyles = localStyles.filter(
        (style) => (!style.userId || style.userId === userId) && !cloudIds.has(style.id),
      );
      for (const style of legacyStyles) {
        cloudStyles.push(await saveCloudStyle(userId, style));
      }
      window.localStorage.setItem(MIGRATION_OWNER_KEY, userId);
    }

    return cloudStyles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return localStyles
      .filter((style) => !style.userId || style.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function addCustomMangaStyle(input: {
  name: string;
  images: string[];
}): Promise<CustomMangaStyle> {
  const style: CustomMangaStyle = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    images: input.images,
    createdAt: new Date().toISOString(),
  };
  const userId = await currentCloudUserId();
  const savedStyle = userId ? await saveCloudStyle(userId, style) : style;
  if (!userId) await saveLocalStyle(savedStyle);
  window.dispatchEvent(new Event(CUSTOM_STYLES_CHANGED_EVENT));
  return savedStyle;
}
