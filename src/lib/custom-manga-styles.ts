export type CustomMangaStyle = {
  id: string;
  name: string;
  images: string[];
  createdAt: string;
};

const DB_NAME = "collabmanga-custom-styles";
const DB_VERSION = 1;
const STORE = "styles";
export const CUSTOM_STYLES_CHANGED_EVENT = "collabmanga:custom-styles-changed";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCustomMangaStyles(): Promise<CustomMangaStyle[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const styles = await new Promise<CustomMangaStyle[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as CustomMangaStyle[]).filter((style) => style.name && style.images?.length));
      request.onerror = () => reject(request.error);
    });
    db.close();
    return styles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function addCustomMangaStyle(input: { name: string; images: string[] }): Promise<CustomMangaStyle> {
  const style: CustomMangaStyle = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    images: input.images,
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(style);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
  window.dispatchEvent(new Event(CUSTOM_STYLES_CHANGED_EVENT));
  return style;
}
