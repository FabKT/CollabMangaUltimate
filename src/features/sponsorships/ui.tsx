import { useEffect, useRef, type ReactNode } from "react";
import { STATUS_META, type SponsorshipStatus } from "./store";

export function StatusBadge({ status, size = "sm" }: { status: SponsorshipStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  const py = size === "md" ? "py-1" : "py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 ${py} text-xs font-semibold`}
      style={{ background: m.bg, color: m.color, boxShadow: `inset 0 0 0 1px ${m.ring}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusable = () => Array.from(el?.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter(x => !x.hasAttribute("disabled"));
    setTimeout(() => focusable()[0]?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") {
        const items = focusable();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const w = size === "lg" ? "max-w-3xl" : "max-w-xl";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#020616]/80 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className={`relative w-full ${w} rounded-2xl border border-border bg-surface-2 shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-3 hover:text-foreground focus-visible:outline-2 focus-visible:outline-neon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-text-secondary">
        {label}{required && <span className="ml-1 text-neon">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-border bg-[var(--input)] px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-neon/50 focus:outline-none focus:ring-2 focus:ring-neon/30";

export function PlatformIcon({ p, className = "h-3.5 w-3.5" }: { p: string; className?: string }) {
  const map: Record<string, string> = {
    TikTok: "TT",
    YouTube: "YT",
    Instagram: "IG",
    "Twitter/X": "X",
    Other: "•",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] font-bold text-text-secondary ${className}`} style={{ minWidth: 22 }}>
      {map[p] ?? p}
    </span>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-border" />;
}