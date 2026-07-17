import { supabase } from "./supabase";

/**
 * En-têtes pour les appels de génération d'images : JSON + jeton d'accès Supabase
 * (permet au serveur d'identifier l'utilisateur et de décompter ses crédits).
 */
export async function authJsonHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json", ...(await bearerHeader()) };
}

/** Uniquement l'en-tête Authorization (à fusionner avec des en-têtes existants). */
export async function bearerHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
