import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Session Supabase côté client.
 * - `useSession()` : session courante + rafraîchissement automatique
 *   (login/logout dans n'importe quel onglet).
 * - À l'inscription, le trigger DB `handle_new_user` crée la ligne `profiles`
 *   à partir de `user_metadata.username` / `display_name`.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** Traduit les erreurs Supabase Auth les plus courantes. */
export function frenchAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("user already registered")) return "Un compte existe déjà avec cet e-mail.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Adresse e-mail invalide.";
  if (m.includes("email not confirmed")) return "E-mail non confirmé : vérifie ta boîte mail.";
  if (m.includes("profiles_username_key") || m.includes("duplicate key")) return "Ce nom d'utilisateur est déjà pris.";
  if (m.includes("rate limit")) return "Trop de tentatives, réessaie dans quelques minutes.";
  if (m.includes("provider is not enabled"))
    return "La connexion Google n'est pas encore activée sur le serveur (provider à activer dans Supabase).";
  return message;
}
