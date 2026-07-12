import { Link } from "@tanstack/react-router";
import { MessageSquare, Star, FileText } from "lucide-react";
import type { Chapter } from "@/lib/manga-data";

export function ChapterRow({
  mangaId,
  chapter,
  active,
}: {
  mangaId: string;
  chapter: Chapter;
  active?: boolean;
}) {
  const latest = chapter.status === "Latest";
  return (
    <div
      className="card-elevated flex flex-col gap-3 p-4 hover:border-[rgba(133,154,206,0.34)] md:flex-row md:items-center md:justify-between"
      style={
        latest || active
          ? { borderColor: "var(--color-neon-border)", boxShadow: "0 0 0 1px rgba(57,255,136,0.10)" }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold"
          style={{
            background: latest ? "var(--color-neon-fill)" : "var(--color-input-bg)",
            color: latest ? "var(--color-neon)" : "var(--color-text-secondary)",
            border: latest ? "1px solid var(--color-neon-border)" : "1px solid var(--color-border-default)",
          }}
        >
          {String(chapter.number).padStart(2, "0")}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[16px] font-extrabold leading-[22px] text-[color:var(--color-text-primary)]">
              {chapter.title}
            </h3>
            {latest && <span className="chip-active">Latest</span>}
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-secondary)] line-clamp-1">
            {chapter.note}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
            <span>{chapter.published}</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> {chapter.pages} pages
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5" style={{ color: "var(--color-star)" }} fill="currentColor" />
              Average rating
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:pl-4">
        <Link
          to="/manga/$id/chapter/$chapterId"
          params={{ id: mangaId, chapterId: chapter.id }}
          className={latest ? "btn-primary" : "btn-secondary"}
        >
          Read Chapter
        </Link>
      </div>
    </div>
  );
}