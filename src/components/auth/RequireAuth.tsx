import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Garde d'authentification globale.
 *
 * Enveloppe les layouts protégés (/_collab et /ai) : tant que la session
 * Supabase se charge, un écran d'attente est affiché ; sans session,
 * l'utilisateur est renvoyé vers /login. La landing (/), /login et /signup
 * restent publiques — ce sont les seuls points d'entrée.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  useEffect(() => {
    if (!loading && !session) {
      const destination = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?redirect=${encodeURIComponent(destination)}`);
    }
  }, [loading, session]);

  useEffect(() => {
    if (loading || !session || !supabase || window.location.pathname === "/onboarding") return;
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled && !error && data && data.onboarding_completed !== true) {
          const destination = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/onboarding?redirect=${encodeURIComponent(destination)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  if (loading || !session) {
    return (
      <div
        className="flex min-h-screen w-full flex-col items-center justify-center gap-4"
        style={{ background: "#050B1D", color: "#B8C4E5" }}
      >
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "#39FF88", borderRightColor: "rgba(57,255,136,0.35)" }}
          aria-hidden
        />
        <p className="text-[14px] font-semibold" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {loading ? "Vérification de la session…" : "Redirection vers la connexion…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
