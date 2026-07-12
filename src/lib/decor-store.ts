import { createId } from "./manga-workspace";

/**
 * Local store for user-created decors (the "Décors créés" library category).
 * Backed by IndexedDB (its own database) so generated background images can be
 * kept locally. Later this can be swapped for a Supabase-backed store.
 */

export type CreatedDecor = {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: string;
};

const DB_NAME = "collabmanga-decors";
const DB_VERSION = 1;
const STORE = "createdDecors";

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

export async function loadCreatedDecors(): Promise<CreatedDecor[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    const entries = await new Promise<CreatedDecor[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as CreatedDecor[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function addCreatedDecor(
  decor: Omit<CreatedDecor, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<CreatedDecor> {
  const record: CreatedDecor = {
    ...decor,
    id: decor.id ?? createId("decor"),
    createdAt: decor.createdAt ?? new Date().toISOString(),
  };
  if (!hasIndexedDb()) return record;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(record);
  await txDone(tx);
  db.close();
  return record;
}

export async function removeCreatedDecor(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}
