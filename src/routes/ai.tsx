import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CmaLayout } from "@/components/cma/Layout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { isLocalAiClientMode } from "@/lib/local-ai-mode";
import { loadMyBilling } from "@/lib/billing-client";

export const Route = createFileRoute("/ai")({
  component: AiRoute,
});

function AiRoute() {
  const content = <AiSubscriptionGate />;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return isLocalAiClientMode || pathname === "/ai/subscribe" ? (
    content
  ) : (
    <RequireAuth>{content}</RequireAuth>
  );
}

function AiSubscriptionGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const isBillingRoute = pathname === "/ai/plan" || pathname === "/ai/subscribe";
  const [checking, setChecking] = useState(!isLocalAiClientMode && !isBillingRoute);
  const [allowed, setAllowed] = useState(isLocalAiClientMode || isBillingRoute);
  const [checkError, setCheckError] = useState<string | null>(null);
  const verifiedRef = useRef(isLocalAiClientMode);

  const checkAccess = useCallback(() => {
    let cancelled = false;

    if (isLocalAiClientMode || isBillingRoute) {
      setAllowed(true);
      setChecking(false);
      setCheckError(null);
      return () => {
        cancelled = true;
      };
    }
    if (verifiedRef.current) {
      setAllowed(true);
      setChecking(false);
      setCheckError(null);
      return () => {
        cancelled = true;
      };
    }

    setChecking(true);
    setCheckError(null);
    void (async () => {
      try {
        const billing = await loadMyBilling();
        const hasActivePlan =
          billing.configured &&
          billing.subscription?.status === "active" &&
          Boolean(billing.subscription.plan);
        if (cancelled) return;
        setAllowed(hasActivePlan);
        verifiedRef.current = hasActivePlan;
        if (!hasActivePlan) {
          await navigate({ to: "/ai/subscribe", replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setAllowed(false);
          setCheckError(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier l'abonnement pour le moment.",
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isBillingRoute, navigate]);

  useEffect(() => checkAccess(), [checkAccess]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-app)] text-[13px] font-semibold text-[var(--text-secondary)]">
        Vérification de l'abonnement...
      </div>
    );
  }

  if (checkError && !allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-app)] px-5 text-center">
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-secondary)]">{checkError}</p>
          <button className="cma-btn-primary mt-4" onClick={() => checkAccess()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  if (pathname === "/ai/subscribe") {
    return <Outlet />;
  }

  return (
    <CmaLayout>
      <Outlet />
    </CmaLayout>
  );
}
