export type MangaStatus = "Ongoing" | "Completed" | "New";

export interface Chapter {
  id: string;
  number: number;
  title: string;
  note: string;
  published: string;
  pages: number;
  rating: number;
  comments: number;
  status: "Latest" | "Published";
  pageImages: string[];
}

export interface Manga {
  id: string;
  title: string;
  creator: string;
  cover: string;
  genres: string[];
  status: MangaStatus;
  rating: number;
  ratingCount: number;
  chapterCount: number;
  language: string;
  updated: string;
  synopsis: string;
  chapters: Chapter[];
}

// Deterministic placeholder cover generator (SVG data URI).
// Colors intentionally muted to match the dark-navy palette.
function cover(seed: string, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='hsl(${hue},55%,22%)'/>
        <stop offset='1' stop-color='hsl(${(hue + 40) % 360},60%,10%)'/>
      </linearGradient>
      <radialGradient id='r' cx='0.3' cy='0.25' r='0.9'>
        <stop offset='0' stop-color='hsl(${hue},70%,45%)' stop-opacity='0.55'/>
        <stop offset='1' stop-color='hsl(${hue},70%,45%)' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <rect width='300' height='400' fill='url(#g)'/>
    <rect width='300' height='400' fill='url(#r)'/>
    <g fill='none' stroke='hsl(${hue},80%,70%)' stroke-opacity='0.18' stroke-width='1'>
      <path d='M0,300 Q150,240 300,320'/>
      <path d='M0,340 Q150,280 300,360'/>
      <circle cx='220' cy='120' r='60'/>
    </g>
    <text x='24' y='360' font-family='Sora, sans-serif' font-size='22' font-weight='800' fill='#F7FAFF' opacity='0.92'>${seed}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function pageImg(chapter: string, page: number, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1200'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0' stop-color='hsl(${hue},30%,14%)'/>
        <stop offset='1' stop-color='hsl(${(hue + 20) % 360},35%,7%)'/>
      </linearGradient>
    </defs>
    <rect width='800' height='1200' fill='url(#bg)'/>
    <g stroke='rgba(247,250,255,0.08)' stroke-width='2' fill='none'>
      <rect x='60' y='80' width='680' height='320' rx='6'/>
      <rect x='60' y='430' width='320' height='320' rx='6'/>
      <rect x='420' y='430' width='320' height='320' rx='6'/>
      <rect x='60' y='780' width='680' height='340' rx='6'/>
    </g>
    <text x='400' y='600' text-anchor='middle' font-family='Sora, sans-serif' font-size='28' font-weight='800' fill='rgba(247,250,255,0.55)'>${chapter} — Page ${page}</text>
    <text x='400' y='640' text-anchor='middle' font-family='Manrope, sans-serif' font-size='16' font-weight='500' fill='rgba(184,196,229,0.45)'>Page image placeholder</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeChapters(count: number, hue: number): Chapter[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const pages = 18 + ((n * 3) % 8);
    return {
      id: `ch-${n}`,
      number: n,
      title: `Chapter title ${n}`,
      note: "Short release note placeholder for this chapter.",
      published: "Published date",
      pages,
      rating: 0,
      comments: 0,
      status: n === count ? "Latest" : "Published",
      pageImages: Array.from({ length: pages }, (_, p) =>
        pageImg(`Chapter ${n}`, p + 1, hue),
      ),
    };
  });
}

const seed = (title: string, creator: string, hue: number, chapters: number, genres: string[], status: MangaStatus): Omit<Manga, "id"> => ({
  title,
  creator,
  cover: cover(title, hue),
  genres,
  status,
  rating: 0,
  ratingCount: 0,
  chapterCount: chapters,
  language: "Language",
  updated: "Updated recently",
  synopsis:
    "Synopsis placeholder. A short overview of the story, its main characters, and the world they inhabit will appear here. Creators can describe the tone, themes, and stakes of their manga so readers get a clear sense of what to expect before opening the first chapter.",
  chapters: makeChapters(chapters, hue),
});

export const MANGA_LIST: Manga[] = [
  { id: "aurora-drift", ...seed("Manga title A", "Creator name", 210, 12, ["Genre A", "Genre B", "Genre C"], "Ongoing") },
  { id: "hollow-signal", ...seed("Manga title B", "Creator name", 160, 8, ["Genre A", "Genre D"], "New") },
  { id: "quiet-mecha", ...seed("Manga title C", "Creator name", 20, 24, ["Genre B", "Genre E"], "Completed") },
  { id: "paper-lanterns", ...seed("Manga title D", "Creator name", 300, 6, ["Genre F"], "Ongoing") },
  { id: "static-bloom", ...seed("Manga title E", "Creator name", 340, 15, ["Genre A", "Genre G", "Genre H"], "Ongoing") },
  { id: "ember-fold", ...seed("Manga title F", "Creator name", 40, 4, ["Genre I"], "New") },
  { id: "north-lens", ...seed("Manga title G", "Creator name", 100, 20, ["Genre B", "Genre C"], "Ongoing") },
  { id: "salt-harbor", ...seed("Manga title H", "Creator name", 250, 32, ["Genre D", "Genre E"], "Completed") },
];

export function getManga(id: string): Manga | undefined {
  return MANGA_LIST.find((m) => m.id === id);
}

export function getChapter(mangaId: string, chapterId: string) {
  const manga = getManga(mangaId);
  if (!manga) return null;
  const idx = manga.chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return null;
  return {
    manga,
    chapter: manga.chapters[idx],
    prev: manga.chapters[idx - 1] ?? null,
    next: manga.chapters[idx + 1] ?? null,
  };
}