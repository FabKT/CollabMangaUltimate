import { createId } from "./manga-workspace";

/**
 * Generation history store.
 *
 * Backed by IndexedDB so that generated pages (base64 data URLs, which are far
 * too large for localStorage) can be persisted locally. The whole API is async
 * and provider-agnostic on purpose: swapping this local store for a Supabase
 * table later only means re-implementing these functions, not the callers.
 */

export type MangaHistoryEntry = {
  id: string;
  imageUrl: string;
  prompt: string;
  finalPrompt: string;
  taskType: string;
  model: string;
  size: string;
  quality: string;
  createdAt: string;
};

export type NewMangaHistoryEntry = Omit<MangaHistoryEntry, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

const DB_NAME = "collabmanga";
const DB_VERSION = 1;
const STORE = "generationHistory";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
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

export async function loadHistory(): Promise<MangaHistoryEntry[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    const entries = await new Promise<MangaHistoryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as MangaHistoryEntry[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function addHistoryEntry(entry: NewMangaHistoryEntry): Promise<MangaHistoryEntry> {
  const record: MangaHistoryEntry = {
    ...entry,
    id: entry.id ?? createId("gen"),
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  if (!hasIndexedDb()) return record;

  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  db.close();
  return record;
}

export async function removeHistoryEntry(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function clearHistory(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
  db.close();
}
