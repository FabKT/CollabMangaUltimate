import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CatalogManga } from "@/lib/haven-data";
import { localizeLabel, useI18n } from "@/lib/i18n";

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 shrink-0 fill-[var(--star)] text-[var(--star)]" />
      <span className="text-xs font-semibold text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export function MangaCard({
  manga,
  variant = "default",
  publicMode = false,
}: {
  manga: CatalogManga;
  variant?: "default" | "editorial";
  publicMode?: boolean;
}) {
  const { locale, t } = useI18n();
  const editorial = variant === "editorial";
  const card = (
    <article className="card-manga group flex h-full flex-col">
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={manga.cover}
          alt={`${manga.title} cover`}
          loading="lazy"
          decoding="async"
          width={800}
          height={1200}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-deep)] via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {editorial && <span className="chip chip-primary">Hidden Gem</span>}
          <span className="chip">{localizeLabel(manga.demographic, locale)}</span>
        </div>
        <div className="absolute right-3 top-3">
          <span className="chip bg-background/70 backdrop-blur">
            {localizeLabel(manga.status, locale)}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-foreground">
              {manga.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {t("catalog.by")} {manga.creator}
            </p>
          </div>
          <Rating value={manga.rating} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {manga.genres.slice(0, 3).map((g) => (
            <span key={g} className="chip">
              {localizeLabel(g, locale)}
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-secondary-foreground">
          {manga.synopsis}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {manga.chapters} {t("catalog.chapters").toLowerCase()}
          </span>
          <span className="btn-primary !px-3 !py-2 !text-xs">
            {editorial ? t("catalog.discover") : t("catalog.view")}
          </span>
        </div>
      </div>
    </article>
  );

  return publicMode ? (
    <Link to="/catalog/$id" params={{ id: manga.id }} className="block h-full">
      {card}
    </Link>
  ) : (
    <Link to="/manga/$id" params={{ id: manga.id }} className="block h-full">
      {card}
    </Link>
  );
}
