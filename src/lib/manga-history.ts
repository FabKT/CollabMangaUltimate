import { replaceEmbeddedAiImages, uploadAiImage } from "./ai-cloud-media";
import { createId } from "./manga-workspace";
import { supabase } from "./supabase";
import type { ImageEditDraft } from "./image-edit-workspace";

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
  source?: string;
  title?: string;
  editContext?: ImageEditDraft;
};

export type NewMangaHistoryEntry = Omit<MangaHistoryEntry, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

type CloudHistoryRow = {
  id: string;
  image_url: string;
  prompt: string;
  final_prompt: string;
  task_type: string;
  model: string;
  size: string;
  quality: string;
  created_at: string;
  source: string | null;
  title: string | null;
  edit_context: ImageEditDraft | null;
};

type DeduplicatedHistory = {
  entries: MangaHistoryEntry[];
  duplicateIds: string[];
};

const DB_NAME = "collabmanga";
const DB_VERSION = 1;
const STORE = "generationHistory";
const HISTORY_MIGRATION_KEY = "collabmanga.generationHistory.supabaseMigration.v1";

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

async function loadLocalHistory(): Promise<MangaHistoryEntry[]> {
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

async function saveLocalHistoryEntry(entry: MangaHistoryEntry) {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(entry);
  await txDone(tx);
  db.close();
}

async function removeLocalHistoryEntry(id: string) {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

async function clearLocalHistory() {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
  db.close();
}

function fromCloudRow(row: CloudHistoryRow): MangaHistoryEntry {
  return {
    id: row.id,
    imageUrl: row.image_url,
    prompt: row.prompt,
    finalPrompt: row.final_prompt,
    taskType: row.task_type,
    model: row.model,
    size: row.size,
    quality: row.quality,
    createdAt: row.created_at,
    source: row.source ?? undefined,
    title: row.title ?? undefined,
    editContext: row.edit_context ?? undefined,
  };
}

function isLegacyMangaDuplicate(first: MangaHistoryEntry, second: MangaHistoryEntry) {
  if (first.source !== "Manga Page Creator" || second.source !== "Manga Page Creator") return false;
  const titles = new Set([first.title, second.title]);
  if (!titles.has("Manga Page Creator") || !titles.has("Planche manga")) return false;
  if (first.prompt.trim() !== second.prompt.trim()) return false;
  if (first.finalPrompt.trim() !== second.finalPrompt.trim()) return false;
  if (first.size !== second.size) return false;
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();
  return (
    Number.isFinite(firstTime) &&
    Number.isFinite(secondTime) &&
    Math.abs(firstTime - secondTime) <= 60_000
  );
}

function historyEntryScore(entry: MangaHistoryEntry) {
  return (entry.editContext ? 2 : 0) + (entry.title === "Planche manga" ? 1 : 0);
}

function deduplicateHistory(entries: MangaHistoryEntry[]): DeduplicatedHistory {
  const unique: MangaHistoryEntry[] = [];
  const duplicateIds: string[] = [];

  for (const entry of entries) {
    const duplicateIndex = unique.findIndex((candidate) =>
      isLegacyMangaDuplicate(entry, candidate),
    );
    if (duplicateIndex < 0) {
      unique.push(entry);
      continue;
    }

    const candidate = unique[duplicateIndex];
    if (historyEntryScore(entry) > historyEntryScore(candidate)) {
      unique[duplicateIndex] = entry;
      duplicateIds.push(candidate.id);
    } else {
      duplicateIds.push(entry.id);
    }
  }

  return { entries: unique, duplicateIds };
}

async function currentCloudUserId() {
  if (!supabase) return null;
  const session = await supabase.auth.getSession();
  return session.data.session?.user.id ?? null;
}

async function saveCloudHistoryEntry(
  userId: string,
  entry: MangaHistoryEntry,
): Promise<MangaHistoryEntry> {
  if (!supabase) return entry;
  const imageUrl = await uploadAiImage(
    supabase,
    userId,
    entry.imageUrl,
    `generated/${entry.id}`,
    "result",
  );
  const editContext = entry.editContext
    ? ((await replaceEmbeddedAiImages(
        supabase,
        userId,
        entry.editContext,
        `generated/${entry.id}/edit-context`,
      )) as ImageEditDraft)
    : undefined;
  const cloudEntry = { ...entry, imageUrl, editContext };
  const stored = await supabase.from("ai_generated_images").upsert(
    {
      id: cloudEntry.id,
      user_id: userId,
      image_url: cloudEntry.imageUrl,
      prompt: cloudEntry.prompt,
      final_prompt: cloudEntry.finalPrompt,
      task_type: cloudEntry.taskType,
      model: cloudEntry.model,
      size: cloudEntry.size,
      quality: cloudEntry.quality,
      source: cloudEntry.source ?? null,
      title: cloudEntry.title ?? null,
      edit_context: cloudEntry.editContext ?? null,
      created_at: cloudEntry.createdAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (stored.error) throw new Error(stored.error.message);
  return cloudEntry;
}

export async function loadHistory(): Promise<MangaHistoryEntry[]> {
  const localHistory = deduplicateHistory(await loadLocalHistory());
  const localEntries = localHistory.entries;
  await Promise.all(localHistory.duplicateIds.map(removeLocalHistoryEntry));
  const userId = await currentCloudUserId();
  if (!supabase || !userId) return localEntries;

  try {
    const queried = await supabase
      .from("ai_generated_images")
      .select(
        "id,image_url,prompt,final_prompt,task_type,model,size,quality,created_at,source,title,edit_context",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (queried.error) throw new Error(queried.error.message);
    const cloudHistory = deduplicateHistory(
      ((queried.data ?? []) as CloudHistoryRow[]).map(fromCloudRow),
    );
    let cloudEntries = cloudHistory.entries;
    if (cloudHistory.duplicateIds.length > 0) {
      await supabase
        .from("ai_generated_images")
        .delete()
        .eq("user_id", userId)
        .in("id", cloudHistory.duplicateIds);
      await Promise.all(cloudHistory.duplicateIds.map(removeLocalHistoryEntry));
    }

    const migrationKey = `${HISTORY_MIGRATION_KEY}.${userId}`;
    if (window.localStorage.getItem(migrationKey) !== "done") {
      const existingIds = new Set(cloudEntries.map((entry) => entry.id));
      const existingUrls = new Set(cloudEntries.map((entry) => entry.imageUrl));
      const missing = localEntries.filter(
        (entry) => !existingIds.has(entry.id) && !existingUrls.has(entry.imageUrl),
      );
      for (const entry of missing) {
        const migrated = await saveCloudHistoryEntry(userId, entry);
        cloudEntries.push(migrated);
      }
      window.localStorage.setItem(migrationKey, "done");
    }

    cloudEntries = cloudEntries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const entry of cloudEntries) await saveLocalHistoryEntry(entry);
    return cloudEntries;
  } catch {
    return localEntries;
  }
}

export async function addHistoryEntry(entry: NewMangaHistoryEntry): Promise<MangaHistoryEntry> {
  const userId = await currentCloudUserId();
  let existingCloud: { id: string; created_at: string } | null = null;
  if (supabase && userId && !entry.id) {
    const existing = await supabase
      .from("ai_generated_images")
      .select("id,created_at")
      .eq("user_id", userId)
      .eq("image_url", entry.imageUrl)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!existing.error) existingCloud = existing.data;
  }

  const record: MangaHistoryEntry = {
    ...entry,
    id: entry.id ?? existingCloud?.id ?? createId("gen"),
    createdAt: entry.createdAt ?? existingCloud?.created_at ?? new Date().toISOString(),
  };

  const stored = supabase && userId ? await saveCloudHistoryEntry(userId, record) : record;
  await saveLocalHistoryEntry(stored);
  return stored;
}

export async function recordGeneratedImage({
  source,
  title,
  prompt,
  result,
  editContext,
}: {
  source: string;
  title: string;
  prompt?: string;
  result: {
    imageUrl?: string;
    imageDataUrl?: string;
    historyId?: string;
    finalPrompt?: string;
    taskType?: string;
    model?: string;
    size?: string;
    quality?: string;
    createdAt?: string;
  };
  editContext?: ImageEditDraft;
}): Promise<MangaHistoryEntry | null> {
  const imageUrl = result.imageUrl || result.imageDataUrl;
  if (!imageUrl) return null;

  const existing = (await loadHistory()).find((entry) => entry.imageUrl === imageUrl);
  return addHistoryEntry({
    id: result.historyId ?? existing?.id,
    imageUrl,
    prompt: prompt?.trim() || existing?.prompt || title,
    finalPrompt: result.finalPrompt || prompt?.trim() || existing?.finalPrompt || title,
    taskType: result.taskType || existing?.taskType || source,
    model: result.model || existing?.model || "gpt-image-2",
    size: result.size || existing?.size || "unknown",
    quality: result.quality || existing?.quality || "high",
    createdAt: result.createdAt || existing?.createdAt,
    source,
    title,
    editContext: editContext ?? existing?.editContext,
  });
}

export async function removeHistoryEntry(id: string): Promise<void> {
  await removeLocalHistoryEntry(id);
  const userId = await currentCloudUserId();
  if (!supabase || !userId) return;
  const removed = await supabase
    .from("ai_generated_images")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (removed.error) throw new Error(removed.error.message);
}

export async function clearHistory(): Promise<void> {
  await clearLocalHistory();
  const userId = await currentCloudUserId();
  if (!supabase || !userId) return;
  const removed = await supabase.from("ai_generated_images").delete().eq("user_id", userId);
  if (removed.error) throw new Error(removed.error.message);
}
