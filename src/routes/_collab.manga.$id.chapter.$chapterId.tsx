import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import { getChapterRating, rateChapter } from "@/lib/manga-ratings";

type Mode = "vertical" | "pagination";

export const Route = createFileRoute("/_collab/manga/$id/chapter/$chapterId")({
  loader: ({ params }) => ({ id: params.id, chapterId: params.chapterId }),
  head: () => ({ meta: [{ title: "Chapitre — CollabManga" }] }),
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
  const { id, chapterId } = Route.useLoaderData() as { id: string; chapterId: string };
  const [studio, setStudio] = useState<StudioChapterView | null | "loading">("loading");

  useEffect(() => {
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
  }, [id, chapterId]);

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

