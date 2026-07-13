export type MangaStatus = "Ongoing" | "Completed" | "New";
export type MangaDemographic = "Shonen" | "Seinen" | "Shojo" | "Josei";

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
  demographic: MangaDemographic;
  genres: string[];
  subgenres: string[];
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
    const weeksAgo = count - n + 1;
    return {
      id: `ch-${n}`,
      number: n,
      title: `Chapter title ${n}`,
      note: n === count ? "The newest release pushes the main conflict forward." : "A key chapter in the ongoing arc.",
      published: n === count ? "Published today" : `Published ${weeksAgo} weeks ago`,
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

const seed = ({
  title,
  creator,
  hue,
  chapters,
  demographic,
  subgenres,
  status,
  rating,
  ratingCount,
  language,
  updated,
  synopsis,
}: {
  title: string;
  creator: string;
  hue: number;
  chapters: number;
  demographic: MangaDemographic;
  subgenres: string[];
  status: MangaStatus;
  rating: number;
  ratingCount: number;
  language: string;
  updated: string;
  synopsis: string;
}): Omit<Manga, "id"> => ({
  title,
  creator,
  cover: cover(title, hue),
  demographic,
  genres: subgenres,
  subgenres,
  status,
  rating,
  ratingCount,
  chapterCount: chapters,
  language,
  updated,
  synopsis,
  chapters: makeChapters(chapters, hue),
});

export const MANGA_LIST: Manga[] = [
  {
    id: "aurora-drift",
    ...seed({
      title: "Aurora Drift",
      creator: "Mina Laurent",
      hue: 210,
      chapters: 12,
      demographic: "Shonen",
      subgenres: ["Action", "Aventure", "Fantastique"],
      status: "Ongoing",
      rating: 4.8,
      ratingCount: 1840,
      language: "FR",
      updated: "Updated today",
      synopsis:
        "A young courier carrying fragments of a fallen star crosses a city split between rival guilds, each convinced that the aurora above them hides the path to an ancient weapon.",
    }),
  },
  {
    id: "hollow-signal",
    ...seed({
      title: "Hollow Signal",
      creator: "Noah Vesper",
      hue: 160,
      chapters: 8,
      demographic: "Seinen",
      subgenres: ["Science fiction", "Mystere", "Psychologique"],
      status: "New",
      rating: 4.5,
      ratingCount: 620,
      language: "ENG",
      updated: "Updated 2 days ago",
      synopsis:
        "In a silent orbital colony, a maintenance engineer starts receiving messages from a crew that officially died years earlier.",
    }),
  },
  {
    id: "quiet-mecha",
    ...seed({
      title: "Quiet Mecha",
      creator: "Sora Kline",
      hue: 20,
      chapters: 24,
      demographic: "Shonen",
      subgenres: ["Mecha", "Action", "Drame"],
      status: "Completed",
      rating: 4.6,
      ratingCount: 3120,
      language: "FR",
      updated: "Completed last month",
      synopsis:
        "After the war, a former pilot repairs farming machines in a mountain town until an abandoned combat frame wakes beneath the fields.",
    }),
  },
  {
    id: "paper-lanterns",
    ...seed({
      title: "Paper Lanterns",
      creator: "Elise Haru",
      hue: 300,
      chapters: 6,
      demographic: "Shojo",
      subgenres: ["Romance", "Slice of life", "Drame"],
      status: "Ongoing",
      rating: 4.4,
      ratingCount: 780,
      language: "FR",
      updated: "Updated this week",
      synopsis:
        "A reserved calligraphy student and a festival musician exchange anonymous lantern notes every summer, never realizing they sit in the same classroom.",
    }),
  },
  {
    id: "static-bloom",
    ...seed({
      title: "Static Bloom",
      creator: "Ari Mendes",
      hue: 340,
      chapters: 15,
      demographic: "Josei",
      subgenres: ["Mystere", "Romance", "Psychologique"],
      status: "Ongoing",
      rating: 4.7,
      ratingCount: 1410,
      language: "ENG",
      updated: "Updated yesterday",
      synopsis:
        "A radio host who can hear emotions inside static investigates the disappearance of a listener whose final broadcast predicted her own future.",
    }),
  },
  {
    id: "ember-fold",
    ...seed({
      title: "Ember Fold",
      creator: "Kenji Armand",
      hue: 40,
      chapters: 4,
      demographic: "Seinen",
      subgenres: ["Horreur", "Historique", "Mystere"],
      status: "New",
      rating: 4.2,
      ratingCount: 390,
      language: "FR",
      updated: "Updated 3 days ago",
      synopsis:
        "A printer in a fire-scarred district discovers that each forbidden manuscript he restores changes a detail in the city's history.",
    }),
  },
  {
    id: "north-lens",
    ...seed({
      title: "North Lens",
      creator: "Camille Ryo",
      hue: 100,
      chapters: 20,
      demographic: "Shonen",
      subgenres: ["Sport", "Comedie", "Drame"],
      status: "Ongoing",
      rating: 4.3,
      ratingCount: 1180,
      language: "ENG",
      updated: "Updated this week",
      synopsis:
        "A failed striker joins a tiny northern school team where every match is filmed, studied, and turned into a second chance.",
    }),
  },
  {
    id: "salt-harbor",
    ...seed({
      title: "Salt Harbor",
      creator: "Lina Moreau",
      hue: 250,
      chapters: 32,
      demographic: "Josei",
      subgenres: ["Historique", "Romance", "Aventure"],
      status: "Completed",
      rating: 4.9,
      ratingCount: 4260,
      language: "FR",
      updated: "Completed 6 months ago",
      synopsis:
        "On a coast ruled by merchant families, a cartographer returns home to expose the map that ruined her father and the captain who helped draw it.",
    }),
  },
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
