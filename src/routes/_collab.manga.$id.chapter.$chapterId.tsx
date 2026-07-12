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

type LoaderData = {
  manga: Manga;
  chapter: Chapter;
  prev: Chapter | null;
  next: Chapter | null;
};

export const Route = createFileRoute("/_collab/manga/$id/chapter/$chapterId")({
  loader: ({ params }): LoaderData => {
    const data = getChapter(params.id, params.chapterId);
    if (!data) throw notFound();
    return data as LoaderData;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.chapter.title} — ${loaderData.manga.title}` },
          { name: "description", content: `Read ${loaderData.chapter.title} of ${loaderData.manga.title} on CollabManga.` },
          { property: "og:title", content: `${loaderData.chapter.title} — ${loaderData.manga.title}` },
          { property: "og:image", content: loaderData.manga.cover },
          { name: "twitter:image", content: loaderData.manga.cover },
        ]
      : [{ title: "Chapter not found — CollabManga" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: ChapterNotFound,
  component: ChapterReader,
});

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
  const { manga, chapter, prev, next } = Route.useLoaderData() as LoaderData;
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
                className="max-h-[78vh] w-auto max-w-full"
                style={{ borderRadius: 8, background: "var(--color-bg)" }}
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