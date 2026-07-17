/**
 * Notes des chapitres (localStorage). La note d'un manga = moyenne des notes
 * de ses chapitres. Utilisé par le lecteur (choisir sa note) et le catalogue
 * (afficher la note du manga).
 */

const KEY = "collabmanga.mangaRatings.v1";

type RatingStore = Record<string, Record<string, number>>; // mangaId -> chapterId -> note (1..5)

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): RatingStore {
  if (!canStore()) return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RatingStore) : {};
  } catch {
    return {};
  }
}

function writeAll(data: RatingStore) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

/** Enregistre la note (1..5) d'un chapitre. */
export function rateChapter(mangaId: string, chapterId: string, stars: number) {
  const all = readAll();
  all[mangaId] = { ...(all[mangaId] ?? {}), [chapterId]: Math.max(1, Math.min(5, Math.round(stars))) };
  writeAll(all);
}

/** Note donnée à un chapitre (0 si pas encore noté). */
export function getChapterRating(mangaId: string, chapterId: string): number {
  return readAll()[mangaId]?.[chapterId] ?? 0;
}

/** Note du manga = moyenne des notes de ses chapitres (0 si aucune). */
export function getMangaRating(mangaId: string): number {
  const chapters = readAll()[mangaId];
  if (!chapters) return 0;
  const values = Object.values(chapters).filter((v) => v > 0);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Nombre de chapitres notés pour ce manga. */
export function getMangaRatingCount(mangaId: string): number {
  const chapters = readAll()[mangaId];
  return chapters ? Object.values(chapters).filter((v) => v > 0).length : 0;
}
