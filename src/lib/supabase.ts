import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase partagé (projet « CollabManga Projet »).
 *
 * - URL + clé publiable injectées au build par Vite depuis .env.local
 *   (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
 * - La clé publiable est faite pour être exposée côté client ;
 *   la sécurité des données repose sur les politiques RLS côté base.
 *
 * Schéma actuel (migrations Supabase) :
 *   profiles          — identité (1:1 avec auth.users, profil créé automatiquement à l'inscription)
 *   workflow_records  — registre de chaque action (invitations, propositions, parrainages…)
 *   notifications     — notifications par destinataire (Realtime activé)
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  const defaultStorageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const legacyTabStorageKeyName = "collabmanga.supabase.tab-storage-key";
  const stableSessionKey = "collabmanga.supabase.auth-session";
  // Supabase uses storageKey for its cross-tab channel. It must be fresh on
  // every page load because browsers clone sessionStorage when a tab is
  // duplicated. The adapter below maps this volatile key to a stable key
  // inside the current tab so reloads still preserve that tab's session.
  const tabStorageKey =
    typeof window === "undefined"
      ? defaultStorageKey
      : `collabmanga-auth-${crypto.randomUUID()}`;

  const storage =
    typeof window === "undefined"
      ? undefined
      : {
          getItem(key: string) {
            const stableKey = key.replace(tabStorageKey, stableSessionKey);
            const tabSession = window.sessionStorage.getItem(stableKey);
            if (tabSession !== null) return tabSession;

            // Migrate sessions created by the previous browser-wide and
            // per-tab implementations. Subsequent writes remain tab-local.
            const legacyTabStorageKey = window.sessionStorage.getItem(legacyTabStorageKeyName);
            const legacyKey = legacyTabStorageKey
              ? key.replace(tabStorageKey, legacyTabStorageKey)
              : null;
            const sharedSession =
              (legacyKey ? window.sessionStorage.getItem(legacyKey) : null) ??
              window.sessionStorage.getItem(key) ??
              (key === tabStorageKey ? window.localStorage.getItem(defaultStorageKey) : null);
            if (sharedSession !== null) {
              window.sessionStorage.setItem(stableKey, sharedSession);
              if (legacyKey) window.sessionStorage.removeItem(legacyKey);
              window.sessionStorage.removeItem(key);
              if (key === tabStorageKey) window.localStorage.removeItem(defaultStorageKey);
            }
            window.sessionStorage.removeItem(legacyTabStorageKeyName);
            return sharedSession;
          },
          setItem(key: string, value: string) {
            window.sessionStorage.setItem(key.replace(tabStorageKey, stableSessionKey), value);
          },
          removeItem(key: string) {
            window.sessionStorage.removeItem(key.replace(tabStorageKey, stableSessionKey));
          },
        };

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: tabStorageKey,
      storage,
    },
  });
}

/** Null tant que les variables d'environnement ne sont pas configurées. */
export const supabase = client;

/** Version stricte : lève une erreur claire si le client n'est pas configuré. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      "Supabase n'est pas configuré : VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY manquent dans .env.local.",
    );
  }
  return client;
}
