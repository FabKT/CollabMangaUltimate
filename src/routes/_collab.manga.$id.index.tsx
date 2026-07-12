import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Play, Plus, Star, ArrowLeft, Search } from "lucide-react";
import { getManga, MANGA_LIST, type Chapter, type Manga } from "@/lib/manga-data";
import { ChapterRow } from "@/components/manga/ChapterRow";
import { MangaCard } from "@/components/manga/MangaCard";

export const Route = createFileRoute("/_collab/manga/$id/")({
  loader: ({ params }) => {
    const manga = getManga(params.id);
    if (!manga) throw notFound();
    return { manga: manga as Manga };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.manga.title} — CollabManga` },
          { name: "description", content: `${loaderData.manga.title} on CollabManga. Read the latest chapters, synopsis, and reader reviews.` },
          { property: "og:title", content: `${loaderData.manga.title} — CollabManga` },
          { property: "og:description", content: "Published manga on CollabManga." },
          { property: "og:image", content: loaderData.manga.cover },
          { name: "twitter:image", content: loaderData.manga.cover },
        ]
      : [{ title: "Manga not found — CollabManga" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: NotFound,
  component: MangaDetail,
});

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
  const [followed, setFollowed] = useState(false);
  const [saved, setSaved] = useState(false);

  const chapters = manga.chapters.filter((c: Chapter) =>
    chapterQuery.trim()
      ? c.title.toLowerCase().includes(chapterQuery.toLowerCase()) ||
        String(c.number).includes(chapterQuery)
      : true,
  );
  const sorted = chapterSort === "Newest first" ? [...chapters].reverse() : chapters;

  const firstChapterId = manga.chapters[0]?.id ?? "ch-1";
  const latestChapterId = manga.chapters[manga.chapters.length - 1]?.id ?? firstChapterId;

  const related = MANGA_LIST.filter((m) => m.id !== manga.id).slice(0, 4);

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
            <h1 className="mt-3 font-display text-[28px] font-extrabold leading-[36px] md:text-[34px] md:leading-[42px]">
              {manga.title}
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
              by <span className="text-[color:var(--color-text-secondary)]">{manga.creator}</span>
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {manga.genres.map((g: string) => (
                <span key={g} className="chip-neutral">{g}</span>
              ))}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { l: "Status", v: manga.status },
                { l: "Chapters", v: `${manga.chapterCount}` },
                { l: "Rating", v: "Average rating" },
                { l: "Language", v: manga.language },
                { l: "Updated", v: manga.updated },
                { l: "Creator", v: manga.creator },
              ].map((m) => (
                <div key={m.l}>
                  <dt className="meta-label">{m.l}</dt>
                  <dd className="mt-1 text-[14px] font-bold text-[color:var(--color-text-primary)] line-clamp-1">
                    {m.v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/manga/$id/chapter/$chapterId"
                params={{ id: manga.id, chapterId: firstChapterId }}
                className="btn-primary"
              >
                <Play className="h-4 w-4" fill="currentColor" /> Start Reading
              </Link>
              <Link
                to="/manga/$id/chapter/$chapterId"
                params={{ id: manga.id, chapterId: latestChapterId }}
                className="btn-secondary"
              >
                Continue Reading
              </Link>
              <button
                type="button"
                onClick={() => setFollowed((v) => !v)}
                className="btn-secondary"
                aria-pressed={followed}
                style={followed ? { color: "var(--color-neon)", borderColor: "var(--color-neon-border)" } : undefined}
              >
                <Plus className="h-4 w-4" /> {followed ? "Following" : "Follow"}
              </button>
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

        <div className="mt-8">
          <h2 className="font-display text-[20px] font-bold leading-7">Synopsis</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-[25px] text-[color:var(--color-text-secondary)]">
            {manga.synopsis}
          </p>
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
              <p className="text-[13px] text-[color:var(--color-text-muted)]">Creator name placeholder</p>
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
              <p className="font-display text-[22px] font-extrabold">No rating yet</p>
              <p className="text-[13px] text-[color:var(--color-text-muted)]">Based on reader ratings</p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-[22px] text-[color:var(--color-text-secondary)]">
            Reader review preview placeholder. Once readers rate chapters, top reviews will appear here.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-5 font-display text-[20px] font-bold leading-7">Related manga</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((m) => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      </section>
    </div>
  );
}