import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Panel, SectionTitle } from "@/components/cma/Layout";
import { Download, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAdminBilling } from "@/server-functions/admin-billing";

export const Route = createFileRoute("/ai/admin")({
  head: () => ({ meta: [{ title: "Admin — Facturation CollabManga AI" }] }),
  component: AdminBilling,
});

type AdminData = Awaited<ReturnType<typeof getAdminBilling>>;
type Row = Record<string, unknown>;

const eur = (cents: unknown) => `${((Number(cents) || 0) / 100).toFixed(2)} €`;
const num = (v: unknown) => String(Number(v) || 0);
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
}

function downloadCsv(filename: string, rows: Row[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminBilling() {
  const [data, setData] = useState<AdminData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      const token = await accessToken();
      if (!token) {
        setState("denied");
        return;
      }
      try {
        const res = await getAdminBilling({ data: { accessToken: token } });
        setData(res);
        setState("ready");
      } catch {
        setState("denied");
      }
    })();
  }, []);

  const periods = useMemo(() => {
    const list = (data?.configured ? (data.periods as Row[]) : []) ?? [];
    return list.filter(
      (p) => (planFilter === "all" || p.plan === planFilter) && (statusFilter === "all" || p.tech_status === statusFilter),
    );
  }, [data, planFilter, statusFilter]);

  if (state === "loading") {
    return (
      <>
        <PageHeader title="Admin — Facturation" description="Chargement…" />
      </>
    );
  }

  if (state === "denied") {
    return (
      <>
        <PageHeader title="Admin — Facturation" />
        <Panel>
          <div className="flex items-center gap-3 text-[14px]" style={{ color: "var(--warning)" }}>
            <ShieldAlert size={18} /> Accès réservé aux administrateurs.
          </div>
        </Panel>
      </>
    );
  }

  if (data && !data.configured) {
    return (
      <>
        <PageHeader title="Admin — Facturation" />
        <Panel>
          <div className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Stripe n'est pas configuré : aucune donnée de facturation.
          </div>
        </Panel>
      </>
    );
  }

  const g = (data?.configured ? data.global : null) as Row | null;
  const users = (data?.configured ? (data.users as Row[]) : []) ?? [];
  const counts = data?.configured ? data.counts : { active: 0, canceled: 0, pastDue: 0, cancelScheduled: 0, downgradeScheduled: 0 };

  const globalCards: { label: string; value: string }[] = [
    { label: "Chiffre d'affaires brut", value: eur(g?.gross_revenue_cents) },
    { label: "CA net (après frais Stripe)", value: eur(g?.net_revenue_cents) },
    { label: "Revenu en attente", value: eur(g?.pending_revenue_cents) },
    { label: "Coûts OpenAI", value: eur(g?.openai_cost_cents) },
    { label: "Marge estimée", value: eur(g?.margin_estimated_cents) },
    { label: "Marge réalisée", value: eur(g?.margin_realized_cents) },
    { label: "Crédits vendus", value: num(g?.credits_sold) },
    { label: "Crédits utilisés", value: num(g?.credits_used) },
    { label: "Crédits expirés", value: num(g?.credits_expired) },
    { label: "Abonnements actifs", value: num(counts.active) },
    { label: "Annulations programmées", value: num(counts.cancelScheduled) },
    { label: "Montées / baisses", value: `${num(g?.upgrades)} / ${num(g?.downgrades)}` },
  ];

  return (
    <>
      <PageHeader
        title="Admin — Facturation"
        description="Vue d'ensemble des abonnements, crédits, coûts et marges."
      />

      <SectionTitle>Global</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {globalCards.map((c) => (
          <Panel key={c.label}>
            <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{c.label}</div>
            <div className="mt-1" style={{ font: "700 22px/28px var(--font-display)" }}>{c.value}</div>
          </Panel>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <SectionTitle>Par utilisateur ({users.length})</SectionTitle>
        <button className="cma-btn-secondary" onClick={() => downloadCsv("collabmanga-utilisateurs.csv", users)}><Download size={15} /> CSV</button>
      </div>
      <Panel className="mb-6 overflow-x-auto">
        <table className="w-full text-[13px]" style={{ color: "var(--text-secondary)", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
              {["Utilisateur", "Plan", "Statut", "Renouv.", "Crédits (util./accord.)", "Expirés", "Payé", "Frais Stripe", "Coût OpenAI", "Marge réalisée", "Générations"].map((h) => (
                <th key={h} className="py-2 pr-4 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={11} className="py-4">Aucun abonné pour l'instant.</td></tr>
            )}
            {users.map((u) => (
              <tr key={String(u.user_id)} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td className="py-2 pr-4 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{String(u.username ?? "—")}</td>
                <td className="py-2 pr-4">{String(u.plan ?? "—")}</td>
                <td className="py-2 pr-4">{String(u.status ?? "—")}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{date(u.renewal_at)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{num(u.credits_used_total)} / {num(u.credits_granted_total)}</td>
                <td className="py-2 pr-4">{num(u.credits_expired_total)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{eur(u.paid_total_cents)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{eur(u.stripe_fees_total_cents)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{eur(u.openai_cost_total_cents)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{eur(u.margin_realized_total_cents)}</td>
                <td className="py-2 pr-4">{num(u.generation_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <SectionTitle>Par période ({periods.length})</SectionTitle>
        <div className="flex items-center gap-2">
          <select className="cma-input !h-9" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="all">Tous les plans</option>
            <option value="starter">Starter</option>
            <option value="creator">Creator</option>
            <option value="studio">Studio</option>
          </select>
          <select className="cma-input !h-9" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="payment_failed">Payment failed</option>
            <option value="disputed">Disputed</option>
          </select>
          <button className="cma-btn-secondary" onClick={() => downloadCsv("collabmanga-periodes.csv", periods)}><Download size={15} /> CSV</button>
        </div>
      </div>
      <Panel className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ color: "var(--text-secondary)", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
              {["Utilisateur", "Plan", "Début", "Fin prévue", "Clôture", "Motif", "Quota", "Util.", "Expirés", "Payé", "Frais", "OpenAI", "Marge est.", "Marge réal.", "Tech", "Fin."].map((h) => (
                <th key={h} className="py-2 pr-3 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr><td colSpan={16} className="py-4">Aucune période.</td></tr>
            )}
            {periods.map((p) => (
              <tr key={String(p.id)} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{String(p.username ?? "—")}</td>
                <td className="py-2 pr-3">{String(p.plan)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{date(p.started_at)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{date(p.planned_end_at)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{date(p.closed_at)}</td>
                <td className="py-2 pr-3">{String(p.close_reason ?? "—")}</td>
                <td className="py-2 pr-3">{num(p.quota_initial)}</td>
                <td className="py-2 pr-3">{num(p.credits_used)}</td>
                <td className="py-2 pr-3">{num(p.credits_expired)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{eur(p.price_paid_cents)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{eur(p.stripe_fees_cents)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{eur(p.openai_cost_cents)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{eur(p.margin_estimated_cents)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.margin_realized_cents === null ? "—" : eur(p.margin_realized_cents)}</td>
                <td className="py-2 pr-3">{String(p.tech_status)}</td>
                <td className="py-2 pr-3">{String(p.financial_status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
