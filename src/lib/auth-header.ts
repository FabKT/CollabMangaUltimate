import { supabase } from "./supabase";

async function activeAccessToken(forceRefresh = false): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const expiresSoon = !session?.expires_at || session.expires_at * 1000 <= Date.now() + 60_000;
  if (!forceRefresh && session?.access_token && !expiresSoon) return session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token ?? session?.access_token ?? null;
}

/**
 * En-têtes pour les appels de génération d'images : JSON + jeton d'accès Supabase
 * (permet au serveur d'identifier l'utilisateur et de décompter ses crédits).
 */
export async function authJsonHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json", ...(await bearerHeader()) };
}

/** Uniquement l'en-tête Authorization (à fusionner avec des en-têtes existants). */
export async function bearerHeader(): Promise<Record<string, string>> {
  try {
    const token = await activeAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function refreshBearerHeader(): Promise<Record<string, string>> {
  try {
    const token = await activeAccessToken(true);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
