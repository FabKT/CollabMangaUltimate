/**
 * Réservation / consommation de crédits autour des générations d'images.
 * CÔTÉ SERVEUR UNIQUEMENT (utilise le client Supabase service-role).
 *
 * Flux (cahier des charges §21) : réserver 1 crédit → appeler PulseNote →
 * consommer si une image est produite, sinon restituer.
 */

import { getServiceSupabase, isStripeConfigured } from "./stripe-server";

/** Coût OpenAI estimé par image produite (centimes). */
export const ESTIMATED_IMAGE_COST_CENTS = 17;

export type GenerationMeta = {
  operationType?: "generate" | "edit" | "regenerate" | "retry" | "variant";
  model?: string;
  quality?: string;
  dimensions?: string;
  referenceImages?: number;
};

type Outcome<T> = { ok: true; result: T } | { ok: false; status: number; error: string };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function userIdFromRequest(request: Request): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data } = await getServiceSupabase().auth.getUser(token);
  return data.user?.id ?? null;
}

/** Traduit les exceptions des fonctions SQL de crédits en message clair. */
function creditErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("NO_ACTIVE_PERIOD")) return "Aucun abonnement actif : souscris un plan pour générer des images.";
  if (raw.includes("INSUFFICIENT_CREDITS")) return "Quota d'images épuisé pour cette période. Passe à un plan supérieur ou attends le renouvellement.";
  if (raw.includes("PERIOD_EXPIRED")) return "Ta période d'abonnement est terminée. Renouvelle pour continuer.";
  return "Impossible de réserver un crédit d'image.";
}

/**
 * Enveloppe une génération d'image avec la logique de crédits.
 * - Facturation non configurée → laisse passer (dev).
 * - Sinon : authentification requise, réservation atomique, puis
 *   consommation (image produite) ou restitution (échec).
 */
export async function withCredits<T extends { imageUrl?: string; imageDataUrl?: string; model?: string }>(
  request: Request,
  meta: GenerationMeta,
  run: () => Promise<T>,
): Promise<Outcome<T>> {
  // Tant que Stripe n'est pas configuré, aucun abonnement ne peut exister :
  // on n'impose pas de crédit (évite de bloquer le dev / la démo).
  if (!isStripeConfigured()) {
    const result = await run();
    return { ok: true, result };
  }

  const userId = await userIdFromRequest(request);
  if (!userId) return { ok: false, status: 401, error: "Connecte-toi pour générer des images." };

  const sb = getServiceSupabase();

  // Réservation atomique d'un crédit.
  let generationId: string;
  const reserved = await sb.rpc("reserve_credits", {
    p_user_id: userId,
    p_credits: 1,
    p_operation_type: meta.operationType ?? "generate",
    p_model: meta.model ?? null,
    p_quality: meta.quality ?? null,
    p_dimensions: meta.dimensions ?? null,
    p_reference_images: meta.referenceImages ?? 0,
  });
  if (reserved.error) return { ok: false, status: 402, error: creditErrorMessage(reserved.error) };
  generationId = reserved.data as string;

  try {
    const result = await run();
    const produced = result?.imageUrl || result?.imageDataUrl ? 1 : 0;
    await sb.rpc("settle_credits", {
      p_generation_id: generationId,
      p_images_produced: produced,
      p_openai_cost_cents: produced * ESTIMATED_IMAGE_COST_CENTS,
      p_openai_request_id: null,
      p_usage_data: result?.model ? { model: result.model } : {},
    });
    if (produced === 0) return { ok: false, status: 502, error: "Le service n'a produit aucune image (crédit restitué)." };
    return { ok: true, result };
  } catch (error) {
    // Échec → restitution du crédit réservé.
    await sb.rpc("release_credits", { p_generation_id: generationId });
    throw error;
  }
}
