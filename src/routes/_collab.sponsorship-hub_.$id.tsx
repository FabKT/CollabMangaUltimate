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
import { loadStudioProjects } from "@/lib/studio-projects";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_collab/sponsorship-hub_/$id")({
  component: SponsorshipDetailPage,
});

const STATUS_KEY: Record<SponsorshipStatus, TranslationKey> = {
  activated: "sponsorStatus.activated",
  pending: "sponsorStatus.pending",
  finished: "sponsorStatus.finished",
  cancelled: "sponsorStatus.cancelled",
};
function roleKey(r: string): TranslationKey {
  return r === "creator" ? "sponsorRole.creator" : r === "owner" ? "sponsorRole.project" : r === "manager" ? "sponsorRole.manager" : "sponsorRole.collaborator";
}
function paymentKey(type: string): TranslationKey {
  return type === "subscription" ? "payment.subscription" : "payment.oneTime";
}

function SponsorshipDetailPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const s = useSponsorship(id);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [serviceModal, setServiceModal] = useState<{ open: boolean; initial?: Service }>({ open: false });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) { setMenuOpen(false); setStatusOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Résout l'id du projet Studio (pour « View project ») en associant le titre.
  const projectName = s?.project;
  useEffect(() => {
    if (s?.projectId) {
      setProjectId(s.projectId);
      return;
    }
    if (!projectName) return;
    let active = true;
    void loadStudioProjects<{ id: string; title: string }>()
      .then((rows) => { if (active) setProjectId(rows.find((p) => p.title === projectName)?.id ?? null); })
      .catch(() => {});
    return () => { active = false; };
  }, [projectName, s?.projectId]);

  if (!s) {
    return (
      <main className="min-h-dvh">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">{t("sponsorDetail.notFound")}</h1>
          <p className="mt-2 text-sm text-text-secondary">{t("sponsorDetail.notFoundText")}</p>
          <Link to="/sponsorship-hub" className="btn-neon mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold">{t("sponsorDetail.back")}</Link>
        </div>
      </main>
    );
  }

  const servicesTotal = s.services.reduce((sum, x) => sum + x.price, 0);
  const linkedCount = s.services.filter((x) => x.deliveryLink).length;

  const setStatus = async (st: SponsorshipStatus) => {
    setActionError(null);
    try {
      await updateSponsorship(s.id, { status: st });
      setMenuOpen(false);
      setStatusOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "La mise à jour a échoué.");
    }
  };
  const onDelete = async () => {
    if (confirm(t("sponsorDetail.confirmDelete"))) {
      setActionError(null);
      try {
        await deleteSponsorship(s.id);
        await navigate({ to: "/sponsorship-hub" });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "La suppression a échoué.");
      }
    }
  };
  // Quitter le parrainage : on sort de la collaboration (statut annulé) et on
  // revient à la liste. Distinct de « Cancel » qui reste sur la fiche.
  const onLeave = async () => {
    setMenuOpen(false);
    if (confirm(t("sponsorDetail.confirmLeave"))) {
      try {
        await updateSponsorship(s.id, { status: "cancelled" });
        await navigate({ to: "/sponsorship-hub" });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Impossible de quitter ce parrainage.");
      }
    }
  };
  const openProject = () => {
    navigate(projectId ? { to: "/manga/$id", params: { id: projectId } } : { to: "/manga" });
  };

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {actionError && (
          <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {actionError}
          </div>
        )}
        {/* Header */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            to="/sponsorship-hub"
            aria-label={t("sponsorDetail.back")}
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
              <span>{t("sponsorHub.project")} · <span className="text-text-secondary">{s.project}</span></span>
              <span className="hidden h-1 w-1 rounded-full bg-text-muted sm:inline-block" />
              <span>{t("sponsorHub.creator")} · <span className="text-text-secondary">{s.creator}</span></span>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen((v) => !v); setStatusOpen(false); }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("sponsorDetail.moreActions")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/70 text-text-secondary transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-neon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-[90] mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-2xl">
                <div className="relative">
                  <MenuItem
                    label={t("sponsorDetail.changeStatus")}
                    chevron
                    onClick={() => setStatusOpen((v) => !v)}
                  />
                  {statusOpen && (
                    <div className="border-t border-border bg-[var(--deep)]/60 px-1 py-1">
                      {(Object.keys(STATUS_META) as SponsorshipStatus[]).map((st) => (
                        <button
                          key={st}
                          role="menuitem"
                          onClick={() => void setStatus(st)}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-surface-3 ${s.status === st ? "text-neon" : "text-text-secondary"}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[st].color }} />
                          {t(STATUS_KEY[st])}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-border" />
                <MenuItem label={t("sponsorDetail.finish")} onClick={() => void setStatus("finished")} />
                <MenuItem label={t("sponsorDetail.cancel")} onClick={() => void setStatus("cancelled")} />
                <MenuItem label={t("sponsorDetail.leave")} onClick={() => void onLeave()} />
                <div className="border-t border-border" />
                <MenuItem label={t("sponsorDetail.delete")} danger onClick={() => void onDelete()} />
              </div>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <section className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface/70 p-2 sm:grid-cols-6">
          <Summary label={t("sponsorDetail.totalPrice")} value={formatMoney(s.totalPrice, s.currency)} highlight />
          {/* Abonnement : montant versé chaque mois (le total = mensuel × durée). */}
          <Summary
            label={t("sponsorDetail.monthlyPayment")}
            value={s.paymentType === "subscription" ? formatMoney(servicesTotal, s.currency) : "—"}
          />
          <Summary label={t("sponsorHub.project")} value={s.project} />
          <Summary label={t("sponsorHub.creator")} value={s.creator} />
          <Summary label={t("sponsorDetail.payment")} value={t(paymentKey(s.paymentType))} />
          <Summary label={t("sponsorDetail.deadline")} value={s.deadline ?? "—"} />
        </section>

        {/* Services */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/70">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">{t("sponsorDetail.services")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {s.services.length} {t("sponsorHub.services")} · {linkedCount}/{s.services.length} {t("sponsorDetail.linksAdded")}
              </p>
            </div>
            <button
              onClick={() => setServiceModal({ open: true })}
              className="btn-neon inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              {t("sponsorDetail.addService")}
            </button>
          </div>

          {s.services.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-text-secondary">{t("sponsorDetail.noServices")}</p>
              <button onClick={() => setServiceModal({ open: true })} className="btn-neon mt-4 rounded-lg px-3 py-2 text-xs font-semibold">{t("sponsorDetail.addFirstService")}</button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-text-muted">
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left font-semibold">{t("sponsorDetail.colService")}</th>
                      <th className="px-3 py-3 text-left font-semibold">{t("sponsorDetail.colPlatforms")}</th>
                      <th className="px-3 py-3 text-left font-semibold">{t("sponsorDetail.colQty")}</th>
                      <th className="px-3 py-3 text-left font-semibold">{t("sponsorDetail.colPrice")}</th>
                      <th className="px-3 py-3 text-left font-semibold">{t("sponsorDetail.payment")}</th>
                      <th className="px-3 py-3 text-left font-semibold">{t("sponsorDetail.colDelivery")}</th>
                      <th className="px-5 py-3 text-right font-semibold">{t("sponsorDetail.colActions")}</th>
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
                              aria-label={`${t("sponsorDetail.edit")} ${sv.name}`}
                            >
                              {t("sponsorDetail.edit")}
                            </button>
                            <button
                              onClick={() => confirm(t("sponsorDetail.confirmRemoveService")) && removeService(s.id, sv.id)}
                              className="rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-danger/50 hover:text-danger"
                              aria-label={`${t("sponsorDetail.remove")} ${sv.name}`}
                            >
                              {t("sponsorDetail.remove")}
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
                        {t("sponsorDetail.edit")}
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(t("sponsorDetail.confirmRemoveService"))) return;
                          setActionError(null);
                          void removeService(s.id, sv.id).catch((error: unknown) =>
                            setActionError(error instanceof Error ? error.message : "La suppression du service a échoué."),
                          );
                        }}
                        className="flex-1 rounded-md border border-border bg-surface-3 py-2 text-xs font-semibold text-text-muted hover:border-danger/50 hover:text-danger"
                      >
                        {t("sponsorDetail.remove")}
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
              <h2 className="font-display text-base font-semibold">{t("sponsorDetail.deliveryConditions")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{t("sponsorDetail.deliveryConditionsSub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <Info label={t("sponsorDetail.deadline")} value={s.deadline ?? "—"} />
              <Info label={t("sponsorDetail.paymentType")} value={t(paymentKey(s.paymentType))} />
              <Info label={t("sponsorDetail.currency")} value={s.currency} />
              <Info label={t("sponsorDetail.created")} value={s.createdAt} />
              <div className="sm:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">{t("sponsorDetail.conditions")}</div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {s.conditions ?? t("sponsorDetail.noConditions")}
                </p>
              </div>
              {s.notes && (
                <div className="sm:col-span-2">
                  <Divider />
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-text-muted">{t("sponsorDetail.internalNotes")}</div>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{s.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/70">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-display text-base font-semibold">{t("sponsorDetail.participants")}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{t("sponsorDetail.participantsSub")}</p>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {s.participants.length === 0 && <li className="px-5 py-6 text-sm text-text-muted">{t("sponsorDetail.noParticipants")}</li>}
              {s.participants.map((p) => (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-3 font-display text-sm font-bold text-neon">
                    {p.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{p.name}</span>
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t(roleKey(p.role))}</span>
                    </div>
                    {p.meta && <div className="mt-0.5 truncate text-xs text-text-muted">{p.meta}</div>}
                  </div>
                  {p.role === "owner" ? (
                    <button
                      onClick={openProject}
                      className="shrink-0 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-neon/50 hover:text-neon"
                    >
                      {t("sponsorDetail.viewProject")}
                    </button>
                  ) : (
                    <Link
                      to="/profile/$profileId"
                      params={{ profileId: p.id }}
                      className="shrink-0 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:border-neon/50 hover:text-neon"
                    >
                      {t("sponsorDetail.viewProfile")}
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
        onError={setActionError}
      />
    </main>
  );
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
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
      {t(paymentKey(type))}
    </span>
  );
}

function DeliveryCell({ link }: { link?: string }) {
  const { t } = useI18n();
  if (!link) return <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-text-muted" />{t("sponsorDetail.noLink")}</span>;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-neon hover:text-neon-hover focus-visible:outline-2 focus-visible:outline-neon">
      <span className="h-1.5 w-1.5 rounded-full bg-neon" />
      {t("sponsorDetail.openLink")}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
    </a>
  );
}
