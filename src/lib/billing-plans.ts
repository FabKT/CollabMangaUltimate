/**
 * Configuration des plans d'abonnement CollabManga AI.
 *
 * Ces constantes (quota, prix affiché, libellé) sont sûres côté client.
 * L'AUTORITÉ reste le serveur : le quota réellement attribué et le prix
 * réellement facturé proviennent du price_id Stripe côté serveur
 * (voir stripe-server.ts / PLAN_BY_PRICE). Le frontend ne fait jamais foi.
 */

export type PlanId = "starter" | "creator" | "studio";

export type PlanConfig = {
  id: PlanId;
  label: string;
  /** Prix mensuel affiché (euros). */
  priceEuros: number;
  /** Montant facturé en centimes (doit correspondre au Price Stripe). */
  amountCents: number;
  /** Crédits (générations d'images) attribués à chaque période payée. */
  quota: number;
  /** Variable d'environnement serveur contenant le price_id Stripe. */
  priceEnv: string;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    label: "Starter",
    priceEuros: 23.99,
    amountCents: 2399,
    quota: 80,
    priceEnv: "STRIPE_PRICE_STARTER",
  },
  creator: {
    id: "creator",
    label: "Creator",
    priceEuros: 79.99,
    amountCents: 7999,
    quota: 300,
    priceEnv: "STRIPE_PRICE_CREATOR",
  },
  studio: {
    id: "studio",
    label: "Studio",
    priceEuros: 299.99,
    amountCents: 29999,
    quota: 1200,
    priceEnv: "STRIPE_PRICE_STUDIO",
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "creator", "studio"];

export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** Un passage de `from` vers `to` est-il une montée en gamme (facturation immédiate) ? */
export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return planRank(to) > planRank(from);
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "creator" || value === "studio";
}

/** Version des conditions acceptées lors du paiement (à incrémenter si le texte change). */
export const TERMS_VERSION = "2026-07-16";
