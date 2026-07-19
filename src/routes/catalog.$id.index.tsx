import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { IntroHeader } from "@/components/intro/IntroHeader";
import { C, manrope, sora } from "@/components/intro/intro-theme";
import { loadPublicManga, type PublicManga } from "@/lib/public-manga";

export const Route = createFileRoute("/catalog/$id/")({
  loader: ({ params }) => ({ id: params.id }),
  head: () => ({ meta: [{ title: "Manga - CollabManga" }] }),
  component: PublicMangaPage,
});

function PublicMangaPage() {
  const { id } = Route.useLoaderData();
  const [manga, setManga] = useState<PublicManga | null | "loading">("loading");

  useEffect(() => {
    void loadPublicManga(id)
      .then(setManga)
      .catch(() => setManga(null));
  }, [id]);

  return (
    <div style={{ ...manrope, minHeight: "100vh", background: C.bg, color: C.text }}>
      <IntroHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <a
          href="/#catalog"
          className="intro-btn-ghost mb-6 inline-flex items-center gap-2"
          style={{ ...manrope, textDecoration: "none" }}
        >
          <ArrowLeft size={16} /> Back to catalog
        </a>

        {manga === "loading" ? (
          <p style={{ color: C.text2 }}>Loading...</p>
        ) : !manga ? (
          <section className="rounded-xl border border-border bg-card p-10 text-center">
            <h1 style={{ ...sora, fontSize: 28 }}>Manga unavailable</h1>
            <p style={{ color: C.text2 }}>This manga is not published in the public catalog.</p>
          </section>
        ) : (
          <>
            <section className="grid gap-8 rounded-xl border border-border bg-card p-6 md:grid-cols-[240px_1fr] md:p-8">
              <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface">
                {manga.cover ? (
                  <img
                    src={manga.cover}
                    alt={`${manga.title} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm font-bold text-muted-foreground">
                    Cover pending
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip chip-primary">{manga.status}</span>
                  <span className="chip">{manga.language}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <h1 style={{ ...sora, margin: 0, fontSize: 36, fontWeight: 800 }}>
                    {manga.title}
                  </h1>
                  {manga.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold">
                      <Star className="h-4 w-4 fill-[var(--star)] text-[var(--star)]" />{" "}
                      {manga.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">By {manga.creator}</p>
                <p className="mt-5 max-w-3xl text-[15px] leading-7 text-secondary-foreground">
                  {manga.synopsis}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="chip chip-primary">{manga.demographic}</span>
                  {[...manga.genres, ...manga.subgenres]
                    .filter((value, index, list) => list.indexOf(value) === index)
                    .map((genre) => (
                      <span key={genre} className="chip">
                        {genre}
                      </span>
                    ))}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 style={{ ...sora, margin: 0, fontSize: 24 }}>Chapters</h2>
              </div>
              {manga.chaptersList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-secondary-foreground">
                  No published chapter yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {manga.chaptersList.map((chapter) => (
                    <Link
                      key={chapter.id}
                      to="/catalog/$id/chapter/$chapterId"
                      params={{ id: manga.id, chapterId: chapter.id }}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-foreground transition-colors hover:border-primary/50"
                    >
                      <span className="font-bold">
                        Chapter {chapter.number} - {chapter.title}
                      </span>
                      <span className="text-xs font-semibold text-primary">Read</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
