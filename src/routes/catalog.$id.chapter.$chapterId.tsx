import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { IntroHeader } from "@/components/intro/IntroHeader";
import { C, manrope, sora } from "@/components/intro/intro-theme";
import { loadPublicChapter } from "@/lib/public-manga";

type PublicChapterView = Awaited<ReturnType<typeof loadPublicChapter>>;

export const Route = createFileRoute("/catalog/$id/chapter/$chapterId")({
  loader: ({ params }) => params,
  head: () => ({ meta: [{ title: "Chapter - CollabManga" }] }),
  component: PublicChapterPage,
});

function PublicChapterPage() {
  const { id, chapterId } = Route.useLoaderData();
  const [view, setView] = useState<PublicChapterView | "loading">("loading");

  useEffect(() => {
    void loadPublicChapter(id, chapterId).then(setView).catch(() => setView(null));
  }, [id, chapterId]);

  return (
    <div style={{ ...manrope, minHeight: "100vh", background: C.bg, color: C.text }}>
      <IntroHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {view === "loading" ? (
          <p style={{ color: C.text2 }}>Loading...</p>
        ) : !view ? (
          <section className="rounded-xl border border-border bg-card p-10 text-center">
            <h1 style={{ ...sora, fontSize: 28 }}>Chapter unavailable</h1>
            <Link to="/catalog/$id" params={{ id }} className="intro-btn-outline">Back to manga</Link>
          </section>
        ) : (
          <>
            <header className="sticky top-20 z-20 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/95 px-4 py-3 backdrop-blur">
              <Link to="/catalog/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                <ArrowLeft className="h-4 w-4" /> {view.manga.title}
              </Link>
              <span className="text-sm font-semibold text-secondary-foreground">Chapter {view.chapter.number} - {view.chapter.title}</span>
            </header>

            {view.images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-secondary-foreground">This chapter has no validated page yet.</div>
            ) : (
              <div className="mx-auto flex max-w-[1000px] flex-col gap-2">
                {view.images.map((image, index) => (
                  <img key={`${image.slice(0, 32)}-${index}`} src={image} alt={`Page ${index + 1}`} className="w-full rounded-lg border border-border" />
                ))}
              </div>
            )}

            <nav className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
              {view.previousId ? (
                <Link to="/catalog/$id/chapter/$chapterId" params={{ id, chapterId: view.previousId }} className="intro-btn-outline inline-flex items-center gap-2"><ChevronLeft size={16} /> Previous</Link>
              ) : <span />}
              {view.nextId && (
                <Link to="/catalog/$id/chapter/$chapterId" params={{ id, chapterId: view.nextId }} className="intro-btn-outline inline-flex items-center gap-2">Next <ChevronRight size={16} /></Link>
              )}
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
