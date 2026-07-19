import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServiceSupabase, isStripeConfigured } from "@/lib/stripe-server";
import { isLocalAiServerMode } from "@/lib/local-ai-mode";

function env(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env[name]) return process.env[name];
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name];
}

/** E-mails autorisés à voir les tableaux administrateur (ADMIN_EMAILS, séparés par virgule). */
function adminEmails(): string[] {
  return (env("ADMIN_EMAILS") || "lafamilletayou@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(accessToken: string): Promise<void> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || !adminEmails().includes(email))
    throw new Error("Accès administrateur refusé.");
}

const tokenSchema = z.object({ accessToken: z.string().optional().default("") });

async function generationStats() {
  const result = await getServiceSupabase()
    .from("ai_generation_metrics")
    .select("cost_usd,cost_source,images_produced,created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (result.error) {
    return {
      available: false as const,
      count: 0,
      totalCostUsd: 0,
      minimumCostUsd: 0,
      maximumCostUsd: 0,
      averageCostUsd: 0,
      backendReported: 0,
      estimated: 0,
    };
  }

  const rows = result.data ?? [];
  const costs = rows
    .map((row) => Number(row.cost_usd))
    .filter((cost) => Number.isFinite(cost) && cost >= 0);
  const count = rows.reduce((total, row) => total + (Number(row.images_produced) || 0), 0);
  const totalCostUsd = costs.reduce((total, cost) => total + cost, 0);
  return {
    available: true as const,
    count,
    totalCostUsd,
    minimumCostUsd: costs.length ? Math.min(...costs) : 0,
    maximumCostUsd: costs.length ? Math.max(...costs) : 0,
    averageCostUsd: costs.length ? totalCostUsd / costs.length : 0,
    backendReported: rows.filter((row) => row.cost_source === "backend_reported").length,
    estimated: rows.filter((row) => row.cost_source === "official_output_estimate").length,
  };
}

/** Tableaux administrateur : global (§32) + par utilisateur (§30) + par période (§31). */
export const getAdminBilling = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const localMode = isLocalAiServerMode();
    if (!localMode) await requireAdmin(data.accessToken);
    const metrics = await generationStats();
    if (!isStripeConfigured()) return { configured: false as const, localMode, metrics };
    const sb = getServiceSupabase();

    const [globalRes, usersRes, periodsRes, subsRes] = await Promise.all([
      sb.from("admin_global_stats").select("*").maybeSingle(),
      sb.from("admin_user_rows").select("*").order("started_at", { ascending: false }),
      sb
        .from("admin_period_rows")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1000),
      sb.from("subscriptions").select("status, cancel_at_period_end, scheduled_downgrade_plan"),
    ]);

    const subs = subsRes.data ?? [];
    const counts = {
      active: subs.filter((s) => s.status === "active").length,
      canceled: subs.filter((s) => s.status === "canceled").length,
      pastDue: subs.filter((s) => s.status === "past_due").length,
      cancelScheduled: subs.filter((s) => s.cancel_at_period_end).length,
      downgradeScheduled: subs.filter((s) => s.scheduled_downgrade_plan).length,
    };

    return {
      configured: true as const,
      localMode,
      metrics,
      global: globalRes.data ?? null,
      users: usersRes.data ?? [],
      periods: periodsRes.data ?? [],
      counts,
    };
  });

/** Indique si l'utilisateur courant est administrateur (pour afficher/masquer le lien). */
export const amIAdmin = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (isLocalAiServerMode()) return { admin: true };
    try {
      await requireAdmin(data.accessToken);
      return { admin: true };
    } catch {
      return { admin: false };
    }
  });
