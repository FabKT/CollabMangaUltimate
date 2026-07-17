import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, Card, SectionTitle, Chip } from "@/components/cma/Layout";
import { Check, Sparkles, Receipt, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/billing-plans";
import { startCheckout, getMyBilling, cancelMySubscription } from "@/server-functions/stripe-billing";

export const Route = createFileRoute("/ai/plan")({
  head: () => ({ meta: [{ title: "Plan & Images — CollabManga AI" }] }),
  component: PlanImages,
});

type BillingState = Awaited<ReturnType<typeof getMyBilling>>;

const PLAN_FEATURES: Record<PlanId, string[]> = {
  starter: ["80 images / mois", "Manga Page Creator", "Character Studio", "Bibliothèque d'assets"],
  creator: ["300 images / mois", "Génération prioritaire", "Raw to Final", "Transfert de style"],
  studio: ["1200 images / mois", "Priorité maximale", "Cohérence avancée", "Bibliothèque d'équipe"],
};
const PLAN_TAGLINE: Record<PlanId, string> = {
  starter: "For exploring CollabManga AI",
  creator: "For ongoing manga projects",
  studio: "For teams and studios",
};

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function PlanImages() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    void (async () => {
      const token = await accessToken();
      if (!token) {
        setBilling({ configured: true, subscription: null, period: null } as BillingState);
        setLoading(false);
        return;
      }
      try {
        const res = await getMyBilling({ data: { accessToken: token } });
        setBilling(res);
      } catch {
        setBilling(null);
      }
      setLoading(false);
    })();
  };

  useEffect(refresh, []);

  // Bannière selon le retour de Stripe (redirections Checkout).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setNotice("Paiement confirmé — ton quota sera crédité dès la confirmation Stripe (quelques secondes).");
    else if (params.get("upgraded")) setNotice("Montée en gamme effectuée : ton nouveau quota est disponible.");
    else if (params.get("downgrade")) setNotice("Baisse de gamme programmée : elle prendra effet au prochain renouvellement.");
    else if (params.get("canceled")) setNotice("Paiement annulé — aucun changement n'a été appliqué.");
    if (params.toString()) window.history.replaceState({}, "", "/ai/plan");
  }, []);

  const currentPlan = (billing?.configured && billing.subscription?.plan) || null;
  const period = billing?.configured ? billing.period : null;

  const startPlan = async (plan: PlanId) => {
    setBusy(true);
    setNotice(null);
    try {
      const token = await accessToken();
      if (!token) {
        setNotice("Connecte-toi pour souscrire à un abonnement.");
        setBusy(false);
        return;
      }
      const res = await startCheckout({ data: { plan, accessToken: token } });
      if (res.mode === "checkout" && res.url) {
        window.location.href = res.url;
        return;
      }
      // Montée/baisse immédiate côté Stripe : on rafraîchit l'état.
      setNotice(res.mode === "immediate" ? "Montée en gamme effectuée." : "Baisse de gamme programmée au prochain renouvellement.");
      setConfirmPlan(null);
      refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Échec du paiement.");
    }
    setBusy(false);
  };

  const onChoose = (plan: PlanId) => {
    if (plan === currentPlan) return;
    // Montée en gamme : confirmation explicite des conséquences (§15/§26).
    const isUpgrade = currentPlan && PLANS[plan].amountCents > PLANS[currentPlan].amountCents;
    if (isUpgrade) setConfirmPlan(plan);
    else void startPlan(plan);
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const token = await accessToken();
      if (token) {
        await cancelMySubscription({ data: { accessToken: token } });
        setNotice("Renouvellement annulé : ton accès reste actif jusqu'à la fin de la période payée.");
        refresh();
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Échec de l'annulation.");
    }
    setBusy(false);
  };

  const usagePct = useMemo(() => {
    if (!period || period.quota === 0) return 0;
    return Math.min(100, Math.round((period.used / period.quota) * 100));
  }, [period]);

  return (
    <>
      <PageHeader
        title="Plan & Images"
        description="Gère ton abonnement CollabManga AI et ton quota d'images générées."
        actions={
          <>
            <button className="cma-btn-secondary"><Receipt size={16} /> Billing</button>
            {currentPlan && !billing?.subscription?.cancelAtPeriodEnd && (
              <button className="cma-btn-secondary" onClick={() => void cancel()} disabled={busy}>Annuler le renouvellement</button>
            )}
          </>
        }
      />

      {notice && (
        <div className="mb-6 rounded-[14px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.35)", color: "var(--neon)" }}>
          {notice}
        </div>
      )}

      {billing && !billing.configured && (
        <div className="mb-6 rounded-[14px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,184,77,0.10)", border: "1px solid rgba(255,184,77,0.35)", color: "var(--warning)" }}>
          Paiements pas encore activés : les clés Stripe doivent être configurées côté serveur.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6 mb-6">
        <Panel>
          <SectionTitle right={currentPlan ? <span className="cma-chip cma-chip-active">Active</span> : undefined}>Current plan</SectionTitle>
          {loading ? (
            <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Chargement…</div>
          ) : currentPlan ? (
            <>
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                  <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Plan</div>
                  <div style={{ font: "700 28px/36px var(--font-display)" }}>{PLANS[currentPlan].label}</div>
                  <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    {PLANS[currentPlan].quota} images incluses par mois
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</div>
                  <div style={{ font: "700 28px/36px var(--font-display)" }}>{PLANS[currentPlan].priceEuros.toFixed(2)} €<span className="text-[13px]" style={{ color: "var(--text-muted)" }}> / mois</span></div>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  <span>Images utilisées cette période</span>
                  <span><strong style={{ color: "var(--text-primary)" }}>{period?.used ?? 0}</strong> / {period?.quota ?? PLANS[currentPlan].quota}</span>
                </div>
                <div className="mt-2" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: `${usagePct}%`, height: "100%", borderRadius: 999, background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
                </div>
                {period && (
                  <div className="mt-2 flex items-center justify-between text-[12px]" style={{ color: "var(--text-muted)" }}>
                    <span>{period.remaining} crédits restants</span>
                    <span>Renouvellement : {new Date(period.renewalAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                )}
                {billing?.subscription?.cancelAtPeriodEnd && (
                  <div className="mt-2 text-[12px] font-semibold" style={{ color: "var(--warning)" }}>
                    Renouvellement annulé — accès jusqu'à la fin de la période.
                  </div>
                )}
                {billing?.subscription?.scheduledDowngrade && (
                  <div className="mt-1 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    Passage à {PLANS[billing.subscription.scheduledDowngrade].label} au prochain renouvellement.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Aucun abonnement actif. Choisis un plan ci-dessous pour commencer à générer des images.
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle>Ce qui consomme une image</SectionTitle>
          <ul className="flex flex-col gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {["Génération d'une planche manga", "Génération d'une carte de personnage", "Variante de transfert de style", "Finalisation Raw to Final", "Génération de décor"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check size={14} color="var(--neon)" /> {t}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <SectionTitle>Compare plans</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === currentPlan;
          const featured = id === "creator";
          return (
            <Card key={id} padding={24} selected={featured}>
              <div className="flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{PLAN_TAGLINE[id]}</div>
                {isCurrent && <Chip active>Current</Chip>}
              </div>
              <div className="mt-2" style={{ font: "700 22px/28px var(--font-display)" }}>{p.label}</div>
              <div className="mt-4 flex items-baseline gap-2">
                <span style={{ font: "700 32px/36px var(--font-display)", color: "var(--text-primary)" }}>{p.priceEuros.toFixed(2)} €</span>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>/ mois</span>
              </div>
              <div className="text-[13px] mt-1 font-bold" style={{ color: "var(--neon)" }}>{p.quota} images / mois</div>
              <ul className="mt-5 flex flex-col gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {PLAN_FEATURES[id].map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={14} color="var(--neon)" /> {f}</li>
                ))}
              </ul>
              <button
                className={featured ? "cma-btn-primary w-full justify-center mt-6" : "cma-btn-secondary w-full justify-center mt-6"}
                disabled={busy || isCurrent}
                onClick={() => onChoose(id)}
              >
                {isCurrent ? "Plan actuel" : currentPlan ? (PLANS[id].amountCents > PLANS[currentPlan].amountCents ? "Passer à ce plan" : "Rétrograder") : "Choisir ce plan"}
              </button>
            </Card>
          );
        })}
      </div>

      <Panel>
        <SectionTitle>Billing history</SectionTitle>
        <div className="grid grid-cols-[1fr_140px_140px_120px] gap-4 px-1 pb-3 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}>
          <div>Description</div><div>Date</div><div>Amount</div><div className="text-right">Invoice</div>
        </div>
        <div className="px-1 py-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          L'historique de facturation détaillé apparaîtra ici après tes paiements.
        </div>
      </Panel>

      {confirmPlan && currentPlan && (
        <UpgradeConfirm
          from={currentPlan}
          to={confirmPlan}
          remaining={period?.remaining ?? 0}
          busy={busy}
          onCancel={() => setConfirmPlan(null)}
          onConfirm={() => void startPlan(confirmPlan)}
        />
      )}
    </>
  );
}

function UpgradeConfirm({
  from, to, remaining, busy, onCancel, onConfirm,
}: {
  from: PlanId; to: PlanId; remaining: number; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const p = PLANS[to];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] rounded-[22px] p-6" style={{ background: "var(--panel, #0B1430)", border: "1px solid var(--border-strong, rgba(133,154,206,0.28))" }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><AlertTriangle size={18} color="var(--warning)" /><h3 className="text-[18px] font-bold">Confirmer la montée en gamme</h3></div>
          <button onClick={onCancel} aria-label="Fermer" style={{ color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        <p className="text-[14px] leading-[22px]" style={{ color: "var(--text-secondary)" }}>
          Vous disposez actuellement de <strong style={{ color: "var(--text-primary)" }}>{remaining} crédits {PLANS[from].label}</strong>.
          En passant immédiatement au plan <strong style={{ color: "var(--text-primary)" }}>{p.label}</strong>, ces {remaining} crédits expireront.
          Vous paierez <strong style={{ color: "var(--text-primary)" }}>{p.priceEuros.toFixed(2)} €</strong> aujourd'hui et recevrez
          immédiatement <strong style={{ color: "var(--text-primary)" }}>{p.quota} crédits</strong>.
          Votre abonnement sera ensuite renouvelé chaque mois à la date d'aujourd'hui au tarif de {p.priceEuros.toFixed(2)} €.
        </p>
        <ul className="mt-4 flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <li>• Aucun report des crédits actuels.</li>
          <li>• Aucun remboursement de l'ancien plan.</li>
          <li>• Nouvelle date de renouvellement = aujourd'hui.</li>
        </ul>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="cma-btn-secondary" onClick={onCancel} disabled={busy}>Annuler</button>
          <button className="cma-btn-primary" onClick={onConfirm} disabled={busy}>{busy ? "Traitement…" : `Payer ${p.priceEuros.toFixed(2)} €`}</button>
        </div>
      </div>
    </div>
  );
}
