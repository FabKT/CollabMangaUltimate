/**
 * Fils de discussion locaux (localStorage) pour les conversations liées à un
 * projet ou à un parrainage. Les messages privés (« Amis ») passent, eux, par
 * Supabase ; ces fils-ci deviendront des salons serveur plus tard.
 */

export type LocalThreadMessage = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

const STORAGE_KEY = "collabmanga.localThreads.v1";

type ThreadMap = Record<string, LocalThreadMessage[]>;

function load(): ThreadMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as ThreadMap) : {};
  } catch {
    return {};
  }
}

function save(map: ThreadMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function threadKey(kind: "project" | "sponsorship", id: string) {
  return `${kind}:${id}`;
}

export function listThreadMessages(key: string): LocalThreadMessage[] {
  return load()[key] ?? [];
}

export function appendThreadMessage(key: string, author: string, content: string): LocalThreadMessage {
  const message: LocalThreadMessage = {
    id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    content,
    createdAt: new Date().toISOString(),
  };
  const map = load();
  map[key] = [...(map[key] ?? []), message];
  save(map);
  return message;
}
