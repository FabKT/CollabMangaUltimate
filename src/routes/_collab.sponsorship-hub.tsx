import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSponsorships, formatMoney, type SponsorshipStatus } from "../features/sponsorships/store";
import { StatusBadge } from "../features/sponsorships/ui";
import { SponsorshipModal } from "../features/sponsorships/SponsorshipModal";

export const Route = createFileRoute("/_collab/sponsorship-hub")({
  component: SponsorshipsListPage,
});

const FILTERS: { key: "all" | SponsorshipStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "activated", label: "Activated" },
  { key: "pending", label: "Pending" },
  { key: "finished", label: "Finished" },
  { key: "cancelled", label: "Cancelled" },
];

function SponsorshipsListPage() {
  const items = useSponsorships();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | SponsorshipStatus>("all");
  const [modal, setModal] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.project.toLowerCase().includes(term) ||
        s.creator.toLowerCase().includes(term) ||
        s.status.toLowerCase().includes(term)
      );
    });
  }, [items, q, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, activated: 0, pending: 0, finished: 0, cancelled: 0 };
    items.forEach((s) => { c[s.status]++; });
    return c;
  }, [items]);

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" /> CollabManga · Sponsorships
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-[34px]">My Sponsorships</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">
              Manage sponsorship collaborations, prices, services, platforms, delivery links, and statuses.
            </p>
          </div>
          <button
            onClick={() => setModal(true)}
            className="btn-neon inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add a sponsorship
          </button>
        </header>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by sponsorship, project, creator, or status…"
              aria-label="Search sponsorships"
              className="w-full rounded-xl border border-border bg-surface/70 pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:border-neon/50 focus:outline-none focus:ring-2 focus:ring-neon/25"
            />
          </div>
          <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible">
            <div role="tablist" aria-label="Filter by status" className="inline-flex rounded-xl border border-border bg-surface/60 p-1">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.key)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-neon-soft text-neon" : "text-text-secondary hover:text-foreground"}`}
                  >
                    {f.label}
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-neon/15 text-neon" : "bg-surface-3 text-text-muted"}`}>{counts[f.key] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List */}
        <section className="mt-5">
          {filtered.length === 0 ? (
            <EmptyState onCreate={() => setModal(true)} />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/70">
              {filtered.map((s) => (
                <li key={s.id} className="group">
                  <Link
                    to="/sponsorship-hub/$id"
                    params={{ id: s.id }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-[15px] font-semibold text-foreground">{s.name}</h3>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-text-muted sm:hidden">
                        <span className="truncate">{s.project} · {s.creator}</span>
                      </div>
                      <div className="mt-1 hidden text-xs text-text-muted sm:block">
                        {s.services.length} services · {s.paymentType.replace("_", " ")}{s.deadline ? ` · due ${s.deadline}` : ""}
                      </div>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <div className="text-[11px] uppercase tracking-wide text-text-muted">Project</div>
                      <div className="truncate text-sm text-text-secondary">{s.project}</div>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <div className="text-[11px] uppercase tracking-wide text-text-muted">Creator</div>
                      <div className="truncate text-sm text-text-secondary">{s.creator}</div>
                    </div>
                    <div className="hidden sm:block">
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex items-center gap-3 justify-self-end">
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wide text-text-muted">Total</div>
                        <div className="font-display text-sm font-semibold text-foreground">{formatMoney(s.totalPrice, s.currency)}</div>
                      </div>
                      <span className="hidden shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition group-hover:border-neon/50 group-hover:text-neon sm:inline">
                        View sponsorship →
                      </span>
                    </div>
                    <div className="col-span-2 sm:hidden">
                      <StatusBadge status={s.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <SponsorshipModal open={modal} onClose={() => setModal(false)} />
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-neon-soft text-neon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 7 9 18l-5-5"/></svg>
      </div>
      <h2 className="font-display text-lg font-semibold">No sponsorships yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-text-secondary">Create a sponsorship to manage a collaboration with a content creator or manga project.</p>
      <button onClick={onCreate} className="btn-neon mt-5 rounded-lg px-4 py-2 text-sm font-semibold">Add a sponsorship</button>
    </div>
  );
}
