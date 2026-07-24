import { supabase } from "./supabase";
import { getMyBilling } from "@/server-functions/stripe-billing";

export type BillingSnapshot = Awaited<ReturnType<typeof getMyBilling>>;

const CACHE_TTL_MS = 30_000;
const RETRY_DELAYS_MS = [0, 350, 900, 1_800];

type CachedBilling = {
  value: BillingSnapshot;
  fetchedAt: number;
};

const cache = new Map<string, CachedBilling>();
const inFlight = new Map<string, Promise<BillingSnapshot>>();

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => window.setTimeout(resolve, ms)) : Promise.resolve();
}

async function requestBilling(accessToken: string): Promise<BillingSnapshot> {
  let lastError: unknown;

  for (const waitMs of RETRY_DELAYS_MS) {
    await delay(waitMs);
    try {
      const result = await getMyBilling({ data: { accessToken } });
      if (!result.configured) {
        throw new Error("Le service de facturation n'est pas configuré.");
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Impossible de vérifier l'abonnement.");
}

/**
 * Charge l'état Stripe/Supabase sans multiplier les appels concurrents.
 * Une panne réseau ne remplace jamais un dernier état confirmé par un faux
 * abonnement vide.
 */
export async function loadMyBilling(options?: {
  force?: boolean;
  allowCachedFallback?: boolean;
}): Promise<BillingSnapshot> {
  if (!supabase) throw new Error("Le service d'authentification n'est pas configuré.");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error("Session invalide : reconnecte-toi.");

  const userId = session.user.id;
  const cached = cache.get(userId);
  if (!options?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const pending = inFlight.get(userId);
  if (pending) return pending;

  const request = requestBilling(session.access_token)
    .then((value) => {
      cache.set(userId, { value, fetchedAt: Date.now() });
      return value;
    })
    .catch((error) => {
      if (options?.allowCachedFallback !== false && cached) return cached.value;
      throw error;
    })
    .finally(() => {
      inFlight.delete(userId);
    });

  inFlight.set(userId, request);
  return request;
}

export function clearBillingCache(): void {
  cache.clear();
  inFlight.clear();
}
