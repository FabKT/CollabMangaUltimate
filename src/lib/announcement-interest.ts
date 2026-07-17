/**
 * Personnes « intéressées » par une annonce de recrutement (localStorage).
 * Quand un utilisateur répond à une annonce de projet (Apply), il est ajouté ici,
 * et apparaît dans l'onglet « Intéressés » du popup de détail.
 */

export type InterestedPerson = { name: string; at: string };

const KEY = "collabmanga.announcementInterest.v1";

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): Record<string, InterestedPerson[]> {
  if (!canStore()) return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, InterestedPerson[]>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, InterestedPerson[]>) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function listInterested(announcementId: string): InterestedPerson[] {
  return readAll()[announcementId] ?? [];
}

export function addInterested(announcementId: string, name: string) {
  const all = readAll();
  const list = all[announcementId] ?? [];
  if (list.some((p) => p.name === name)) return; // déjà intéressé
  all[announcementId] = [{ name, at: new Date().toISOString() }, ...list];
  writeAll(all);
}
