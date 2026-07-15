import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  useSponsorship,
  updateSponsorship,
  deleteSponsorship,
  removeService,
  formatMoney,
  PAYMENT_LABEL,
  STATUS_META,
  type Service,
  type SponsorshipStatus,
} from "../features/sponsorships/store";
import { StatusBadge, PlatformIcon, Divider } from "../features/sponsorships/ui";
import { ServiceModal } from "../features/sponsorships/ServiceModal";

export const Route = createFileRoute("/_collab/sponsorship-hub_/$id")({
  component: SponsorshipDetailPage,
});

function SponsorshipDetailPage() {
  const { id } = Route.useParams();
  const s = useSponsorship(id);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [serviceModal, setServiceModal] = useState<{ open: boolean; initial?: Service }>({ open: false });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) { setMenuOpen(false); setStatusOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!s) {
    return (
      <main className="min-h-dvh">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">Sponsorship not found</h1>
          <p className="mt-2 text-sm text-text-secondary">It may have been deleted or the link is incorrect.</p>
          <Link to="/sponsorship-hub" className="btn-neon mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold">Back to sponsorships</Link>
        </div>
      </main>
    );
  }

  const servicesTotal = s.services.reduce((sum, x) => sum + x.price, 0);
  const linkedCount = s.services.filter((x) => x.deliveryLink).length;

  const setStatus = (st: SponsorshipStatus) => { updateSponsorship(s.id, { status: st }); setMenuOpen(false); setStatusOpen(false); };
  const onDelete = () => {
    if (confirm(`Delete "${s.name}"? This cannot be undone.`)) {
      deleteSponsorship(s.id);
      navigate({ to: "/sponsorship-hub" });
    }
  };

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            to="/sponsorship-hub"
            aria-label="Back to sponsorships"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/70 text-text-secondary transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-neon"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{s.name}</h1>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span>Project · <span className="text-text-secondary">{s.project}</span></span>
              <span className="hidden h-1 w-1 rounded-full bg-text-muted sm:inline-block" />
              <span>Creator · <span className="text-text-secondary">{s.creator}</span></span>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setStatusOpen(false); }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/70 text-text-secondary transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-neon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl">
                <MenuItem label="Edit sponsorship" onClick={() => { setMenuOpen(false); alert("Open sponsorship editor (demo)."); }} />
                <div className="relative">
                  <MenuItem
                    label="Change status"
                    chevron
                    onClick={() => setStatusOpen((v) => !v)}
                  />
                  {statusOpen && (
                    <div className="border-t border-border bg-[var(--deep)]/60 px-1 py-1">
                      {(Object.keys(STATUS_META) as SponsorshipStatus[]).map((st) => (
                        <button
                          key={st}
                          role="menuitem"
                          onClick={() => setStatus(st)}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${s.status === st ? "text-neon" : "text-text-secondary"}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[st].color }} />
                          {STATUS_META[st].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <MenuItem label="Mark as activated" onClick={() => setStatus("activated")} />
                <MenuItem label="Mark as finished" onClick={() => setStatus("finished")} />
                <MenuItem label="Cancel sponsorship" onClick={() => setStatus("cancelled")} />
                <div className="border-t border-border" />
                <MenuItem label="Archive sponsorship" onClick={() => { setMenuOpen(false); alert("Archived (demo)."); }} />
                <MenuItem label="Delete sponsorship" danger onClick={onDelete} />
              </div>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <section className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface/70 p-2 sm:grid-cols-6">
          <Summary label="Total price" value={formatMoney(s.totalPrice, s.currency)} highlight />
          {/* Abonnement : montant versé chaque mois (le total = mensuel × durée). */}
          <Summary
            label="Paiement mensuel"
            value={s.paymentType === "subscription" ? formatMoney(servicesTotal, s.currency) : "—"}
          />
          <Summary label="Project" value={s.project} />
          <Summary label="Creator" value={s.creator} />
          <Summary label="Payment" value={PAYMENT_LABEL[s.paymentType]} />
          <Summary label="Deadline" value={s.deadline ?? "—"} />
        </section>

        {/* Services */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/70">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">Services</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {s.services.length} services · {linkedCount}/{s.services.length} delivery links added
              </p>
            </div>
            <button
              onClick={() => setServiceModal({ open: true })}
              className="btn-neon inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add service
            </button>
          </div>

          {s.services.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-text-secondary">No services yet.</p>
              <button onClick={() => setServiceModal({ open: true })} className="btn-neon mt-4 rounded-lg px-3 py-2 text-xs font-semibold">Add first service</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-text-muted">
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left font-semibold">Service</th>
                      <th className="px-3 py-3 text-left font-semibold">Platforms</th>
                      <th className="px-3 py-3 text-left font-semibold">Qty</th>
                      <th className="px-3 py-3 text-left font-semibold">Price</th>
                      <th className="px-3 py-3 text-left font-semibold">Payment</th>
                      <th className="px-3 py-3 text-left font-semibold">Delivery</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.services.map((sv) => (
                      <tr key={sv.id} className="border-b border-border/70 last:border-b-0 hover:bg-surface-2/50">
                        <td className="px-5 py-3">
                          <div className="font-medium text-foreground">{sv.name}</div>
                          <div className="text-xs text-text-muted">{sv.format} · {sv.duration}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {sv.platforms.length === 0 && <span className="text-xs text-text-muted">—</span>}
                            {sv.platforms.map((p) => <PlatformIcon key={p} p={p} />)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-text-secondary">×{sv.quantity}</td>
                        <td className="px-3 py-3 font-display font-semibold text-foreground">{formatMoney(sv.price, s.currency)}</td>
                        <td className="px-3 py-3"><PaymentBadge type={sv.paymentType} /></td>
                        <td className="px-3 py-3"><DeliveryCell link={sv.deliveryLink} /></td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => setServiceModal({ open: true, initial: sv })}
                              className="rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-neon/50 hover:text-neon"
                              aria-label={`Edit ${sv.name}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => confirm(`Remove "${sv.name}"?`) && removeService(s.id, sv.id)}
                              className="rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-danger/50 hover:text-danger"
                              aria-label={`Remove ${sv.name}`}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-border md:hidden">
                {s.services.map((sv) => (
                  <li key={sv.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{sv.name}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{sv.format} · {sv.duration} · ×{sv.quantity}</div>
                      </div>
                      <div className="font-display text-sm font-semibold">{formatMoney(sv.price, s.currency)}</div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {sv.platforms.map((p) => <PlatformIcon key={p} p={p} />)}
                      <PaymentBadge type={sv.paymentType} />
                      <DeliveryCell link={sv.deliveryLink} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setServiceModal({ open: true, initial: sv })}
                        className="flex-1 rounded-md border border-border bg-surface-3 py-2 text-xs font-semibold text-text-secondary hover:border-neon/50 hover:text-neon"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm(`Remove "${sv.name}"?`) && removeService(s.id, sv.id)}
                        className="flex-1 rounded-md border border-border bg-surface-3 py-2 text-xs font-semibold text-text-muted hover:border-danger/50 hover:text-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Two-column non-fixed grid: conditions + participants */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface/70">
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <h2 className="font-display text-base font-semibold">Delivery conditions</h2>
              <p className="mt-0.5 text-xs text-text-muted">Requirements, deliverables, deadlines, and notes.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <Info label="Deadline" value={s.deadline ?? "—"} />
              <Info label="Payment type" value={PAYMENT_LABEL[s.paymentType]} />
              <Info label="Currency" value={s.currency} />
              <Info label="Created" value={s.createdAt} />
              <div className="sm:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">Conditions</div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {s.conditions ?? "No conditions provided. Add deliverables, deadlines, publication rules, or cancellation terms."}
                </p>
              </div>
              {s.notes && (
                <div className="sm:col-span-2">
                  <Divider />
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-text-muted">Internal notes</div>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{s.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/70">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-display text-base font-semibold">Participants &amp; linked entities</h2>
                <p className="mt-0.5 text-xs text-text-muted">People and entities linked to this sponsorship.</p>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {s.participants.length === 0 && <li className="px-5 py-6 text-sm text-text-muted">No participants linked.</li>}
              {s.participants.map((p) => (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-3 font-display text-sm font-bold text-neon">
                    {p.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{p.name}</span>
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{roleLabel(p.role)}</span>
                    </div>
                    {p.meta && <div className="mt-0.5 truncate text-xs text-text-muted">{p.meta}</div>}
                  </div>
                  {p.role === "owner" ? (
                    <button className="shrink-0 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-neon/50 hover:text-neon">
                      View project
                    </button>
                  ) : (
                    <Link
                      to="/profile/$profileId"
                      params={{ profileId: p.id }}
                      className="shrink-0 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-neon/50 hover:text-neon"
                    >
                      View profile
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <ServiceModal
        open={serviceModal.open}
        onClose={() => setServiceModal({ open: false })}
        sponsorshipId={s.id}
        initial={serviceModal.initial}
      />
    </main>
  );
}

function roleLabel(r: string) {
  return r === "creator" ? "Creator" : r === "owner" ? "Project" : r === "manager" ? "Manager" : "Collaborator";
}

function MenuItem({ label, onClick, danger, chevron }: { label: string; onClick: () => void; danger?: boolean; chevron?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-surface-3 ${danger ? "text-danger" : "text-text-secondary hover:text-foreground"}`}
    >
      <span>{label}</span>
      {chevron && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>}
    </button>
  );
}

function Summary({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${highlight ? "bg-neon-soft" : "bg-surface-2/60"}`}>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-0.5 truncate font-display text-sm font-semibold ${highlight ? "text-neon" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text-secondary">{value}</div>
    </div>
  );
}

function PaymentBadge({ type }: { type: keyof typeof PAYMENT_LABEL }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
      {PAYMENT_LABEL[type]}
    </span>
  );
}

function DeliveryCell({ link }: { link?: string }) {
  if (!link) return <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-text-muted" />No link yet</span>;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-neon hover:text-neon-hover focus-visible:outline-2 focus-visible:outline-neon">
      <span className="h-1.5 w-1.5 rounded-full bg-neon" />
      Open link
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
    </a>
  );
}
