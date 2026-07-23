import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SessionSnapshot = {
  session: Session | null;
  loading: boolean;
};

const listeners = new Set<() => void>();
const serverSnapshot: SessionSnapshot = { session: null, loading: true };
let snapshot: SessionSnapshot = serverSnapshot;
let sessionStarted = false;

function publish(next: SessionSnapshot) {
  if (snapshot.session === next.session && snapshot.loading === next.loading) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function startSessionObserver() {
  if (sessionStarted || typeof window === "undefined") return;
  sessionStarted = true;

  if (!supabase) {
    publish({ session: null, loading: false });
    return;
  }

  void supabase.auth.getSession().then(({ data }) => {
    publish({ session: data.session, loading: false });
  });
  supabase.auth.onAuthStateChange((_event, next) => {
    publish({ session: next, loading: false });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startSessionObserver();
  return () => listeners.delete(listener);
}

/**
 * Session Supabase côté client.
 * - `useSession()` : session courante + rafraîchissement automatique.
 *   Chaque onglet possède sa propre session Supabase afin que plusieurs
 *   comptes puissent être utilisés sans s'écraser mutuellement.
 * - À l'inscription, le trigger DB `handle_new_user` crée la ligne `profiles`
 *   à partir de `user_metadata.username` / `display_name`.
 */
export function useSession() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}

export async function signOut() {
  await supabase?.auth.signOut({ scope: "local" });
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
