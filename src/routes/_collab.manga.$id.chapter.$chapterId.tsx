import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { getChapter, type Chapter, type Manga } from "@/lib/manga-data";
import { RatingSection } from "@/components/manga/RatingSection";
import { CommentsSection } from "@/components/manga/CommentsSection";
import { CommentsPanel } from "@/components/collab/CommentsPanel";

type LoaderData = {
  manga: Manga;
  chapter: Chapter;
  prev: Chapter | null;
  next: Chapter | null;
};

export const Route = createFileRoute("/_collab/manga/$id/chapter/$chapterId")({
  loader: ({ params }) => {
    // Les chapitres des projets Studio vivent en IndexedDB (client) : pas de notFound ici.
    return { data: (getChapter(params.id, params.chapterId) ?? null) as LoaderData | null, id: params.id, chapterId: params.chapterId };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.data
      ? [
          { title: `${loaderData.data.chapter.title} — ${loaderData.data.manga.title}` },
          { name: "description", content: `Read ${loaderData.data.chapter.title} of ${loaderData.data.manga.title} on CollabManga.` },
        ]
      : [{ title: "Chapitre — CollabManga" }],
  }),
  notFoundComponent: ChapterNotFound,
  component: ChapterSwitch,
});

type StudioChapterView = {
  projectTitle: string;
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  images: string[];
  prevChapterId: string | null;
  nextChapterId: string | null;
};

function ChapterSwitch() {
  const { data, id, chapterId } = Route.useLoaderData() as { data: LoaderData | null; id: string; chapterId: string };
  const [studio, setStudio] = useState<StudioChapterView | null | "loading">(data ? null : "loading");

  useEffect(() => {
    if (data) return;
    void import("@/lib/studio-projects").then(({ loadStudioProjects }) =>
      loadStudioProjects<{
        id: string;
        title: string;
        catalogVisible?: boolean;
        chapters: { id: string; number: number; title: string; status: string; pages: { candidates: { id: string; image?: string }[]; validatedCandidateId: string | null }[] }[];
      }>().then((rows) => {
        const project = rows.find((p) => p.id === id && p.catalogVisible);
        const chapter = project?.chapters.find((c) => c.id === chapterId && c.status === "Published");
        if (!project || !chapter) {
          setStudio(null);
          return;
        }
        const images = chapter.pages
          .map((p) => p.candidates.find((cd) => cd.id === p.validatedCandidateId)?.image)
          .filter((img): img is string => Boolean(img));
        const published = project.chapters.filter((c) => c.status === "Published");
        const idx = published.findIndex((c) => c.id === chapter.id);
        setStudio({
          projectTitle: project.title,
          projectId: project.id,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterNumber: chapter.number,
          images,
          prevChapterId: idx > 0 ? published[idx - 1].id : null,
          nextChapterId: idx >= 0 && idx < published.length - 1 ? published[idx + 1].id : null,
        });
      }),
    ).catch(() => setStudio(null));
  }, [data, id, chapterId]);

  if (data) return <ChapterReader />;
  if (studio === "loading") {
    return <div className="mx-auto max-w-[600px] px-6 py-16 text-center text-[14px] text-[color:var(--color-text-secondary)]">Chargement…</div>;
  }
  if (!studio) return <ChapterNotFound />;
  return <StudioChapterReader view={studio} />;
}

function StudioChapterReader({ view }: { view: StudioChapterView }) {
  const [mode, setMode] = useState<Mode>("vertical");
  const [page, setPage] = useState(0);
  const total = view.images.length;
  const canPrev = page > 0;
  const canNext = page < total - 1;
  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(total - 1, p + 1));

  useEffect(() => {
    setPage(0);
  }, [view.chapterId]);

  // Mode pagination : flèches clavier gauche/droite.
  useEffect(() => {
    if (mode !== "pagination") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(total - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, total]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6 md:py-8">
      {/* Barre supérieure : retour, titre, mode de lecture */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/manga/$id" params={{ id: view.projectId }} className="btn-ghost -ml-3 h-10">
          <ArrowLeft className="h-4 w-4" /> {view.projectTitle}
        </Link>
        <span className="text-[13px] font-bold text-[color:var(--color-text-secondary)]">
          Ch. {view.chapterNumber} — {view.chapterTitle}
        </span>
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)" }}
          role="tablist"
          aria-label="Mode de lecture"
        >
          {(["vertical", "pagination"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors"
              style={
                mode === m
                  ? { background: "rgba(57,255,136,0.12)", color: "#39ff88", border: "1px solid rgba(57,255,136,0.45)" }
                  : { color: "var(--color-text-secondary)", border: "1px solid transparent" }
              }
            >
              {m === "vertical" ? "Scroll vertical" : "Pagination"}
            </button>
          ))}
        </div>
      </div>

      {view.images.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center text-[14px] text-[color:var(--color-text-secondary)]" style={{ borderColor: "var(--color-border-default)" }}>
          Aucune page validée avec image dans ce chapitre pour l'instant.
        </div>
      ) : mode === "vertical" ? (
        <div className="flex flex-col gap-2">
          {view.images.map((src, i) => (
            <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full rounded-xl border" style={{ borderColor: "var(--color-border-default)" }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Page + zones de clic : moitié gauche = page précédente, moitié droite = page suivante. */}
          <div className="relative w-full select-none">
            <img
              src={view.images[page]}
              alt={`Page ${page + 1}`}
              className="mx-auto block w-auto max-w-full rounded-xl border"
              style={{ borderColor: "var(--color-border-default)", maxHeight: "80vh" }}
            />
            <button
              type="button"
              aria-label="Page précédente"
              onClick={goPrev}
              disabled={!canPrev}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer disabled:cursor-default"
            />
            <button
              type="button"
              aria-label="Page suivante"
              onClick={goNext}
              disabled={!canNext}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer disabled:cursor-default"
            />
          </div>
          {/* Contrôles pages — même grille que la nav chapitre pour un alignement parfait. */}
          <div className="mx-auto grid w-full max-w-[520px] grid-cols-[1fr_auto_1fr] items-center gap-3">
            <button
              className="btn-secondary h-10 justify-self-start whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canPrev}
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" /> Page précédente
            </button>
            <span className="whitespace-nowrap text-[13px] font-bold text-[color:var(--color-text-secondary)]">
              {page + 1} / {total}
            </span>
            <button
              className="btn-secondary h-10 justify-self-end whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canNext}
              onClick={goNext}
            >
              Page suivante <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation entre chapitres — alignée sur la même grille que les contrôles de page. */}
      <div className="mx-auto mt-8 grid w-full max-w-[520px] grid-cols-[1fr_auto_1fr] items-center gap-3">
        {view.prevChapterId ? (
          <Link to="/manga/$id/chapter/$chapterId" params={{ id: view.projectId, chapterId: view.prevChapterId }} className="btn-secondary h-10 justify-self-start whitespace-nowrap">
            <ChevronLeft className="h-4 w-4" /> Chapitre précédent
          </Link>
        ) : (
          <span className="btn-secondary h-10 cursor-not-allowed justify-self-start whitespace-nowrap opacity-40"><ChevronLeft className="h-4 w-4" /> Chapitre précédent</span>
        )}
        <span aria-hidden />
        {view.nextChapterId ? (
          <Link to="/manga/$id/chapter/$chapterId" params={{ id: view.projectId, chapterId: view.nextChapterId }} className="btn-secondary h-10 justify-self-end whitespace-nowrap">
            Chapitre suivant <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="btn-secondary h-10 cursor-not-allowed justify-self-end whitespace-nowrap opacity-40">Chapitre suivant <ChevronRight className="h-4 w-4" /></span>
        )}
      </div>

      {/* Commentaires du chapitre (réels, Supabase) */}
      <section
        className="mt-8 rounded-2xl p-6"
        style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)" }}
      >
        <h2 className="mb-4 font-display text-[18px] font-extrabold">Commentaires</h2>
        <CommentsPanel entityType="manga_chapter" entityId={`${view.projectId}:${view.chapterId}`} />
      </section>
    </div>
  );
}

function ChapterNotFound() {
  return (
    <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
      <h1 className="font-display text-[28px] font-extrabold">Chapter not found</h1>
      <p className="mt-2 text-[14px] text-[color:var(--color-text-secondary)]">
        This chapter doesn't exist or is no longer available.
      </p>
      <div className="mt-6">
        <Link to="/manga" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>
    </div>
  );
}

type Mode = "vertical" | "pagination";

function ChapterReader() {
  const loaderData = Route.useLoaderData() as { data: LoaderData | null };
  const { manga, chapter, prev, next } = loaderData.data as LoaderData;
  const [mode, setMode] = useState<Mode>("vertical");
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(true);

  useEffect(() => {
    setPage(0);
  }, [chapter.id]);

  useEffect(() => {
    if (mode !== "pagination") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, chapter.pageImages.length - 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, chapter.pageImages.length]);

  return (
    <div style={{ background: "var(--color-reader-bg)", minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div
          className="sticky top-4 z-20 mb-6 flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:px-5"
          style={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 18,
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/manga/$id" params={{ id: manga.id }} className="btn-icon" aria-label="Back to manga">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">{manga.title}</p>
              <p className="truncate font-display text-[15px] font-bold leading-5 md:text-[16px]">
                Chapter {chapter.number} · {chapter.title}
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Reading mode"
            className="order-3 flex w-full items-center gap-1 rounded-2xl p-1 md:order-none md:mx-auto md:w-auto"
            style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-default)" }}
          >
            {(["vertical", "pagination"] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className="flex-1 rounded-xl px-4 py-2 text-[13px] font-bold capitalize transition md:flex-none"
                  style={
                    active
                      ? {
                          background: "var(--color-neon-fill)",
                          border: "1px solid var(--color-neon-border)",
                          color: "var(--color-neon)",
                        }
                      : {
                          background: "transparent",
                          border: "1px solid transparent",
                          color: "var(--color-text-secondary)",
                        }
                  }
                >
                  {m === "vertical" ? "Vertical" : "Pagination"}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {prev ? (
              <Link
                to="/manga/$id/chapter/$chapterId"
                params={{ id: manga.id, chapterId: prev.id }}
                className="btn-icon"
                aria-label="Previous chapter"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <button className="btn-icon" aria-label="Previous chapter" disabled style={{ opacity: 0.4 }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {next ? (
              <Link
                to="/manga/$id/chapter/$chapterId"
                params={{ id: manga.id, chapterId: next.id }}
                className="btn-icon"
                aria-label="Next chapter"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <button className="btn-icon" aria-label="Next chapter" disabled style={{ opacity: 0.4 }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="btn-icon"
                aria-label="Reader settings"
                aria-expanded={showSettings}
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {showSettings && (
                <div
                  className="absolute right-0 top-11 z-30 w-64 rounded-2xl p-4 text-[13px]"
                  style={{
                    background: "var(--color-panel)",
                    border: "1px solid var(--color-border-default)",
                    boxShadow: "0 24px 48px -24px rgba(0,0,0,0.6)",
                  }}
                >
                  <p className="meta-label mb-3">Reader settings</p>
                  <label className="flex items-center justify-between py-1.5 text-[color:var(--color-text-secondary)]">
                    <span>Show page numbers</span>
                    <input
                      type="checkbox"
                      checked={showPageNumbers}
                      onChange={(e) => setShowPageNumbers(e.target.checked)}
                      className="h-4 w-4 accent-[color:var(--color-neon)]"
                    />
                  </label>
                  <div className="mt-2 space-y-2">
                    <p className="meta-label">Fit</p>
                    <div className="flex gap-2">
                      <button className="btn-secondary h-9 flex-1 px-3 text-[13px]">Fit width</button>
                      <button className="btn-secondary h-9 flex-1 px-3 text-[13px]">Fit height</button>
                    </div>
                    <p className="meta-label pt-2">Reading direction</p>
                    <p className="text-[12px] text-[color:var(--color-text-muted)]">Direction placeholder</p>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSaved((v) => !v)}
              className="btn-icon"
              aria-label={saved ? "Unsave chapter" : "Save chapter"}
              aria-pressed={saved}
              style={saved ? { color: "var(--color-neon)", borderColor: "var(--color-neon-border)" } : undefined}
            >
              <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {mode === "vertical" ? (
          <div className="mx-auto flex max-w-[960px] flex-col gap-3">
            {chapter.pageImages.map((src: string, i: number) => (
              <figure key={i} className="relative">
                <img
                  src={src}
                  alt={`${chapter.title} — page ${i + 1}`}
                  loading="lazy"
                  className="w-full"
                  style={{
                    borderRadius: 8,
                    background: "var(--color-bg)",
                    border: "1px solid rgba(133,154,206,0.10)",
                    display: "block",
                  }}
                />
                {showPageNumbers && (
                  <figcaption className="mt-1 text-center text-[12px] text-[color:var(--color-text-muted)]">
                    Page {i + 1} / {chapter.pageImages.length}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-[960px]">
            <div
              className="relative flex items-center justify-center overflow-hidden p-4 md:p-6"
              style={{
                background: "var(--color-reader-bg)",
                borderRadius: 22,
                border: "1px solid var(--color-border-default)",
                minHeight: 480,
              }}
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
                disabled={page === 0}
                className="btn-icon absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2"
                style={page === 0 ? { opacity: 0.35 } : undefined}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <img
                key={page}
                src={chapter.pageImages[page]}
                alt={`${chapter.title} — page ${page + 1}`}
                className="max-h-[78vh] w-auto max-w-full select-none"
                style={{ borderRadius: 8, background: "var(--color-bg)" }}
              />
              {/* Zones de clic : moitié gauche = page précédente, moitié droite = page suivante. */}
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="absolute inset-y-0 left-0 z-[5] w-1/2 cursor-pointer disabled:cursor-default"
              />
              <button
                type="button"
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(chapter.pageImages.length - 1, p + 1))}
                disabled={page === chapter.pageImages.length - 1}
                className="absolute inset-y-0 right-0 z-[5] w-1/2 cursor-pointer disabled:cursor-default"
              />
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(chapter.pageImages.length - 1, p + 1))}
                aria-label="Next page"
                disabled={page === chapter.pageImages.length - 1}
                className="btn-icon absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2"
                style={page === chapter.pageImages.length - 1 ? { opacity: 0.35 } : undefined}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-[13px] font-bold text-[color:var(--color-text-secondary)]">
                Page <span style={{ color: "var(--color-neon)" }}>{page + 1}</span> /{" "}
                {chapter.pageImages.length}
              </p>
              <div className="flex max-w-full flex-wrap justify-center gap-1.5">
                {chapter.pageImages.map((_: string, i: number) => {
                  const active = i === page;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      aria-label={`Go to page ${i + 1}`}
                      aria-current={active ? "page" : undefined}
                      className="min-w-8 rounded-md px-2 py-1 text-[12px] font-bold transition"
                      style={
                        active
                          ? {
                              background: "var(--color-neon-fill)",
                              border: "1px solid var(--color-neon-border)",
                              color: "var(--color-neon)",
                            }
                          : {
                              background: "var(--color-elevated)",
                              border: "1px solid var(--color-border-default)",
                              color: "var(--color-text-muted)",
                            }
                      }
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-[color:var(--color-text-muted)]">
                Use ← and → keys to navigate pages
              </p>
            </div>
          </div>
        )}

        <div className="panel mt-10 flex flex-col items-center justify-between gap-3 p-5 md:flex-row">
          {prev ? (
            <Link
              to="/manga/$id/chapter/$chapterId"
              params={{ id: manga.id, chapterId: prev.id }}
              className="btn-secondary w-full md:w-auto"
            >
              <ChevronLeft className="h-4 w-4" /> Previous chapter
            </Link>
          ) : (
            <button className="btn-secondary w-full md:w-auto" disabled>
              <ChevronLeft className="h-4 w-4" /> Previous chapter
            </button>
          )}
          <Link to="/manga/$id" params={{ id: manga.id }} className="btn-secondary w-full md:w-auto">
            Back to manga
          </Link>
          {next ? (
            <Link
              to="/manga/$id/chapter/$chapterId"
              params={{ id: manga.id, chapterId: next.id }}
              className="btn-primary w-full md:w-auto"
            >
              Next chapter <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button className="btn-primary w-full md:w-auto" disabled>
              Next chapter
            </button>
          )}
        </div>

        <div className="mt-8 space-y-6">
          <RatingSection />
          <CommentsSection />
        </div>
      </div>
    </div>
  );
}