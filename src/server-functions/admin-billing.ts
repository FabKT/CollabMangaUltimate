import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServiceSupabase, isStripeConfigured } from "@/lib/stripe-server";

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
  if (error || !email || !adminEmails().includes(email)) throw new Error("Accès administrateur refusé.");
}

const tokenSchema = z.object({ accessToken: z.string().min(1) });

/** Tableaux administrateur : global (§32) + par utilisateur (§30) + par période (§31). */
export const getAdminBilling = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isStripeConfigured()) return { configured: false as const };
    await requireAdmin(data.accessToken);
    const sb = getServiceSupabase();

    const [globalRes, usersRes, periodsRes, subsRes] = await Promise.all([
      sb.from("admin_global_stats").select("*").maybeSingle(),
      sb.from("admin_user_rows").select("*").order("started_at", { ascending: false }),
      sb.from("admin_period_rows").select("*").order("started_at", { ascending: false }).limit(1000),
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
    try {
      await requireAdmin(data.accessToken);
      return { admin: true };
    } catch {
      return { admin: false };
    }
  });
