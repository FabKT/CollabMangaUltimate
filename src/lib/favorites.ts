/**
 * Favoris de l'utilisateur (localStorage).
 * Chaque publication créée (illustration, annonce, idée, option de parrainage,
 * projet) y est ajoutée automatiquement ; l'onglet Favoris du profil les liste
 * par catégorie.
 */

export type FavoriteKind =
  | "Announcement"
  | "Idée"
  | "Illustration"
  | "Sponsorship option"
  | "Project";

export type Favorite = {
  id: string;
  kind: FavoriteKind;
  title: string;
  createdAt: string;
};

const STORAGE_KEY = "collabmanga.favorites.v1";

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function listFavorites(): Favorite[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Favorite[]) : [];
  } catch {
    return [];
  }
}

export function addFavorite(kind: FavoriteKind, title: string) {
  if (!title.trim()) return;
  const favorite: Favorite = {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    title: title.trim(),
    createdAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([favorite, ...listFavorites()]));
  } catch {
    /* ignore */
  }
}

export function removeFavorite(id: string) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(listFavorites().filter((f) => f.id !== id)),
    );
  } catch {
    /* ignore */
  }
}
