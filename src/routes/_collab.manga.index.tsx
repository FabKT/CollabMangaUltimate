import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Star, X, ChevronDown } from "lucide-react";
import {
  CATALOG_MANGA,
  DEMOGRAPHICS,
  GENRES,
  STATUSES,
  SORTS,
  type CatalogManga,
  type Demographic,
  type SortOption,
} from "@/lib/haven-data";
import { loadStudioProjects } from "@/lib/studio-projects";
import { getMangaRating } from "@/lib/manga-ratings";
import { SITE_LANGUAGES, languageLabel } from "@/lib/languages";
import { MangaCard } from "@/components/haven/MangaCard";

export const Route = createFileRoute("/_collab/manga/")({
  head: () => ({
    meta: [
      { title: "Catalogue — CollabManga" },
      {
        name: "description",
        content:
          "Browse original manga on CollabManga. Filter by genre, demographic, status and rating to find your next read.",
      },
    ],
  }),
  component: CatalogPage,
});

const GENRE_OPTIONS = ["Shonen", "Seinen", "Shojo", "Josei"];
const SUBGENRE_OPTIONS = ["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique"];
// Langues alignées sur celles proposées dans le profil (langues du site).
const LANGUAGES = ["FR", "ENG", "ES", "IT", "JP", "DE", "PT", "KR", "CN", "NL", "AR", "HI"];
const RATING_VALUES = [0, 1, 2, 3, 4, 5];

// correspondance sous-genre FR (filtre) → genres EN (données du catalogue)
const SUBGENRE_MATCH: Record<string, string[]> = {
  "Action": ["Action"],
  "Aventure": ["Adventure"],
  "Comédie": ["Comedy"],
  "Drame": ["Drama"],
  "Fantastique": ["Fantasy", "Supernatural"],
  "Science-fiction": ["Sci-fi", "Science fiction"],
  "Romance": ["Romance"],
  "Slice of life": ["Slice of life"],
  "Horreur": ["Horror"],
  "Mystère": ["Mystery"],
  "Historique": ["Historical"],
  "Sport": ["Sports", "Sport"],
  "Isekai": ["Isekai"],
  "Psychologique": ["Psychological"],
};

/** Projet Studio rendu visible dans le catalogue (paramètres du projet). */
type StudioCatalogProject = {
  id: string;
  title: string;
  synopsis: string;
  status: string;
  genres: string[];
  chapters: { status?: string }[];
  coverDataUrl?: string;
  catalogVisible?: boolean;
};

export function CatalogPage({
  publicMode = false,
  embedded = false,
}: {
  publicMode?: boolean;
  embedded?: boolean;
} = {}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("Avis décroissants");
  const [languages, setLanguages] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(0);
  const [minChapters, setMinChapters] = useState("");
  const [maxChapters, setMaxChapters] = useState("");
  const [demos, setDemos] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [studioEntries, setStudioEntries] = useState<CatalogManga[]>([]);

  useEffect(() => {
    void loadStudioProjects<StudioCatalogProject>()
      .then((rows) =>
        setStudioEntries(
          rows
            .filter((p) => p.catalogVisible)
            .map((p) => ({
              id: p.id,
              title: p.title,
              creator: "Toi",
              cover: p.coverDataUrl || "",
              demographic: (["Shonen", "Seinen", "Shojo", "Josei"].includes(p.genres[0]) ? p.genres[0] : "Shonen") as CatalogManga["demographic"],
              genres: p.genres,
              rating: getMangaRating(p.id),
              chapters: p.chapters.filter((c) => c.status === "Published").length,
              status: p.status,
              synopsis: p.synopsis,
              language: "FR",
            })),
        ),
      )
      .catch(() => setStudioEntries([]));
  }, []);

  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const filtered = useMemo(() => {
    const minC = Number(minChapters) || 0;
    const maxC = Number(maxChapters) || 0;
    let list = [...studioEntries, ...CATALOG_MANGA].filter((m) => {
      if (query && !m.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (languages.length && !languages.includes(m.language)) return false;
      if (demos.length && !demos.includes(m.demographic)) return false;
      if (subgenres.length && !subgenres.some((g) => (SUBGENRE_MATCH[g] ?? [g]).some((en) => m.genres.includes(en)))) return false;
      if (minRating > 0 && m.rating < minRating) return false;
      if (maxRating > 0 && m.rating > maxRating) return false;
      if (minC > 0 && m.chapters < minC) return false;
      if (maxC > 0 && m.chapters > maxC) return false;
      return true;
    });
    switch (sort) {
      case "Avis décroissants":
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
      case "Avis croissants":
        list = [...list].sort((a, b) => a.rating - b.rating);
        break;
    }
    return list;
  }, [query, languages, demos, subgenres, minRating, maxRating, minChapters, maxChapters, sort, studioEntries]);

  const activeChips: { label: string; onRemove: () => void }[] = [
    ...(query ? [{ label: `“${query}”`, onRemove: () => setQuery("") }] : []),
    ...languages.map((l) => ({ label: l, onRemove: () => setLanguages(languages.filter((x) => x !== l)) })),
    ...(minRating > 0 ? [{ label: `Note min ${minRating}★`, onRemove: () => setMinRating(0) }] : []),
    ...(maxRating > 0 ? [{ label: `Note max ${maxRating}★`, onRemove: () => setMaxRating(0) }] : []),
    ...(minChapters ? [{ label: `Chap. min ${minChapters}`, onRemove: () => setMinChapters("") }] : []),
    ...(maxChapters ? [{ label: `Chap. max ${maxChapters}`, onRemove: () => setMaxChapters("") }] : []),
    ...demos.map((d) => ({ label: d, onRemove: () => setDemos(demos.filter((x) => x !== d)) })),
    ...subgenres.map((g) => ({ label: g, onRemove: () => setSubgenres(subgenres.filter((x) => x !== g)) })),
  ];

  const resetAll = () => {
    setQuery("");
    setLanguages([]);
    setMinRating(0);
    setMaxRating(0);
    setMinChapters("");
    setMaxChapters("");
    setDemos([]);
    setSubgenres([]);
    setSort("Avis décroissants");
  };

  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${embedded ? "py-0" : "py-12 sm:py-16"}`}>
      <header className="mb-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Browse</p>
        <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">Catalogue</h1>
        <p className="mt-3 max-w-2xl text-base text-secondary-foreground">
          Explore original manga published by CollabManga creators.
        </p>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manga…"
            className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-12 w-full appearance-none rounded-xl border border-border bg-card pl-4 pr-10 text-sm font-semibold text-foreground focus:border-primary/60 focus:outline-none md:w-56"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="mb-6 grid gap-5 rounded-2xl border border-border bg-surface p-5 md:grid-cols-2">
        <FilterGroup title="Language">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                const code = e.target.value;
                if (code && !languages.includes(code)) setLanguages([...languages, code]);
              }}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              aria-label="Ajouter une langue au filtre"
            >
              <option value="">Ajouter une langue…</option>
              {SITE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {languages.map((code) => (
              <ChipBtn key={code} active onClick={() => toggle(languages, code, setLanguages)}>
                {languageLabel(code)} ✕
              </ChipBtn>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Notes">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-secondary-foreground">
              Min
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              >
                {RATING_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-secondary-foreground">
              Max
              <select
                value={maxRating}
                onChange={(e) => setMaxRating(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none"
              >
                {RATING_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
        </FilterGroup>

        <FilterGroup title="Genre">
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((g) => (
              <ChipBtn key={g} active={demos.includes(g)} onClick={() => toggle(demos, g, setDemos)}>
                {g}
              </ChipBtn>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Chapters">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={minChapters}
              onChange={(e) => setMinChapters(e.target.value)}
              placeholder="Min"
              className="h-10 w-28 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
            <span className="text-muted-foreground">–</span>
            <input
              inputMode="numeric"
              value={maxChapters}
              onChange={(e) => setMaxChapters(e.target.value)}
              placeholder="Max"
              className="h-10 w-28 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
          </div>
        </FilterGroup>

        <div className="md:col-span-2">
          <FilterGroup title="Subgenre">
            <div className="flex flex-wrap gap-2">
              {SUBGENRE_OPTIONS.map((g) => (
                <ChipBtn key={g} active={subgenres.includes(g)} onClick={() => toggle(subgenres, g, setSubgenres)}>
                  {g}
                </ChipBtn>
              ))}
            </div>
          </FilterGroup>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active:
          </span>
          {activeChips.map((c, i) => (
            <button
              key={i}
              onClick={c.onRemove}
              className="chip chip-primary hover:bg-primary/20"
            >
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={resetAll}
            className="ml-1 text-xs font-bold text-primary hover:text-primary-hover"
          >
            Reset all
          </button>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{filtered.length}</span> manga
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-foreground">No manga found</h3>
          <p className="mt-2 text-sm text-secondary-foreground">
            Try changing your filters or search terms.
          </p>
          <button onClick={resetAll} className="btn-primary mt-6">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m) => (
            <MangaCard key={m.id} manga={m} publicMode={publicMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-primary/50 bg-primary-soft text-primary" : "border-border bg-transparent text-secondary-foreground hover:border-primary/30"}`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function StarRow({ filled }: { filled: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < filled ? "fill-[var(--star)] text-[var(--star)]" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}
