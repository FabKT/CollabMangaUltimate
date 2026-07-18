import { MANGA_LIST } from "@/lib/manga-data";
import hero1 from "@/assets/haven/hero-1.jpg";

export type Demographic = "Shonen" | "Seinen" | "Shojo" | "Josei";

export type CatalogManga = {
  id: string;
  title: string;
  creator: string;
  cover: string;
  demographic: Demographic;
  genres: string[];
  rating: number;
  chapters: number;
  status: string;
  synopsis: string;
  language: "FR" | "ENG" | "ES" | "IT" | "JP";
};

// Catalogue statique (MANGA_LIST) vide en production → aucune couverture d'exemple
// n'est affichée. On garde une seule image (déjà utilisée par le héros) comme repli.
const HAVEN_COVERS = [hero1];

export type HeroSlide = {
  id: string;
  title: string;
  rank: number;
  image: string;
  demographic: Demographic;
  status: string;
  genres: string[];
  synopsis: string;
};

/** Vide en production : le héros s'alimente quand des mangas sont publiés. */
export const HERO_SLIDES: HeroSlide[] = [];

/** Image de fond du héros générique (aucun manga publié pour l'instant). */
export const HERO_FALLBACK_IMAGE = hero1;

export const DEMOGRAPHICS: Demographic[] = [
  "Shonen",
  "Seinen",
  "Shojo",
  "Josei",
];

export const SORTS = ["Avis décroissants", "Avis croissants"] as const;
export type SortOption = (typeof SORTS)[number];

const LANGUAGE_CYCLE = ["FR", "ENG", "FR", "JP", "ENG", "FR", "ES", "IT"] as const;

export const CATALOG_MANGA: CatalogManga[] = MANGA_LIST.map((manga, index) => ({
  id: manga.id,
  title: manga.title,
  creator: manga.creator,
  cover: HAVEN_COVERS[index % HAVEN_COVERS.length],
  demographic: manga.demographic,
  genres: manga.genres,
  rating: manga.rating,
  chapters: manga.chapterCount,
  status: manga.status,
  synopsis: manga.synopsis,
  language: LANGUAGE_CYCLE[index % LANGUAGE_CYCLE.length],
}));

export const GENRES: string[] = Array.from(
  new Set(CATALOG_MANGA.flatMap((manga) => manga.genres)),
).sort();

export const STATUSES: string[] = Array.from(new Set(CATALOG_MANGA.map((manga) => manga.status)));

export type NewDrop = {
  mangaId: string;
  chapterId: string;
  cover: string;
  title: string;
  chapterLabel: string;
  note: string;
  date: string;
};

export const NEW_DROPS: NewDrop[] = MANGA_LIST.slice(0, 6).map((manga, index) => {
  const chapter = manga.chapters[manga.chapters.length - 1];
  return {
    mangaId: manga.id,
    chapterId: chapter?.id ?? "",
    cover: HAVEN_COVERS[index % HAVEN_COVERS.length],
    title: manga.title,
    chapterLabel: chapter ? `Ch. ${chapter.number} — ${chapter.title}` : "New chapter",
    note: chapter?.note ?? manga.synopsis,
    date: chapter?.published ?? manga.updated,
  };
});
