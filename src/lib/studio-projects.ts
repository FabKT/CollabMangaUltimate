/**
 * Persistance des projets du Studio (CollabManga).
 *
 * IndexedDB plutôt que localStorage : les pages de chapitres contiennent des
 * images en base64 (candidats importés) qui dépasseraient vite le quota
 * localStorage. Même pattern que `manga-workspace.ts` (profils de personnages).
 * Le store est générique : le type `Project` vit dans la route du Studio.
 */

const DB_NAME = "collabmanga-studio";
const DB_VERSION = 1;
const STORE = "projects";
const RECORD_ID = "all";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
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

export async function loadStudioProjects<T>(): Promise<T[]> {
  if (typeof window === "undefined" || !hasIndexedDb()) return [];
  try {
    const db = await openDb();
    const record = await new Promise<{ projects?: unknown } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(RECORD_ID);
      request.onsuccess = () => resolve(request.result as { projects?: unknown } | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return Array.isArray(record?.projects) ? (record.projects as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveStudioProjects<T>(projects: T[]): Promise<boolean> {
  if (typeof window === "undefined" || !hasIndexedDb()) return false;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: RECORD_ID, projects, updatedAt: new Date().toISOString() });
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}
