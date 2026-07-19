/**
 * Durable AI workspace persistence.
 *
 * IndexedDB keeps complete workspaces, including large base64 images, after
 * navigation, reloads, browser restarts and computer restarts. The old
 * sessionStorage value is migrated automatically the first time it is read.
 */

const LEGACY_PREFIX = "collabmanga.session.";
const DB_NAME = "collabmanga-ai-workspaces";
const DB_VERSION = 1;
const STORE = "workspaces";

type WorkspaceRecord<T = unknown> = {
  id: string;
  value: T;
  updatedAt: string;
};

const writeQueues = new Map<string, Promise<void>>();

function canUseIndexedDb() {
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

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function loadLegacy<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const storageKey = LEGACY_PREFIX + key;
    const raw =
      window.localStorage?.getItem(storageKey) ??
      window.sessionStorage?.getItem(storageKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function loadSession<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  if (!canUseIndexedDb()) return loadLegacy<T>(key);

  try {
    const db = await openDb();
    const value = await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(key);
      request.onsuccess = () =>
        resolve((request.result as WorkspaceRecord<T> | undefined)?.value ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (value !== null) return value;

    const legacy = loadLegacy<T>(key);
    if (legacy !== null) {
      await saveSession(key, legacy);
      window.sessionStorage?.removeItem(LEGACY_PREFIX + key);
    }
    return legacy;
  } catch {
    return loadLegacy<T>(key);
  }
}

async function writeSession<T>(key: string, value: T): Promise<void> {
  if (!canUseIndexedDb()) {
    try {
      window.localStorage.setItem(LEGACY_PREFIX + key, JSON.stringify(value));
    } catch {
      // No durable browser storage is available.
    }
    return;
  }

  const db = await openDb();
  const transaction = db.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put({
    id: key,
    value,
    updatedAt: new Date().toISOString(),
  } satisfies WorkspaceRecord<T>);
  await transactionDone(transaction);
  db.close();
}

export async function saveSession<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;

  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeSession(key, value));
  writeQueues.set(key, next);
  try {
    await next;
  } finally {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  }
}
