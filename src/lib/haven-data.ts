import { MANGA_LIST } from "@/lib/manga-data";
import cover1 from "@/assets/haven/cover-1.jpg";
import cover2 from "@/assets/haven/cover-2.jpg";
import cover3 from "@/assets/haven/cover-3.jpg";
import cover4 from "@/assets/haven/cover-4.jpg";
import cover5 from "@/assets/haven/cover-5.jpg";
import cover6 from "@/assets/haven/cover-6.jpg";
import cover7 from "@/assets/haven/cover-7.jpg";
import cover8 from "@/assets/haven/cover-8.jpg";
import hero1 from "@/assets/haven/hero-1.jpg";
import hero2 from "@/assets/haven/hero-2.jpg";
import hero3 from "@/assets/haven/hero-3.jpg";

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

const HAVEN_COVERS = [cover1, cover2, cover3, cover4, cover5, cover6, cover7, cover8];

export const HERO_SLIDES = [
  {
    id: "h1",
    title: "Verdant Blade",
    rank: 1,
    image: hero1,
    demographic: "Shonen" as Demographic,
    status: "Ongoing",
    genres: ["Action", "Fantasy", "Supernatural"],
    synopsis:
      "A wandering swordsman channels the last breath of a fallen forest spirit — every strike costs him a memory he can never reclaim.",
  },
  {
    id: "h2",
    title: "Neon Requiem",
    rank: 2,
    image: hero2,
    demographic: "Seinen" as Demographic,
    status: "Recently updated",
    genres: ["Sci-fi", "Mystery", "Drama"],
    synopsis:
      "In a rain-soaked megacity, a debt collector for memories hunts the ghost of the man he used to be.",
  },
  {
    id: "h3",
    title: "Under the Emerald Moon",
    rank: 3,
    image: hero3,
    demographic: "Shojo" as Demographic,
    status: "New",
    genres: ["Fantasy", "Romance", "Adventure"],
    synopsis:
      "Two strangers meet only on the nights the moon burns green — and only for as long as it stays in the sky.",
  },
];

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
