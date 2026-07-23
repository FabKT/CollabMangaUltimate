import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/lib/sponsorship-data";
import { showDuration } from "@/lib/sponsorship-data";
import {
  btnPrimary,
  btnInfo,
  Chip,
  metaLabel,
  PlatformChip,
  StatusChip,
  Thumb,
} from "./ui";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={metaLabel}>{label}</p>
      <p className="mt-0.5 truncate font-manrope text-[13px] font-medium text-cm-text2">{value}</p>
    </div>
  );
}

export function AnnouncementCard({
  a,
  saved,
  onToggleSave,
  onViewDetails,
  onContact,
}: {
  a: Announcement;
  saved: boolean;
  onToggleSave: () => void;
  onViewDetails: () => void;
  onContact: () => void;
}) {
  const isProject = a.mode === "project";
  return (
    <article
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onViewDetails();
      }}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-[rgba(133,154,206,0.18)] bg-cm-card shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(133,154,206,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cm-neon/40"
    >
      {a.mode === "creator" ? (
        <CreatorHero announcement={a} />
      ) : (
        <Thumb accent={a.accent} label={a.category || a.sponsorshipType} className="aspect-video" platforms={a.platforms} />
      )}

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* identity */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-manrope text-[16px] font-extrabold leading-[22px] text-cm-text">
              {a.title}
            </h3>
            <button
              type="button"
              onClick={onToggleSave}
              aria-label={saved ? "Remove bookmark" : "Save announcement"}
              aria-pressed={saved}
              className={cn(
                "shrink-0 rounded-[10px] p-1.5 transition-colors",
                saved ? "text-cm-neon" : "text-cm-muted hover:text-cm-text",
              )}
            >
              <Bookmark className="h-5 w-5" fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="mt-2.5 line-clamp-2 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
            {a.shortDescription}
          </p>
        </div>

        {/* price + platforms */}
        <div className="rounded-[14px] border border-[rgba(133,154,206,0.18)] bg-cm-details p-4">
          <p className={metaLabel}>{a.priceLabel}</p>
          <p className="mt-0.5 font-sora text-[24px] font-extrabold leading-[30px] text-cm-neon">
            {a.price ?? (isProject ? "Collaboration" : "Price to define")}
          </p>
          <p className={cn(metaLabel, "mt-3")}>Platforms</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {a.platforms.slice(0, 3).map((p) => (
              <PlatformChip key={p} platform={p} />
            ))}
            {a.platforms.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-cm-input px-3 py-1 font-manrope text-[13px] font-medium text-cm-muted">
                + {a.platforms.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* essential metadata */}
        <div className="grid grid-cols-2 gap-3">
          <MetaItem label="Sponsorship" value={a.sponsorshipType} />
          {isProject ? (
            <MetaItem label="Genre" value={a.category} />
          ) : a.videoType ? (
            <MetaItem label="Video type" value={a.videoType} />
          ) : (
            <MetaItem label="Payment" value={a.paymentMode} />
          )}
          {showDuration(a) && <MetaItem label="Duration" value={a.duration!} />}
          <MetaItem label="Disponibilité" value={a.status === "closing" ? "Unavailable" : "Available"} />
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center gap-3 pt-1">
          <button type="button" onClick={onViewDetails} className={cn(btnInfo, "flex-1")}>
            View Details
          </button>
          <button type="button" onClick={onContact} className={cn(btnPrimary, "flex-1")}>
            {isProject ? "Apply" : "Contact"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CreatorHero({ announcement }: { announcement: Announcement }) {
  const initials = announcement.ownerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CM";

  return (
    <div className="relative aspect-video overflow-hidden bg-cm-details">
      {announcement.ownerBannerUrl ? (
        <img src={announcement.ownerBannerUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 120% at 15% 10%, color-mix(in oklab, ${announcement.accent} 22%, transparent), transparent 55%), linear-gradient(135deg, #0a1330, #060d22)`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-[#050b1d]/35" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-cm-neon bg-cm-panel shadow-[0_14px_36px_rgba(0,0,0,0.38)]">
          {announcement.ownerAvatarUrl ? (
            <img src={announcement.ownerAvatarUrl} alt={announcement.ownerName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="font-sora text-[22px] font-extrabold text-cm-neon">{initials}</span>
          )}
        </div>
      </div>
      {announcement.platforms.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          {announcement.platforms.slice(0, 3).map((platform) => (
            <PlatformChip key={platform} platform={platform} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[rgba(133,154,206,0.18)] bg-cm-card">
      <div className="aspect-video w-full animate-pulse bg-cm-details" />
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-cm-details" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-cm-details" />
          <div className="h-3 w-full animate-pulse rounded bg-cm-details" />
        </div>
        <div className="h-24 w-full animate-pulse rounded-[14px] bg-cm-details" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-8 animate-pulse rounded bg-cm-details" />
          <div className="h-8 animate-pulse rounded bg-cm-details" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 flex-1 animate-pulse rounded-[14px] bg-cm-details" />
          <div className="h-11 flex-1 animate-pulse rounded-[14px] bg-cm-details" />
        </div>
      </div>
    </div>
  );
}
