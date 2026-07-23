import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CmaLayout } from "@/components/cma/Layout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { isLocalAiClientMode } from "@/lib/local-ai-mode";
import { supabase } from "@/lib/supabase";
import { getMyBilling } from "@/server-functions/stripe-billing";

export const Route = createFileRoute("/ai")({
  component: AiRoute,
});

function AiRoute() {
  const content = <AiSubscriptionGate />;
  return isLocalAiClientMode ? content : <RequireAuth>{content}</RequireAuth>;
}

function AiSubscriptionGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [checking, setChecking] = useState(!isLocalAiClientMode && pathname !== "/ai/plan");
  const [allowed, setAllowed] = useState(isLocalAiClientMode || pathname === "/ai/plan");
  const verifiedRef = useRef(isLocalAiClientMode);

  useEffect(() => {
    let cancelled = false;

    if (isLocalAiClientMode || pathname === "/ai/plan") {
      setAllowed(true);
      setChecking(false);
      return;
    }
    if (verifiedRef.current) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    setChecking(true);
    void (async () => {
      const session = await supabase?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      if (!accessToken) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      try {
        const billing = await getMyBilling({ data: { accessToken } });
        const hasActivePlan =
          billing.configured &&
          billing.subscription?.status === "active" &&
          Boolean(billing.subscription.plan);
        if (cancelled) return;
        setAllowed(hasActivePlan);
        verifiedRef.current = hasActivePlan;
        if (!hasActivePlan) {
          await navigate({ to: "/ai/plan", replace: true });
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
          await navigate({ to: "/ai/plan", replace: true });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, pathname]);

  if (checking || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-app)] text-[13px] font-semibold text-[var(--text-secondary)]">
        Vérification de l'abonnement...
      </div>
    );
  }

  return (
    <CmaLayout>
      <Outlet />
    </CmaLayout>
  );
}
