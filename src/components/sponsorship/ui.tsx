import * as React from "react";
import { Youtube, Instagram, Twitch, Twitter, Music2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/sponsorship-data";

/* Button classes built from the CollabManga design system */
export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-cm-neon px-[18px] font-manrope text-[14px] font-bold text-[#04111e] transition-colors hover:bg-cm-neon-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cm-neon/60 disabled:opacity-50";

export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-cm-card px-[18px] font-manrope text-[14px] font-bold text-cm-text transition-colors border border-[rgba(133,154,206,0.28)] hover:bg-white/[0.04] hover:border-[rgba(133,154,206,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(133,154,206,0.40)]";

/* Info / secondary-action button — filled light blue to contrast with the dark surface */
export const btnInfo =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[rgba(117,167,255,0.16)] px-[18px] font-manrope text-[14px] font-bold text-cm-info transition-colors border border-[rgba(117,167,255,0.45)] hover:bg-[rgba(117,167,255,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(117,167,255,0.5)]";

export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-[18px] font-manrope text-[14px] font-bold text-cm-text2 transition-colors hover:text-cm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(133,154,206,0.40)]";

export const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-cm-card border border-[rgba(133,154,206,0.18)] text-cm-text2 transition-colors hover:text-cm-text hover:border-[rgba(133,154,206,0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(133,154,206,0.40)]";

export const inputCls =
  "h-11 w-full rounded-[14px] bg-cm-input px-[14px] font-manrope text-[14px] font-medium text-cm-text placeholder:text-cm-muted border border-[rgba(133,154,206,0.20)] outline-none transition-shadow focus:border-cm-neon focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]";

export const metaLabel =
  "font-manrope text-[11px] font-extrabold uppercase tracking-[0.06em] text-cm-muted";

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const c = cn("h-3.5 w-3.5", className);
  switch (platform) {
    case "YouTube":
      return <Youtube className={c} aria-hidden />;
    case "TikTok":
      return <Music2 className={c} aria-hidden />;
    case "Instagram":
      return <Instagram className={c} aria-hidden />;
    case "Twitter / X":
      return <Twitter className={c} aria-hidden />;
    case "Twitch":
      return <Twitch className={c} aria-hidden />;
    default:
      return <Globe className={c} aria-hidden />;
  }
}

export function PlatformChip({
  platform,
  active,
  onClick,
  as = "span",
}: {
  platform: Platform;
  active?: boolean;
  onClick?: () => void;
  as?: "button" | "span";
}) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-manrope text-[13px] font-medium transition-colors whitespace-nowrap",
    active
      ? "bg-cm-neon border border-transparent text-[#04111e] font-bold shadow-[0_4px_14px_rgba(57,255,136,0.28)]"
      : "bg-cm-input border border-[rgba(133,154,206,0.18)] text-cm-text2",
    onClick && !active && "hover:border-[rgba(133,154,206,0.40)]",
  );
  if (as === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={`Platform ${platform}${active ? ", selected" : ""}`}
        className={cn(cls, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cm-neon/50")}
      >
        <PlatformIcon platform={platform} />
        {platform}
        {active && <span className="sr-only">(selected)</span>}
      </button>
    );
  }
  return (
    <span className={cls}>
      <PlatformIcon platform={platform} />
      {platform}
    </span>
  );
}

export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "neon" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-manrope text-[13px] font-medium",
        tone === "neon"
          ? "bg-[rgba(57,255,136,0.12)] border border-[rgba(57,255,136,0.45)] text-cm-neon"
          : "bg-cm-input border border-[rgba(133,154,206,0.18)] text-cm-text2",
      )}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: "open" | "urgent" | "closing" }) {
  const map = {
    open: { label: "Open", color: "#39ff88" },
    urgent: { label: "Urgent", color: "#ffb84d" },
    closing: { label: "Closing soon", color: "#ff5f7e" },
  } as const;
  const { label, color } = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-manrope text-[13px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

/** Disponibilité binaire pour les annonces de parrainage. */
export function AvailabilityChip({ available }: { available: boolean }) {
  const color = available ? "#39ff88" : "#7f8cb3";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-manrope text-[13px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 45%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

export function Thumb({
  accent,
  label,
  className,
  platforms,
}: {
  accent: string;
  label: string;
  className?: string;
  platforms?: Platform[];
}) {
  return (
    <div
      className={cn("relative w-full overflow-hidden bg-cm-details", className)}
      style={{
        background: `radial-gradient(120% 120% at 15% 10%, color-mix(in oklab, ${accent} 22%, transparent), transparent 55%), linear-gradient(135deg, #0a1330, #060d22)`,
      }}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-sora text-[13px] font-extrabold uppercase tracking-[0.14em] text-cm-muted">
          {label}
        </span>
      </div>
      {platforms && platforms.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          {platforms.slice(0, 3).map((p) => (
            <span
              key={p}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#050b1d]/70 text-cm-text2 backdrop-blur"
            >
              <PlatformIcon platform={p} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
