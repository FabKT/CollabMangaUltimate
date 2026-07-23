/**
 * Intégration Stripe — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Ne jamais importer ce fichier depuis du code client : il lit la clé secrète
 * Stripe et la clé service-role Supabase (bypass RLS pour les écritures webhook).
 *
 * Variables d'environnement attendues (dans .env.local en dev, secrets serveur en prod) :
 *   STRIPE_SECRET_KEY          clé secrète Stripe (sk_test_… en test)
 *   STRIPE_WEBHOOK_SECRET      secret de signature du endpoint webhook (whsec_…)
 *   STRIPE_PRICE_STARTER       price_id du plan Starter (price_…)
 *   STRIPE_PRICE_CREATOR       price_id du plan Creator
 *   STRIPE_PRICE_STUDIO        price_id du plan Studio
 *   SUPABASE_SERVICE_ROLE_KEY  clé service-role Supabase (écritures webhook)
 *   VITE_SUPABASE_URL          URL du projet Supabase (déjà présente)
 *   APP_URL                    URL publique de l'app (redirections Checkout)
 */

import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLANS, type PlanId, type PlanConfig } from "./billing-plans";

function databaseError(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function env(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env[name]) return process.env[name];
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name];
}

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant côté serveur.");
  const mode = stripeMode();
  if (mode === "live" && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_MODE=live requires a live Stripe secret key.");
  }
  if (mode === "test" && !key.startsWith("sk_test_")) {
    throw new Error("STRIPE_MODE=test requires a test Stripe secret key.");
  }
  stripeClient = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_CREATOR",
    "STRIPE_PRICE_STUDIO",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].every((name) => Boolean(env(name)));
}

export function stripeMode(): "test" | "live" {
  // The secret key is the authoritative Stripe environment. This also keeps
  // manually packaged Netlify functions safe when a deploy context variable
  // is unavailable at runtime.
  const key = env("STRIPE_SECRET_KEY");
  if (key?.startsWith("sk_live_")) return "live";
  if (key?.startsWith("sk_test_")) return "test";

  const explicit = env("STRIPE_MODE");
  if (explicit === "test" || explicit === "live") return explicit;
  return env("NODE_ENV") === "production" ? "live" : "test";
}

export function requiresBillingConfiguration(): boolean {
  return stripeMode() === "live" || env("NODE_ENV") === "production";
}

let serviceClient: SupabaseClient | null = null;
/** Client Supabase service-role : écritures serveur qui contournent la RLS. */
export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL manquants côté serveur.");
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export function priceIdForPlan(plan: PlanId): string {
  const id = env(PLANS[plan].priceEnv);
  if (!id)
    throw new Error(
      `${PLANS[plan].priceEnv} manquant : crée le Price ${plan} dans Stripe et renseigne la variable.`,
    );
  return id;
}

/** Table inverse price_id → plan, pour le webhook. */
export function planForPriceId(priceId: string): PlanConfig | null {
  for (const plan of Object.values(PLANS)) {
    if (env(plan.priceEnv) === priceId) return plan;
  }
  return null;
}

export function appUrl(): string {
  return (env("APP_URL") || "http://localhost:8093").replace(/\/+$/, "");
}

// ============================================================
// Traitement du webhook Stripe (corps brut + signature)
// ============================================================

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET manquant", { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    return new Response(`Signature invalide : ${err instanceof Error ? err.message : "erreur"}`, {
      status: 400,
    });
  }

  const sb = getServiceSupabase();

  // Idempotence : un événement Stripe n'est traité qu'une seule fois (§27/§28).
  const { error: insertError } = await sb.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  if (insertError) {
    // Doublon (clé primaire) → déjà traité, on acquitte sans rejouer.
    if (insertError.code === "23505") return new Response("Déjà traité", { status: 200 });
    return new Response(`Erreur idempotence : ${insertError.message}`, { status: 500 });
  }

  try {
    await dispatchEvent(stripe, sb, event);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err);
    // On supprime la trace d'idempotence pour permettre un rejeu par Stripe.
    await sb.from("stripe_events").delete().eq("id", event.id);
    return new Response(
      `Erreur de traitement : ${err instanceof Error ? err.message : "inconnue"}`,
      { status: 500 },
    );
  }
}

async function dispatchEvent(
  stripe: Stripe,
  sb: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(stripe, sb, event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await onInvoicePaid(stripe, sb, event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await onInvoiceFailed(sb, event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
      await onSubscriptionUpdated(sb, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(sb, event.data.object as Stripe.Subscription);
      break;
    case "charge.dispute.created":
    case "charge.dispute.closed":
      await onDispute(sb, event.data.object as Stripe.Dispute);
      break;
    default:
      // Événement non géré : acquitté (déjà enregistré dans stripe_events).
      break;
  }
}

/** Lie le client Stripe à l'utilisateur et enregistre l'abonnement (sans attribuer de quota). */
async function onCheckoutCompleted(
  stripe: Stripe,
  sb: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id;
  if (!userId) return;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
  const status =
    subscription?.status === "active" || subscription?.status === "trialing"
      ? "active"
      : subscription?.status === "past_due"
        ? "past_due"
        : "incomplete";

  const { error } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  databaseError("Enregistrement de l'abonnement Checkout impossible", error);
  // Le quota est attribué par invoice.paid (paiement réellement confirmé, §4).
}

/** Extrait l'id d'abonnement d'une facture, quelle que soit la version d'API Stripe.
 *  (Depuis 2026-04-22, `invoice.subscription` est retiré → `parent.subscription_details`.) */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const pick = (v: unknown): string | undefined =>
    typeof v === "string" ? v : (v as { id?: string } | undefined)?.id;
  const inv = invoice as unknown as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
    lines?: {
      data?: Array<{
        subscription?: unknown;
        parent?: { subscription_item_details?: { subscription?: unknown } };
      }>;
    };
  };
  const line = inv.lines?.data?.[0];
  return (
    pick(inv.subscription) ||
    pick(inv.parent?.subscription_details?.subscription) ||
    pick(line?.subscription) ||
    pick(line?.parent?.subscription_item_details?.subscription)
  );
}

/** Paiement confirmé (initial, renouvellement ou montée en gamme) → ouvre une période payée. */
async function onInvoicePaid(
  stripe: Stripe,
  sb: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;
  const plan = planForPriceId(priceId);
  if (!plan) throw new Error(`Price inconnu ${priceId} : mapping plan absent.`);

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = subscription.metadata?.user_id || (await userIdForCustomer(sb, customerId));
  if (!userId) throw new Error("Impossible d'associer la facture à un utilisateur.");

  // Plan courant AVANT mise à jour → sert à déterminer le motif de clôture.
  const { data: before, error: beforeError } = await sb
    .from("subscriptions")
    .select("id, plan")
    .eq("user_id", userId)
    .maybeSingle();
  databaseError("Lecture de l'abonnement avant paiement impossible", beforeError);
  const previousPlan = before?.plan as PlanId | undefined;
  let closeReason: "renewal" | "upgrade" | "downgrade" = "renewal";
  if (previousPlan && previousPlan !== plan.id) {
    closeReason =
      PLANS[plan.id].amountCents > PLANS[previousPlan].amountCents ? "upgrade" : "downgrade";
  }

  // Enregistre / met à jour la ligne d'abonnement (purge un éventuel downgrade programmé désormais appliqué).
  const { error: subscriptionError } = await sb.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: plan.id,
      status: "active",
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      scheduled_downgrade_plan: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  databaseError("Mise à jour de l'abonnement payé impossible", subscriptionError);
  const { data: subRow, error: subRowError } = await sb
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .single();
  databaseError("Lecture de l'abonnement payé impossible", subRowError);

  const line = invoice.lines?.data?.[0];
  const periodEndUnix = line?.period?.end ?? subEndUnix(subscription);
  const periodEnd = new Date(
    (periodEndUnix ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000,
  ).toISOString();

  const { data: newPeriodId, error: periodError } = await sb.rpc("open_paid_period", {
    p_user_id: userId,
    p_subscription_id: subRow?.id ?? null,
    p_plan: plan.id,
    p_quota: plan.quota,
    p_price_cents: invoice.amount_paid ?? plan.amountCents,
    p_currency: invoice.currency ?? "eur",
    p_period_end: periodEnd,
    p_invoice_id: invoice.id,
    p_close_reason: closeReason,
  });
  databaseError("Attribution du quota payé impossible", periodError);
  if (!newPeriodId) throw new Error("Attribution du quota payé sans identifiant de période.");

  // Frais Stripe réels de cette facture → injectés dans la période (marge exacte).
  const feeCents = await stripeFeeForInvoice(stripe, invoice);
  if (newPeriodId && feeCents > 0) {
    const { error: feeError } = await sb
      .from("subscription_periods")
      .update({ stripe_fees_cents: feeCents })
      .eq("id", newPeriodId);
    databaseError("Enregistrement des frais Stripe impossible", feeError);
  }
}

/** Frais Stripe réels d'une facture (via la balance transaction de la charge). */
async function stripeFeeForInvoice(stripe: Stripe, invoice: Stripe.Invoice): Promise<number> {
  try {
    const anyInv = invoice as unknown as {
      charge?: string | { id?: string };
      payment_intent?: string | { id?: string };
    };
    let chargeId = typeof anyInv.charge === "string" ? anyInv.charge : anyInv.charge?.id;
    if (!chargeId) {
      const piId =
        typeof anyInv.payment_intent === "string"
          ? anyInv.payment_intent
          : anyInv.payment_intent?.id;
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId);
        chargeId = (pi as unknown as { latest_charge?: string }).latest_charge;
      }
    }
    if (!chargeId) return 0;
    const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    const bt = charge.balance_transaction;
    return bt && typeof bt !== "string" ? bt.fee : 0;
  } catch {
    return 0;
  }
}

async function onInvoiceFailed(sb: SupabaseClient, invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  // Aucun quota, aucune période : on marque seulement l'abonnement en impayé (§7/§8).
  const { error } = await sb
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
  databaseError("Mise à jour de l'impayé impossible", error);
}

async function onSubscriptionUpdated(
  sb: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await sb
    .from("subscriptions")
    .update({
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      status:
        subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : subscription.status === "canceled" ||
                subscription.status === "unpaid" ||
                subscription.status === "incomplete_expired"
              ? "canceled"
              : "incomplete",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
  databaseError("Synchronisation de l'abonnement impossible", error);
}

async function onSubscriptionDeleted(
  sb: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  const { error } = await sb
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
  databaseError("Enregistrement de la résiliation impossible", error);
}

async function onDispute(sb: SupabaseClient, dispute: Stripe.Dispute): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  const { error } = await sb.from("billing_disputes").upsert(
    {
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      amount_cents: dispute.amount ?? 0,
      status: dispute.status ?? "open",
      resolution: dispute.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_dispute_id" },
  );
  databaseError("Enregistrement du litige impossible", error);
}

async function userIdForCustomer(sb: SupabaseClient, customerId: string): Promise<string | null> {
  const { data, error } = await sb
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  databaseError("Association du client Stripe impossible", error);
  return data?.user_id ?? null;
}

function subEndUnix(subscription: Stripe.Subscription): number | undefined {
  const anySub = subscription as unknown as { current_period_end?: number };
  return anySub.current_period_end;
}
