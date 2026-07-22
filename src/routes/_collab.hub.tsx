import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Info,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { HERO_FALLBACK_IMAGE, CATALOG_MANGA, NEW_DROPS, type CatalogManga, type HeroSlide, type NewDrop } from "@/lib/haven-data";
import { MangaCard } from "@/components/haven/MangaCard";
import { loadStudioProjects } from "@/lib/studio-projects";
import { getMangaRating } from "@/lib/manga-ratings";
import { useI18n } from "@/lib/i18n";

type StudioCatalogChapter = { id: string; number: number; title: string; status: string; updated: string };
type StudioCatalogProject = {
  id: string;
  title: string;
  synopsis: string;
  status: string;
  genres: string[];
  chapters: StudioCatalogChapter[];
  coverDataUrl?: string;
  catalogVisible?: boolean;
};

/** Projets Studio rendus visibles → affichés sur la page d'accueil. */
function useVisibleStudioEntries(): CatalogManga[] {
  const [entries, setEntries] = useState<CatalogManga[]>([]);
  useEffect(() => {
    void loadStudioProjects<StudioCatalogProject>()
      .then((rows) =>
        setEntries(
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
      .catch(() => setEntries([]));
  }, []);
  return entries;
}

/** Derniers chapitres publiés des projets Studio visibles → alimente "New Chapter Releases". */
function useVisibleStudioChapters(): NewDrop[] {
  const [drops, setDrops] = useState<NewDrop[]>([]);
  useEffect(() => {
    void loadStudioProjects<StudioCatalogProject>()
      .then((rows) => {
        const list: NewDrop[] = [];
        for (const p of rows) {
          if (!p.catalogVisible) continue;
          const published = p.chapters.filter((c) => c.status === "Published");
          const last = published[published.length - 1];
          if (!last) continue;
          list.push({
            mangaId: p.id,
            chapterId: last.id,
            cover: p.coverDataUrl || "",
            title: p.title,
            chapterLabel: `Ch. ${last.number} — ${last.title}`,
            note: p.synopsis,
            date: last.updated,
          });
        }
        setDrops(list);
      })
      .catch(() => setDrops([]));
  }, []);
  return drops;
}

export const Route = createFileRoute("/_collab/hub")({
  head: () => ({
    meta: [
      { title: "CollabManga — Discover original manga" },
      {
        name: "description",
        content:
          "Top manga, new chapter releases and hidden gems from CollabManga creators. Start reading tonight.",
      },
    ],
  }),
  component: HomePage,
});

function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const total = slides.length;
  const go = useCallback((n: number) => setI((prev) => (prev + n + total) % total), [total]);

  useEffect(() => {
    if (total === 0) return;
    const t = setInterval(() => setI((p) => (p + 1) % total), 6500);
    return () => clearInterval(t);
  }, [total]);

  // Aucun manga publié : héros générique de bienvenue, sans contenu fantôme.
  if (total === 0) {
    return (
      <section className="relative">
        <div className="relative h-[70vh] min-h-[520px] w-full overflow-hidden md:h-[80vh]">
          <img src={HERO_FALLBACK_IMAGE} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
          <div className="absolute inset-0" style={{ background: "var(--gradient-hero-side)" }} />
          <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-20 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="chip chip-primary">
                  <Sparkles className="h-3 w-3" /> {t("hub.welcomeBadge")}
                </span>
              </div>
              <h1 className="font-display text-4xl font-extrabold text-foreground drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl md:text-6xl lg:text-7xl">
                {t("hub.welcomeTitle")}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-secondary-foreground sm:text-base">
                {t("hub.welcomeText")}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/studio" search={{ project: undefined, chapter: undefined }} className="btn-primary">
                  <Play className="h-4 w-4" /> {t("hub.openStudio")}
                </Link>
                <Link to="/ai" className="btn-ghost">
                  <Info className="h-4 w-4" /> {t("intro.discoverAi")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[i];

  return (
    <section className="relative">
      <div className="relative h-[70vh] min-h-[520px] w-full overflow-hidden md:h-[80vh]">
        {slides.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}
            aria-hidden={idx !== i}
          >
            <img src={s.image || HERO_FALLBACK_IMAGE} alt={s.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
            <div className="absolute inset-0" style={{ background: "var(--gradient-hero-side)" }} />
          </div>
        ))}

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="chip chip-primary">
                <Sparkles className="h-3 w-3" /> {t("hub.topManga")} #{slide.rank}
              </span>
              <span className="chip">{slide.demographic}</span>
              <span className="chip">{slide.status}</span>
              {slide.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
            <h1 className="font-display text-4xl font-extrabold text-foreground drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl md:text-6xl lg:text-7xl">
              {slide.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-secondary-foreground sm:text-base">
              {slide.synopsis}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/manga/$id" params={{ id: slide.id }} className="btn-primary">
                <Play className="h-4 w-4" /> {t("hub.readNow")}
              </Link>
              <Link to="/manga/$id" params={{ id: slide.id }} className="btn-ghost">
                <Info className="h-4 w-4" /> {t("hub.details")}
              </Link>
            </div>
          </div>
        </div>

        <button
          aria-label="Previous"
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/60 text-foreground backdrop-blur transition hover:bg-background/80 sm:left-6 sm:h-12 sm:w-12"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          aria-label="Next"
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/60 text-foreground backdrop-blur transition hover:bg-background/80 sm:right-6 sm:h-12 sm:w-12"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-10 bg-primary" : "w-4 bg-white/30 hover:bg-white/50"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  cta,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        )}
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-secondary-foreground">{subtitle}</p>}
      </div>
      {cta}
    </div>
  );
}

function NewChapterRow({ drops }: { drops: NewDrop[] }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {drops.map((c) => (
        <Link
          key={`${c.mangaId}-${c.chapterId}`}
          to="/manga/$id/chapter/$chapterId"
          params={{ id: c.mangaId, chapterId: c.chapterId }}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
        >
          <img
            src={c.cover || HERO_FALLBACK_IMAGE}
            alt={c.title}
            loading="lazy"
            className="h-24 w-16 shrink-0 rounded-lg object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate font-display text-sm font-bold text-foreground">{c.title}</p>
            <p className="truncate text-xs font-semibold text-primary">{c.chapterLabel}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.note}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.date}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:text-primary-hover">
                {t("hub.readChapter")} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function HomePage() {
  const { t } = useI18n();
  const studioEntries = useVisibleStudioEntries();
  const studioDrops = useVisibleStudioChapters();
  const all = [...studioEntries, ...CATALOG_MANGA];
  const newDrops = [...studioDrops, ...NEW_DROPS];
  // Tant qu'aucun avis n'existe, la vedette = les premiers projets ajoutés
  // (le store liste les plus récents en premier → on inverse pour l'ancienneté).
  const hasRatings = all.some((m) => m.rating > 0);
  const byRating = hasRatings ? [...all].sort((a, b) => b.rating - a.rating) : [...all].reverse();
  const favorites = byRating.slice(0, 4);
  // Le héros, en haut de page, met en avant les mêmes mangas les plus aimés, en rotation.
  const heroSlides: HeroSlide[] = favorites.map((m, idx) => ({
    id: m.id,
    title: m.title,
    rank: idx + 1,
    image: m.cover || HERO_FALLBACK_IMAGE,
    demographic: m.demographic,
    status: m.status,
    genres: m.genres,
    synopsis: m.synopsis,
  }));
  const gems = [...all].sort((a, b) => a.chapters - b.chapters).slice(0, 4);
  const hasCatalog = all.length > 0;

  return (
    <div>
      <HeroCarousel slides={heroSlides} />

      {!hasCatalog && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center sm:p-14">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {t("hub.emptyTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-secondary-foreground sm:text-base">
              {t("hub.emptyText")}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/studio" search={{ project: undefined, chapter: undefined }} className="btn-primary">
                {t("hub.launchProject")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/announcements" className="btn-ghost">
                {t("hub.findCollaborators")}
              </Link>
            </div>
          </div>
        </section>
      )}

      {hasCatalog && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeader
            eyebrow={t("hub.readerPicks")}
            title={t("hub.favoriteManga")}
            subtitle={t("hub.favoriteSubtitle")}
            cta={
              <Link
                to="/manga"
                className="hidden items-center gap-1 text-sm font-bold text-primary hover:text-primary-hover sm:inline-flex"
              >
                {t("hub.seeAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>
        </section>
      )}

      {newDrops.length > 0 && (
        <section className="border-y border-border/70 bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeader
              eyebrow={t("hub.latestDrops")}
              title={t("hub.newReleases")}
              subtitle={t("hub.newReleasesSubtitle")}
            />
            <NewChapterRow drops={newDrops} />
          </div>
        </section>
      )}

      {hasCatalog && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeader
            eyebrow={t("hub.underrated")}
            title={t("hub.hiddenGems")}
            subtitle={t("hub.hiddenGemsSubtitle")}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {gems.map((m) => (
              <MangaCard key={m.id} manga={m} variant="editorial" />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-deep p-8 sm:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 chip chip-primary">
                <BookOpen className="h-3.5 w-3.5" /> {t("hub.exploreBadge")}
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
                {t("hub.discoverMore")}
              </h2>
              <p className="mt-4 max-w-xl text-base text-secondary-foreground">
                {t("hub.discoverMoreText")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/manga" className="btn-primary">
                  {t("intro.exploreCatalog")} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/ai/manga-page" className="btn-ghost">
                  {t("hub.startProject")}
                </Link>
              </div>
            </div>
            <div className="hidden gap-3 md:grid md:grid-cols-3">
              {CATALOG_MANGA.slice(0, 3).map((m, idx) => (
                <img
                  key={m.id}
                  src={m.cover}
                  alt=""
                  loading="lazy"
                  className={`aspect-[3/4] w-full rounded-xl object-cover shadow-[var(--shadow-card)] ${idx === 1 ? "translate-y-6" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
