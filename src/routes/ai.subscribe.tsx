import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Card } from "@/components/cma/Layout";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/billing-plans";
import { supabase } from "@/lib/supabase";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { getMyBilling, startCheckout } from "@/server-functions/stripe-billing";

export const Route = createFileRoute("/ai/subscribe")({
  head: () => ({ meta: [{ title: "CollabManga AI - Plans" }] }),
  component: AiSubscribe,
});

const PLAN_TAGLINE_KEYS: Record<PlanId, TranslationKey> = {
  starter: "ai.taglineStarter",
  creator: "ai.taglineCreator",
  studio: "ai.taglineStudio",
};

function allPlanFeatures(t: (key: TranslationKey) => string): string[] {
  return [
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
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function AiSubscribe() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const features = useMemo(() => allPlanFeatures(t), [t]);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await accessToken();
      if (!token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const billing = await getMyBilling({ data: { accessToken: token } });
        const hasActivePlan =
          billing.configured &&
          billing.subscription?.status === "active" &&
          Boolean(billing.subscription.plan);

        if (!cancelled && hasActivePlan) {
          await navigate({ to: "/ai", replace: true });
        }
      } catch {
        /* The subscribe page can still show plans if billing status cannot be read. */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const choosePlan = async (plan: PlanId) => {
    setBusyPlan(plan);
    setNotice(null);
    try {
      const token = await accessToken();
      if (!token) {
        setNotice(t("ai.loginToSubscribe"));
        setBusyPlan(null);
        return;
      }

      const res = await startCheckout({
        data: { plan, accessToken: token, origin: window.location.origin },
      });

      if (res.mode === "checkout" && res.url) {
        window.location.href = res.url;
        return;
      }

      await navigate({ to: "/ai/plan", replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("ai.paymentFailed"));
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <main
      className="min-h-screen px-4 py-8 md:px-8"
      style={{
        background:
          "radial-gradient(circle at top, rgba(57,255,136,0.10), transparent 32%), var(--bg-app)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[1180px] flex-col justify-center">
        <header className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark size={54} />
          </div>
          <p
            className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--neon)" }}
          >
            CollabManga AI
          </p>
          <h1 className="font-display text-[34px] font-black leading-tight md:text-[48px]">
            {t("ai.subscribeTitle")}
          </h1>
          <p
            className="mx-auto mt-3 max-w-[660px] text-[15px] leading-7"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("ai.subscribeDesc")}
          </p>
        </header>

        {notice && (
          <div
            className="mx-auto mb-6 w-full max-w-[720px] rounded-[14px] px-4 py-3 text-center text-[13px] font-semibold"
            style={{
              background: "rgba(255,79,120,0.10)",
              border: "1px solid rgba(255,79,120,0.35)",
              color: "var(--danger)",
            }}
          >
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const featured = id === "creator";
            const busy = busyPlan === id;
            return (
              <Card key={id} padding={24} selected={featured}>
                <div
                  className="mb-2 text-[12px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(PLAN_TAGLINE_KEYS[id])}
                </div>
                <div className="font-display text-[24px] font-black">{plan.label}</div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[34px] font-black">
                    {plan.priceEuros.toFixed(2)} €
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {t("ai.perMonth")}
                  </span>
                </div>
                <div className="mt-1 text-[14px] font-black" style={{ color: "var(--neon)" }}>
                  {plan.quota} {t("ai.imagesPerMonth")}
                </div>

                <div
                  className="my-5 h-px"
                  style={{ background: "var(--border-default)" }}
                />

                <div
                  className="mb-3 text-[12px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("ai.subscribeFeaturesTitle")}
                </div>
                <ul
                  className="flex min-h-[250px] flex-col gap-2 text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check size={14} color="var(--neon)" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="cma-btn-primary mt-6 w-full justify-center"
                  disabled={Boolean(busyPlan) || checking}
                  onClick={() => void choosePlan(id)}
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  {busy ? t("ai.processingEllipsis") : t("ai.planActionChoose")}
                </button>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
