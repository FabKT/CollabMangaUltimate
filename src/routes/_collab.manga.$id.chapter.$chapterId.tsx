import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Star,
} from "lucide-react";
import { getChapter, type Chapter, type Manga } from "@/lib/manga-data";
import { RatingSection } from "@/components/manga/RatingSection";
import { CommentsSection } from "@/components/manga/CommentsSection";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import { getChapterRating, rateChapter } from "@/lib/manga-ratings";

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
  lastChapterId: string | null;
  chapters: { id: string; number: number; title: string }[];
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
          lastChapterId: published.length > 0 ? published[published.length - 1].id : null,
          chapters: published.map((c) => ({ id: c.id, number: c.number, title: c.title })),
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

function StarRatingPicker({ value, onRate }: { value: number; onRate: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Noter ${n} sur 5`}
          onClick={() => onRate(n)}
          onMouseEnter={() => setHover(n)}
          className="p-0.5"
        >
          <Star
            className="h-[18px] w-[18px] transition-colors"
            style={{ color: n <= shown ? "var(--color-star, #ffb84d)" : "var(--color-text-disabled, #5e6a90)" }}
            fill={n <= shown ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

const readerPanel = { background: "var(--color-panel)", borderColor: "var(--color-border-default)" } as const;

function StudioChapterReader({ view }: { view: StudioChapterView }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("vertical");
  const [page, setPage] = useState(0);
  const [rating, setRating] = useState(0);
  const [chapterMenu, setChapterMenu] = useState(false);
  const [pageMenu, setPageMenu] = useState(false);
  const chapterRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const total = view.images.length;
  const canPrev = page > 0;
  const canNext = page < total - 1;
  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(total - 1, p + 1));

  useEffect(() => {
    setPage(0);
    setRating(getChapterRating(view.projectId, view.chapterId));
  }, [view.chapterId, view.projectId]);

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

  // Fermeture des dropdowns au clic extérieur.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (chapterRef.current && !chapterRef.current.contains(e.target as Node)) setChapterMenu(false);
      if (pageRef.current && !pageRef.current.contains(e.target as Node)) setPageMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const rate = (n: number) => {
    rateChapter(view.projectId, view.chapterId, n);
    setRating(n);
  };

  const goToChapter = (chapterId: string) => {
    setChapterMenu(false);
    void navigate({ to: "/manga/$id/chapter/$chapterId", params: { id: view.projectId, chapterId } });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Colonne gauche : contenu (header sticky + pages + commentaires) */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header sticky : retour + titre (gauche), contrôle Pages (droite, pagination only) */}
        <div
          className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6"
          style={{ ...readerPanel, borderBottom: "1px solid var(--color-border-default)", backdropFilter: "blur(6px)" }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link to="/manga/$id" params={{ id: view.projectId }} className="btn-ghost -ml-2 h-10">
              <ArrowLeft className="h-4 w-4" /> {view.projectTitle}
            </Link>
            <span className="truncate text-[13px] font-bold text-[color:var(--color-text-secondary)]">
              Ch. {view.chapterNumber} — {view.chapterTitle}
            </span>
          </div>

          {mode === "pagination" && total > 0 && (
            <div ref={pageRef} className="relative flex items-center gap-2">
              <button
                type="button"
                aria-label="Page précédente"
                onClick={goPrev}
                disabled={!canPrev}
                className="grid h-10 w-10 place-items-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPageMenu((v) => !v)}
                aria-expanded={pageMenu}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition-colors"
                style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
              >
                Pages <span className="text-[color:var(--color-text-muted)]">{page + 1}/{total}</span> <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Page suivante"
                onClick={goNext}
                disabled={!canNext}
                className="grid h-10 w-10 place-items-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {pageMenu && (
                <div
                  className="absolute right-0 top-12 z-30 max-h-[60vh] w-56 overflow-y-auto rounded-xl border p-2 shadow-2xl"
                  style={{ borderColor: "var(--color-border-strong, rgba(133,154,206,0.28))", background: "var(--color-panel)" }}
                >
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: total }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setPage(i); setPageMenu(false); }}
                        className="grid h-9 place-items-center rounded-lg text-[12px] font-bold transition-colors"
                        style={i === page ? { background: "rgba(57,255,136,0.12)", color: "#39ff88", border: "1px solid rgba(57,255,136,0.45)" } : { border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contenu du chapitre + commentaires */}
        <div className="px-4 py-6 md:px-6 md:py-8">
          {view.images.length === 0 ? (
            <div className="rounded-2xl border p-10 text-center text-[14px] text-[color:var(--color-text-secondary)]" style={{ borderColor: "var(--color-border-default)" }}>
              Aucune page validée avec image dans ce chapitre pour l'instant.
            </div>
          ) : mode === "vertical" ? (
            <div className="mx-auto flex max-w-[1000px] flex-col gap-2">
              {view.images.map((src, i) => (
                <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full rounded-xl border" style={{ borderColor: "var(--color-border-default)" }} />
              ))}
            </div>
          ) : (
            <div className="relative mx-auto w-full max-w-[1000px] select-none">
              <img
                src={view.images[page]}
                alt={`Page ${page + 1}`}
                className="mx-auto block w-auto max-w-full rounded-xl border"
                style={{ borderColor: "var(--color-border-default)", maxHeight: "82vh" }}
              />
              <button type="button" aria-label="Page précédente" onClick={goPrev} disabled={!canPrev} className="absolute inset-y-0 left-0 w-1/2 cursor-pointer disabled:cursor-default" />
              <button type="button" aria-label="Page suivante" onClick={goNext} disabled={!canNext} className="absolute inset-y-0 right-0 w-1/2 cursor-pointer disabled:cursor-default" />
            </div>
          )}

          <section className="mx-auto mt-8 max-w-[1000px] rounded-2xl p-6" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border-default)" }}>
            <h2 className="mb-4 font-display text-[18px] font-extrabold">Commentaires</h2>
            <CommentsPanel entityType="manga_chapter" entityId={`${view.projectId}:${view.chapterId}`} />
          </section>
        </div>
      </div>

      {/* Menu latéral droit : collé aux bords (comme la sidebar du site) */}
      <aside
        className="flex shrink-0 flex-col gap-6 border-t p-5 lg:sticky lg:top-0 lg:h-screen lg:w-[300px] lg:border-l lg:border-t-0"
        style={{ ...readerPanel, borderColor: "var(--color-border-default)" }}
      >
        {/* 1. Mode de lecture */}
        <div>
          <p className="meta-label mb-2">Mode de lecture</p>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--color-elevated, rgba(255,255,255,0.03))", border: "1px solid var(--color-border-default)" }} role="tablist" aria-label="Mode de lecture">
            {(["vertical", "pagination"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className="flex-1 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={mode === m ? { background: "rgba(57,255,136,0.12)", color: "#39ff88", border: "1px solid rgba(57,255,136,0.45)" } : { color: "var(--color-text-secondary)", border: "1px solid transparent" }}
              >
                {m === "vertical" ? "Scroll" : "Pagination"}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Bouton dropdown « Chapitre X ▼ » */}
        <div ref={chapterRef} className="relative">
          <button
            type="button"
            onClick={() => setChapterMenu((v) => !v)}
            aria-expanded={chapterMenu}
            className="flex h-11 w-full items-center justify-between rounded-xl border px-4 text-[14px] font-bold transition-colors"
            style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
          >
            <span>Chapitre {view.chapterNumber}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {chapterMenu && (
            <div
              className="absolute left-0 right-0 top-12 z-30 max-h-[50vh] overflow-y-auto rounded-xl border p-1.5 shadow-2xl"
              style={{ borderColor: "var(--color-border-strong, rgba(133,154,206,0.28))", background: "var(--color-panel)" }}
            >
              {view.chapters.map((c) => {
                const active = c.id === view.chapterId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goToChapter(c.id)}
                    className="block w-full truncate rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors"
                    style={active ? { background: "rgba(57,255,136,0.12)", color: "#39ff88" } : { color: "var(--color-text-secondary)" }}
                  >
                    Chapitre {c.number} — {c.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Navigation chapitres : < > puis « Dernier chapitre » */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              className="grid h-11 flex-1 place-items-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
              disabled={!view.prevChapterId}
              onClick={() => view.prevChapterId && goToChapter(view.prevChapterId)}
              aria-label="Chapitre précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              className="grid h-11 flex-1 place-items-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: "var(--color-border-default)", background: "var(--color-elevated, rgba(255,255,255,0.03))" }}
              disabled={!view.nextChapterId}
              onClick={() => view.nextChapterId && goToChapter(view.nextChapterId)}
              aria-label="Chapitre suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "rgba(57,255,136,0.12)", border: "1px solid rgba(57,255,136,0.45)", color: "#39ff88" }}
            disabled={!view.lastChapterId || view.lastChapterId === view.chapterId}
            onClick={() => view.lastChapterId && goToChapter(view.lastChapterId)}
          >
            <ArrowDown className="h-4 w-4" /> Dernier chapitre
          </button>
        </div>

        {/* 4. Note du chapitre — tout en bas du menu */}
        <div className="mt-auto">
          <p className="meta-label mb-2">Donnez nous votre note du chapitre</p>
          <StarRatingPicker value={rating} onRate={rate} />
          {rating > 0 && (
            <p className="mt-1.5 text-[12px] text-[color:var(--color-text-muted)]">Ta note : {rating}/5</p>
          )}
        </div>
      </aside>
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