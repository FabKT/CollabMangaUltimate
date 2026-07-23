import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, Card, SectionTitle, Chip } from "@/components/cma/Layout";
import { Check, Sparkles, Receipt, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/billing-plans";
import {
  startCheckout,
  getMyBilling,
  cancelMySubscription,
  openBillingPortal,
} from "@/server-functions/stripe-billing";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/ai/plan")({
  head: () => ({ meta: [{ title: "Plan & Images — CollabManga AI" }] }),
  component: PlanImages,
});

type BillingState = Awaited<ReturnType<typeof getMyBilling>>;

function planFeatures(t: (key: TranslationKey) => string): Record<PlanId, string[]> {
  const allFeatures = [
    "Manga Page Creator",
    t("nav.characterCreate"),
    t("nav.styleTransfer"),
    t("nav.rawFinal"),
    t("nav.swap"),
    t("nav.freeStudio"),
    t("nav.imageEdit"),
    t("nav.characterLibrary"),
    t("nav.history"),
  ];
  return {
    starter: allFeatures,
    creator: allFeatures,
    studio: allFeatures,
  };
}
const PLAN_TAGLINE_KEYS: Record<PlanId, TranslationKey> = {
  starter: "ai.taglineStarter",
  creator: "ai.taglineCreator",
  studio: "ai.taglineStudio",
};

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function PlanImages() {
  const { t } = useI18n();
  const PLAN_FEATURES = useMemo(() => planFeatures(t), [t]);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
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
    if (params.get("success"))
      setNotice(t("ai.paymentConfirmedNotice"));
    else if (params.get("upgraded"))
      setNotice(t("ai.upgradedNotice"));
    else if (params.get("downgrade"))
      setNotice(t("ai.downgradeScheduledNotice"));
    else if (params.get("canceled"))
      setNotice(t("ai.paymentCanceledNotice"));
    if (params.toString()) window.history.replaceState({}, "", "/ai/plan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscription = billing?.configured ? billing.subscription : null;
  const currentPlan = subscription?.status === "active" ? subscription.plan : null;
  const period = billing?.configured ? billing.period : null;

  // Attend que le webhook ait appliqué le nouveau plan (montée en gamme immédiate).
  const pollUntilPlan = async (target: PlanId): Promise<boolean> => {
    const token = await accessToken();
    if (!token) return false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      try {
        const res = await getMyBilling({ data: { accessToken: token } });
        setBilling(res);
        if (res.configured && res.subscription?.plan === target && res.period?.plan === target) {
          return true;
        }
      } catch {
        /* on continue */
      }
    }
    return false;
  };

  const startPlan = async (plan: PlanId) => {
    setBusy(true);
    setNotice(null);
    try {
      const token = await accessToken();
      if (!token) {
        setNotice(t("ai.loginToSubscribe"));
        setBusy(false);
        return;
      }
      const res = await startCheckout({
        data: { plan, accessToken: token, origin: window.location.origin },
      });
      if (res.mode === "checkout" && res.url) {
        window.location.href = res.url;
        return;
      }
      if (res.mode === "immediate") {
        // Montée en gamme : la carte enregistrée a été débitée. On attend le webhook.
        setConfirmPlan(null);
        setNotice(t("ai.paymentProcessing"));
        const confirmed = await pollUntilPlan(plan);
        setNotice(
          confirmed
            ? `${t("ai.planUpdatedPrefix")} ${PLANS[plan].label} — ${PLANS[plan].quota} ${t("ai.creditsAvailableSuffix")}`
            : t("ai.paymentStillConfirming"),
        );
      } else {
        setConfirmPlan(null);
        setNotice(t("ai.downgradeScheduledNotice"));
        refresh();
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t("ai.paymentFailed"));
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
    setConfirmCancel(false);
    try {
      const token = await accessToken();
      if (token) {
        await cancelMySubscription({ data: { accessToken: token } });
        setNotice(t("ai.renewalCanceledNotice"));
        refresh();
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t("ai.cancelFailed"));
    }
    setBusy(false);
  };

  const openPortal = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const token = await accessToken();
      if (!token) throw new Error(t("ai.loginToManageBilling"));
      const { url } = await openBillingPortal({
        data: { accessToken: token, origin: window.location.origin },
      });
      window.location.href = url;
      return;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t("ai.billingOpenFailed"));
    }
    setBusy(false);
  };

  // Crédits restants (compte à rebours depuis le quota).
  const remainingPct = useMemo(() => {
    if (!period || period.quota === 0) return 0;
    return Math.max(0, Math.min(100, Math.round((period.remaining / period.quota) * 100)));
  }, [period]);

  return (
    <>
      <PageHeader
        title={t("ai.planTitle")}
        description={t("ai.planDesc")}
        actions={
          <>
            <button
              className="cma-btn-secondary"
              onClick={() => void openPortal()}
              disabled={busy || !subscription}
            >
              <Receipt size={16} /> {t("ai.billingBtn")}
            </button>
            {currentPlan && !billing?.subscription?.cancelAtPeriodEnd && (
              <button
                className="cma-btn-secondary"
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
              >
                {t("ai.cancelRenewal")}
              </button>
            )}
          </>
        }
      />

      {notice && (
        <div
          className="mb-6 rounded-[14px] px-4 py-3 text-[13px] font-semibold"
          style={{
            background: "rgba(57,255,136,0.10)",
            border: "1px solid rgba(57,255,136,0.35)",
            color: "var(--neon)",
          }}
        >
          {notice}
        </div>
      )}

      {billing && !billing.configured && (
        <div
          className="mb-6 rounded-[14px] px-4 py-3 text-[13px] font-semibold"
          style={{
            background: "rgba(255,184,77,0.10)",
            border: "1px solid rgba(255,184,77,0.35)",
            color: "var(--warning)",
          }}
        >
          {t("ai.paymentsNotEnabled")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6 mb-6">
        <Panel>
          <SectionTitle
            right={
              currentPlan && period ? (
                <span className="cma-chip cma-chip-active">{t("ai.activeChip")}</span>
              ) : undefined
            }
          >
            {t("ai.currentPlan")}
          </SectionTitle>
          {loading ? (
            <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {t("ai.loadingEllipsis")}
            </div>
          ) : currentPlan ? (
            <>
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                  <div
                    className="text-[12px] uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("ai.planLabel")}
                  </div>
                  <div style={{ font: "700 28px/36px var(--font-display)" }}>
                    {PLANS[currentPlan].label}
                  </div>
                  <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    {PLANS[currentPlan].quota} {t("ai.imagesIncludedPerMonth")}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-[12px] uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("ai.priceLabel")}
                  </div>
                  <div style={{ font: "700 28px/36px var(--font-display)" }}>
                    {PLANS[currentPlan].priceEuros.toFixed(2)} €
                    <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      {" "}
                      {t("ai.perMonth")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <div
                  className="flex items-center justify-between text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>{t("ai.creditsRemainingPeriod")}</span>
                  <span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {period?.remaining ?? 0}
                    </strong>{" "}
                    / {period?.quota ?? PLANS[currentPlan].quota}
                  </span>
                </div>
                <div
                  className="mt-2"
                  style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    style={{
                      width: `${remainingPct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--neon)",
                      boxShadow: "0 0 10px rgba(57,255,136,0.5)",
                    }}
                  />
                </div>
                {period && (
                  <div
                    className="mt-2 flex items-center justify-between text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>
                      {period.used} {t(period.used > 1 ? "ai.generatedPlural" : "ai.generatedSingular")}
                    </span>
                    <span>
                      {t("ai.renewalLabel")} {new Date(period.renewalAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                )}
                {billing?.subscription?.cancelAtPeriodEnd && (
                  <div
                    className="mt-2 text-[12px] font-semibold"
                    style={{ color: "var(--warning)" }}
                  >
                    {t("ai.renewalCanceledBadge")}
                  </div>
                )}
                {billing?.subscription?.scheduledDowngrade && (
                  <div
                    className="mt-1 text-[12px] font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("ai.scheduledDowngradeToPrefix")} {PLANS[billing.subscription.scheduledDowngrade].label}{" "}
                    {t("ai.scheduledDowngradeToSuffix")}
                  </div>
                )}
                {!period && (
                  <div
                    className="mt-2 text-[12px] font-semibold"
                    style={{ color: "var(--warning)" }}
                  >
                    {t("ai.paymentConfirmingNoCredits")}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {subscription?.status === "past_due" || subscription?.status === "incomplete"
                ? t("ai.paymentPendingOrFailed")
                : t("ai.noActiveSubscription")}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionTitle>{t("ai.whatConsumesImage")}</SectionTitle>
          <ul
            className="flex flex-col gap-2 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {[
              t("ai.consumeMangaPage"),
              t("ai.consumeCharacterCard"),
              t("ai.consumeStyleVariant"),
              t("ai.consumeRawToFinal"),
              t("ai.consumeDecorGen"),
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check size={14} color="var(--neon)" /> {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <SectionTitle>{t("ai.comparePlans")}</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === currentPlan;
          const featured = id === "creator";
          return (
            <Card key={id} padding={24} selected={featured}>
              <div className="flex items-center justify-between">
                <div
                  className="text-[12px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(PLAN_TAGLINE_KEYS[id])}
                </div>
                {isCurrent && <Chip active>{t("ai.currentPlan")}</Chip>}
              </div>
              <div className="mt-2" style={{ font: "700 22px/28px var(--font-display)" }}>
                {p.label}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span
                  style={{
                    font: "700 32px/36px var(--font-display)",
                    color: "var(--text-primary)",
                  }}
                >
                  {p.priceEuros.toFixed(2)} €
                </span>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {t("ai.perMonth")}
                </span>
              </div>
              <div className="text-[13px] mt-1 font-bold" style={{ color: "var(--neon)" }}>
                {p.quota} {t("ai.imagesPerMonth")}
              </div>
              <ul
                className="mt-5 flex flex-col gap-2 text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {PLAN_FEATURES[id].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={14} color="var(--neon)" /> {f}
                  </li>
                ))}
              </ul>
              <button
                className={
                  featured
                    ? "cma-btn-primary w-full justify-center mt-6"
                    : "cma-btn-secondary w-full justify-center mt-6"
                }
                disabled={busy || isCurrent}
                onClick={() => onChoose(id)}
              >
                {isCurrent
                  ? t("ai.planActionCurrent")
                  : currentPlan
                    ? PLANS[id].amountCents > PLANS[currentPlan].amountCents
                      ? t("ai.planActionUpgrade")
                      : t("ai.planActionDowngrade")
                    : t("ai.planActionChoose")}
              </button>
            </Card>
          );
        })}
      </div>

      <Panel>
        <SectionTitle>{t("ai.billingHistory")}</SectionTitle>
        <div
          className="grid grid-cols-[1fr_140px_140px_120px] gap-4 px-1 pb-3 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}
        >
          <div>{t("ai.descriptionCol")}</div>
          <div>{t("ai.dateCol")}</div>
          <div>{t("ai.amountCol")}</div>
          <div className="text-right">{t("ai.invoiceCol")}</div>
        </div>
        <div className="px-1 py-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {t("ai.billingHistoryEmpty")}
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

      {confirmCancel && (
        <ConfirmDialog
          title={t("ai.cancelRenewal")}
          message={
            period
              ? `${t("ai.cancelMsgWithDatePrefix")} ${new Date(period.renewalAt).toLocaleDateString("fr-FR")} ${t("ai.cancelMsgWithDateSuffix")}`
              : t("ai.cancelMsgNoDate")
          }
          confirmLabel={t("ai.cancelRenewal")}
          busy={busy}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => void cancel()}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[22px] p-6"
        style={{
          background: "var(--panel, #0B1430)",
          border: "1px solid var(--border-strong, rgba(133,154,206,0.28))",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} color="var(--warning)" />
            <h3 className="text-[18px] font-bold">{title}</h3>
          </div>
          <button onClick={onCancel} aria-label={t("ai.close")} style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <p className="text-[14px] leading-[22px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="cma-btn-secondary" onClick={onCancel} disabled={busy}>
            {t("ai.back")}
          </button>
          <button className="cma-btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? t("ai.processingEllipsis") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpgradeConfirm({
  from,
  to,
  remaining,
  busy,
  onCancel,
  onConfirm,
}: {
  from: PlanId;
  to: PlanId;
  remaining: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const p = PLANS[to];
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-[22px] p-6"
        style={{
          background: "var(--panel, #0B1430)",
          border: "1px solid var(--border-strong, rgba(133,154,206,0.28))",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} color="var(--warning)" />
            <h3 className="text-[18px] font-bold">{t("ai.confirmUpgradeTitle")}</h3>
          </div>
          <button onClick={onCancel} aria-label={t("ai.close")} style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <p className="text-[14px] leading-[22px]" style={{ color: "var(--text-secondary)" }}>
          {t("ai.upgradeSentence1")}{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {remaining} {t("ai.creditsWord")} {PLANS[from].label}
          </strong>
          {t("ai.upgradeSentence2")}{" "}
          <strong style={{ color: "var(--text-primary)" }}>{p.label}</strong>
          {t("ai.upgradeSentence3")} {remaining}{" "}
          {t("ai.upgradeSentence3b")}{" "}
          <strong style={{ color: "var(--text-primary)" }}>{p.priceEuros.toFixed(2)} €</strong>{" "}
          {t("ai.upgradeSentence4")}{" "}
          <strong style={{ color: "var(--text-primary)" }}>{p.quota} {t("ai.creditsWord")}</strong>.{" "}
          {t("ai.upgradeSentence5")}{" "}
          {p.priceEuros.toFixed(2)} €.
        </p>
        <ul
          className="mt-4 flex flex-col gap-1.5 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          <li>• {t("ai.upgradeBullet1")}</li>
          <li>• {t("ai.upgradeBullet2")}</li>
          <li>• {t("ai.upgradeBullet3")}</li>
          <li>• {t("ai.upgradeBullet4")}</li>
        </ul>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="cma-btn-secondary" onClick={onCancel} disabled={busy}>
            {t("ai.cancel")}
          </button>
          <button className="cma-btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? t("ai.processingEllipsis") : `${t("ai.payPrefix")} ${p.priceEuros.toFixed(2)} €`}
          </button>
        </div>
      </div>
    </div>
  );
}
