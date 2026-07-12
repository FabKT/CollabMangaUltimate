import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { Manga } from "@/lib/manga-data";

export function MangaCard({ manga }: { manga: Manga }) {
  return (
    <article className="card-elevated group flex flex-col overflow-hidden hover:-translate-y-0.5 hover:border-[color:var(--color-border-strong)]">
      <Link
        to="/manga/$id"
        params={{ id: manga.id }}
        className="relative block aspect-[3/4] overflow-hidden rounded-t-[18px] bg-[color:var(--color-panel)]"
      >
        <img
          src={manga.cover}
          alt={`${manga.title} cover`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3">
          <span className={manga.status === "New" ? "chip-active" : "chip-neutral"}>
            {manga.status}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-[18px]">
        <div className="space-y-1">
          <h3 className="font-display text-[16px] font-extrabold leading-[22px] text-[color:var(--color-text-primary)] line-clamp-1">
            {manga.title}
          </h3>
          <p className="text-[13px] font-medium leading-5 text-[color:var(--color-text-muted)]">
            {manga.creator}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {manga.genres.slice(0, 2).map((g) => (
            <span key={g} className="chip-neutral">{g}</span>
          ))}
          {manga.genres.length > 2 && (
            <span className="chip-neutral">+{manga.genres.length - 2}</span>
          )}
        </div>

        <p className="text-[13px] leading-5 text-[color:var(--color-text-secondary)] line-clamp-2">
          Synopsis preview placeholder for this manga project.
        </p>

        <div className="mt-auto flex items-center justify-between pt-1 text-[12px] text-[color:var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Star width={14} height={14} style={{ color: "var(--color-star)" }} fill="currentColor" />
            Average rating
          </span>
          <span>{manga.chapterCount} chapters</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Link
            to="/manga/$id/chapter/$chapterId"
            params={{ id: manga.id, chapterId: manga.chapters[0]?.id ?? "ch-1" }}
            className="btn-primary flex-1"
          >
            Read
          </Link>
          <Link to="/manga/$id" params={{ id: manga.id }} className="btn-secondary flex-1">
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}