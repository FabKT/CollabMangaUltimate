import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, Play, Star, ArrowLeft, Search } from "lucide-react";
import { getManga, type Chapter, type Manga } from "@/lib/manga-data";
import { ChapterRow } from "@/components/manga/ChapterRow";
import { loadStudioProjects } from "@/lib/studio-projects";

/** Projet Studio lisible depuis le catalogue. */
type StudioReadableProject = {
  id: string;
  title: string;
  synopsis: string;
  status: string;
  genres: string[];
  subgenres?: string[];
  coverDataUrl?: string;
  catalogVisible?: boolean;
  chapters: {
    id: string;
    number: number;
    title: string;
    status: string;
    pages: { id: string; candidates: { id: string; image?: string }[]; validatedCandidateId: string | null }[];
  }[];
};

export const Route = createFileRoute("/_collab/manga/$id/")({
  loader: ({ params }) => {
    // Les projets Studio vivent en IndexedDB (client) : ne pas jeter notFound ici.
    return { manga: (getManga(params.id) ?? null) as Manga | null, id: params.id };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.manga
      ? [
          { title: `${loaderData.manga.title} — CollabManga` },
          { name: "description", content: `${loaderData.manga.title} on CollabManga. Read the latest chapters, synopsis, and reader reviews.` },
          { property: "og:title", content: `${loaderData.manga.title} — CollabManga` },
          { property: "og:description", content: "Published manga on CollabManga." },
          { property: "og:image", content: loaderData.manga.cover },
          { name: "twitter:image", content: loaderData.manga.cover },
        ]
      : [{ title: "Manga — CollabManga" }],
  }),
  notFoundComponent: NotFound,
  component: MangaDetailSwitch,
});

function MangaDetailSwitch() {
  const { manga, id } = Route.useLoaderData() as { manga: Manga | null; id: string };
  const [studio, setStudio] = useState<StudioReadableProject | null | "loading">(manga ? null : "loading");

  useEffect(() => {
    if (manga) return;
    void loadStudioProjects<StudioReadableProject>()
      .then((rows) => setStudio(rows.find((p) => p.id === id && p.catalogVisible) ?? null))
      .catch(() => setStudio(null));
  }, [manga, id]);

  if (manga) return <MangaDetail />;
  if (studio === "loading") {
    return (
      <div className="mx-auto max-w-[600px] px-6 py-16 text-center text-[14px] text-[color:var(--color-text-secondary)]">
        Chargement…
      </div>
    );
  }
  if (!studio) return <NotFound />;
  return <StudioMangaDetail project={studio} />;
}

function StudioMangaDetail({ project }: { project: StudioReadableProject }) {
  const published = project.chapters.filter((c) => c.status === "Published");
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mb-6">
        <Link to="/manga" className="btn-ghost -ml-3 h-10">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>

      <section
        className="mb-8 p-6 md:p-8"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: 28 }}
      >
        <div className="grid gap-6 md:grid-cols-[minmax(200px,260px)_1fr] md:gap-8">
          <div className="mx-auto w-full max-w-[260px] md:mx-0">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl" style={{ border: "1px solid var(--color-border-default)" }}>
              {project.coverDataUrl ? (
                <img src={project.coverDataUrl} alt={`${project.title} cover`} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[13px] font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]" style={{ background: "linear-gradient(160deg,#0E1736,#050B1D)" }}>
                  Cover pending
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-active">{project.status}</span>
              <span className="chip-neutral">FR</span>
            </div>
            <h1 className="mt-3 font-display text-[28px] font-extrabold leading-[36px] md:text-[34px] md:leading-[42px]">
              {project.title}
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-[25px] text-[color:var(--color-text-secondary)]">
              {project.synopsis}
            </p>
            <div className="mt-5">
              <p className="meta-label mb-2">Genre & sous-genres</p>
              <div className="flex flex-wrap gap-1.5">
                {project.genres.map((g) => <span key={g} className="chip-active font-bold">{g}</span>)}
                {(project.subgenres ?? []).map((g) => <span key={g} className="chip-neutral">{g}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="p-6 md:p-8"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)", borderRadius: 28 }}
      >
        <h2 className="font-display text-[20px] font-extrabold">Chapitres publiés</h2>
        {published.length === 0 ? (
          <p className="mt-3 text-[14px] text-[color:var(--color-text-secondary)]">Aucun chapitre publié pour l'instant.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {published.map((c) => {
              const readablePages = c.pages.filter(
                (p) => p.validatedCandidateId && p.candidates.find((cd) => cd.id === p.validatedCandidateId)?.image,
              ).length;
              return (
                <Link
                  key={c.id}
                  to="/manga/$id/chapter/$chapterId"
                  params={{ id: project.id, chapterId: c.id }}
                  className="flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors hover:border-[color:var(--color-neon,#39ff88)]"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-card, rgba(255,255,255,0.02))" }}
                >
                  <div>
                    <div className="text-[14px] font-bold">Ch. {c.number} — {c.title}</div>
                    <div className="text-[12px] text-[color:var(--color-text-muted)]">{readablePages} page{readablePages > 1 ? "s" : ""} lisible{readablePages > 1 ? "s" : ""}</div>
                  </div>
                  <Play className="h-4 w-4 text-[color:var(--color-text-secondary)]" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
      <h1 className="font-display text-[28px] font-extrabold">Manga not found</h1>
      <p className="mt-2 text-[14px] text-[color:var(--color-text-secondary)]">
        This manga doesn't exist or is no longer available.
      </p>
      <div className="mt-6">
        <Link to="/manga" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>
    </div>
  );
}

function MangaDetail() {
  const { manga } = Route.useLoaderData() as { manga: Manga };
  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterSort, setChapterSort] = useState("Newest first");
  const [saved, setSaved] = useState(false);

  const chapters = manga.chapters.filter((c: Chapter) =>
    chapterQuery.trim()
      ? c.title.toLowerCase().includes(chapterQuery.toLowerCase()) ||
        String(c.number).includes(chapterQuery)
      : true,
  );
  const sorted = chapterSort === "Newest first" ? [...chapters].reverse() : chapters;

  const firstChapterId = manga.chapters[0]?.id ?? "ch-1";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mb-6">
        <Link to="/manga" className="btn-ghost -ml-3 h-10">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>

      <section
        className="mb-8 p-6 md:p-8"
        style={{
          background: "var(--color-panel)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 28,
        }}
      >
        <div className="grid gap-6 md:grid-cols-[minmax(200px,260px)_1fr] md:gap-8">
          <div className="mx-auto w-full max-w-[260px] md:mx-0">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl" style={{ border: "1px solid var(--color-border-default)" }}>
              <img src={manga.cover} alt={`${manga.title} cover`} className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className={manga.status === "Completed" ? "chip-info" : "chip-active"}>{manga.status}</span>
              <span className="chip-neutral">{manga.language}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="font-display text-[28px] font-extrabold leading-[36px] md:text-[34px] md:leading-[42px]">
                {manga.title}
              </h1>
              <span
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-extrabold"
                style={{
                  background: "rgba(255, 184, 77, 0.12)",
                  border: "1px solid rgba(255, 184, 77, 0.28)",
                  color: "var(--color-text-primary)",
                }}
                aria-label={`Rating ${manga.rating.toFixed(1)} out of 5`}
              >
                <Star className="h-4 w-4" style={{ color: "var(--color-star)" }} fill="currentColor" />
                {manga.rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
              by <span className="text-[color:var(--color-text-secondary)]">{manga.creator}</span>
            </p>

            <p className="mt-4 max-w-3xl text-[15px] leading-[25px] text-[color:var(--color-text-secondary)]">
              {manga.synopsis}
            </p>

            <div className="mt-5">
              <p className="meta-label mb-2">Genre & sous-genres</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="chip-active font-bold">{manga.demographic}</span>
                {manga.subgenres.map((g: string) => (
                  <span key={g} className="chip-neutral">{g}</span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/manga/$id/chapter/$chapterId"
                params={{ id: manga.id, chapterId: firstChapterId }}
                className="btn-primary"
              >
                <Play className="h-4 w-4" fill="currentColor" /> Start Reading
              </Link>
              <button
                type="button"
                onClick={() => setSaved((v) => !v)}
                className="btn-ghost"
                aria-pressed={saved}
                style={saved ? { color: "var(--color-neon)" } : undefined}
              >
                <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel mb-8 p-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[20px] font-bold leading-7">Chapters</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search chapter</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
              <input
                placeholder="Search chapter"
                value={chapterQuery}
                onChange={(e) => setChapterQuery(e.target.value)}
                className="input-field h-10 w-56 pl-10 text-[13px]"
              />
            </label>
            <select
              value={chapterSort}
              onChange={(e) => setChapterSort(e.target.value)}
              className="input-field h-10 w-auto pr-9 text-[13px]"
              aria-label="Sort chapters"
            >
              {["Newest first", "Oldest first"].map((o) => (
                <option key={o} className="bg-[color:var(--color-panel)]">{o}</option>
              ))}
            </select>
          </div>
        </header>

        {sorted.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: "var(--color-elevated)", border: "1px dashed var(--color-border-default)" }}>
            <p className="font-display text-[18px] font-bold">No chapters published yet</p>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              Published chapters will appear here when available.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((c: Chapter) => (
              <ChapterRow key={c.id} mangaId={manga.id} chapter={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-[20px] font-bold leading-7">About the creators</h2>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-[18px] font-extrabold"
              style={{
                background: "var(--color-input-bg)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-secondary)",
              }}
            >
              {manga.creator.slice(0, 1)}
            </div>
            <div>
              <p className="font-display text-[16px] font-extrabold">{manga.creator}</p>
              <p className="text-[13px] text-[color:var(--color-text-muted)]">Original creator</p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-[22px] text-[color:var(--color-text-secondary)]">
            Short creator bio placeholder describing the team behind this manga.
          </p>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-[20px] font-bold leading-7">Reader reviews</h2>
          <div className="mt-4 flex items-center gap-4">
            <Star className="h-10 w-10" style={{ color: "var(--color-star)" }} fill="currentColor" />
            <div>
              <p className="font-display text-[22px] font-extrabold">{manga.rating.toFixed(1)} / 5</p>
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                Based on {manga.ratingCount.toLocaleString("en-US")} reader ratings
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-[22px] text-[color:var(--color-text-secondary)]">
            Reader review preview placeholder. Once readers rate chapters, top reviews will appear here.
          </p>
        </div>
      </section>

    </div>
  );
}
