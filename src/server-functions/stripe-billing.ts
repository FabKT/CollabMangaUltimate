import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Stripe from "stripe";
import {
  getStripe,
  getServiceSupabase,
  priceIdForPlan,
  appUrl,
  isStripeConfigured,
} from "@/lib/stripe-server";
import { PLANS, TERMS_VERSION, isPlanId, type PlanId } from "@/lib/billing-plans";

/** Vérifie le jeton d'accès Supabase envoyé par le client et renvoie l'utilisateur. */
async function requireUser(accessToken: string): Promise<{ id: string; email: string | undefined }> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Session invalide : reconnecte-toi.");
  return { id: data.user.id, email: data.user.email ?? undefined };
}

async function ensureCustomer(userId: string, email: string | undefined): Promise<string> {
  const sb = getServiceSupabase();
  const stripe = getStripe();
  const { data: sub } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await sb.from("subscriptions").upsert(
    { user_id: userId, stripe_customer_id: customer.id, status: "incomplete", updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return customer.id;
}

const checkoutSchema = z.object({
  plan: z.string(),
  accessToken: z.string().min(1),
  ip: z.string().optional(),
  /** Origine du client (window.location.origin) → on y renvoie après paiement,
   *  pour rester sur la même origine et préserver la session. */
  origin: z.string().optional(),
});

/** Base de redirection : l'origine du client si fournie et valide, sinon APP_URL. */
function returnBase(origin: string | undefined): string {
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, "");
  return appUrl();
}

/**
 * Démarre un abonnement (paiement initial) ou une montée en gamme via Stripe Checkout.
 * Retourne l'URL de paiement Stripe. Le quota n'est attribué qu'au webhook invoice.paid.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isStripeConfigured()) throw new Error("Stripe n'est pas encore configuré côté serveur.");
    if (!isPlanId(data.plan)) throw new Error("Plan inconnu.");
    const plan: PlanId = data.plan;
    const user = await requireUser(data.accessToken);
    const sb = getServiceSupabase();
    const stripe = getStripe();
    const base = returnBase(data.origin);

    const customerId = await ensureCustomer(user.id, user.email);

    // État actuel : décide entre premier abonnement, montée immédiate ou baisse programmée.
    const { data: sub } = await sb
      .from("subscriptions")
      .select("id, plan, status, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const hasActive = sub?.status === "active" && sub?.stripe_subscription_id;
    const currentPlan = sub?.plan as PlanId | undefined;

    // Consentement enregistré avant tout paiement (§26).
    const consentType = !hasActive ? "initial" : PLANS[plan].amountCents > PLANS[currentPlan ?? "starter"].amountCents ? "upgrade" : "downgrade";
    await sb.from("billing_consents").insert({
      user_id: user.id,
      consent_type: consentType,
      plan,
      terms_version: TERMS_VERSION,
      terms_text: consentText(plan, consentType),
      ip: data.ip ?? null,
    });

    // Montée en gamme immédiate : facturation complète tout de suite, cycle réinitialisé (§9-§13).
    if (hasActive && consentType === "upgrade" && sub?.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const itemId = subscription.items.data[0]?.id;
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: itemId, price: priceIdForPlan(plan) }],
        proration_behavior: "none",
        billing_cycle_anchor: "now",
        metadata: { user_id: user.id },
      });
      return { mode: "immediate" as const, url: `${base}/ai/plan?upgraded=1` };
    }

    // Baisse de gamme : appliquée au prochain renouvellement, sans facturation immédiate (§16).
    if (hasActive && consentType === "downgrade" && sub?.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const itemId = subscription.items.data[0]?.id;
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: itemId, price: priceIdForPlan(plan) }],
        proration_behavior: "none",
        metadata: { user_id: user.id },
      });
      await sb.from("subscriptions").update({ scheduled_downgrade_plan: plan, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return { mode: "scheduled" as const, url: `${base}/ai/plan?downgrade=1` };
    }

    // Premier abonnement : session Checkout Stripe.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id, plan } },
      metadata: { user_id: user.id, plan },
      success_url: `${base}/ai/plan?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/ai/plan?canceled=1`,
    });
    return { mode: "checkout" as const, url: session.url };
  });

const tokenSchema = z.object({ accessToken: z.string().min(1) });

/** Données du tableau de bord d'abonnement de l'utilisateur (§29). */
export const getMyBilling = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isStripeConfigured()) return { configured: false as const };
    const user = await requireUser(data.accessToken);
    const sb = getServiceSupabase();

    const { data: sub } = await sb.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    const { data: period } = await sb
      .from("subscription_periods")
      .select("*")
      .eq("user_id", user.id)
      .eq("tech_status", "active")
      .maybeSingle();

    const quota = period?.quota_initial ?? 0;
    const used = period?.credits_used ?? 0;
    const reserved = period?.credits_reserved ?? 0;

    return {
      configured: true as const,
      subscription: sub
        ? {
            plan: sub.plan as PlanId | null,
            status: sub.status as string,
            cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
            scheduledDowngrade: (sub.scheduled_downgrade_plan ?? null) as PlanId | null,
          }
        : null,
      period: period
        ? {
            plan: period.plan as PlanId,
            startedAt: period.started_at as string,
            renewalAt: period.planned_end_at as string,
            quota,
            used,
            reserved,
            remaining: Math.max(quota - used - reserved, 0),
          }
        : null,
    };
  });

/** Annule le renouvellement (l'accès reste jusqu'à la fin de la période payée, §17). */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isStripeConfigured()) throw new Error("Stripe n'est pas configuré.");
    const user = await requireUser(data.accessToken);
    const sb = getServiceSupabase();
    const stripe = getStripe();
    const { data: sub } = await sb.from("subscriptions").select("stripe_subscription_id").eq("user_id", user.id).maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("Aucun abonnement actif.");
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    await sb.from("subscriptions").update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return { ok: true };
  });

function consentText(plan: PlanId, type: "initial" | "upgrade" | "downgrade"): string {
  const p = PLANS[plan];
  if (type === "upgrade") {
    return `En passant immédiatement au plan ${p.label}, vos crédits actuels expireront. Vous paierez ${p.priceEuros.toFixed(2)} € aujourd'hui et recevrez immédiatement ${p.quota} crédits. Renouvellement mensuel à la date d'aujourd'hui au tarif de ${p.priceEuros.toFixed(2)} €. Crédits non reportés, non remboursables.`;
  }
  if (type === "downgrade") {
    return `Passage au plan ${p.label} au prochain renouvellement. Vous conservez votre plan actuel jusqu'à la fin de la période payée. Ensuite : ${p.quota} crédits pour ${p.priceEuros.toFixed(2)} €/mois.`;
  }
  return `Abonnement ${p.label} : ${p.priceEuros.toFixed(2)} €/mois pour ${p.quota} crédits. Renouvellement automatique. Un crédit par image produite. Crédits non reportés, non remboursables. Service numérique démarrant immédiatement.`;
}
