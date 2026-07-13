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
  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
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
