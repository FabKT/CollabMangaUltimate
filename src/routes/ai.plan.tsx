import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, SectionTitle, Chip } from "@/components/cma/Layout";
import { Check, Sparkles, Receipt } from "lucide-react";

export const Route = createFileRoute("/ai/plan")({
  head: () => ({ meta: [{ title: "Plan & Credits — CollabManga AI" }] }),
  component: PlanCredits,
});

const plans = [
  { name: "Starter", tagline: "For exploring CollabManga AI", price: "—", credits: "000 / cycle", features: ["Basic generations", "Character sheets", "Asset Library"], current: true },
  { name: "Creator", tagline: "For ongoing manga projects", price: "—", credits: "000 / cycle", features: ["Higher-priority generation", "Chapter Builder", "Style Transfer"], featured: true },
  { name: "Studio", tagline: "For teams and studios", price: "—", credits: "000 / cycle", features: ["Highest priority", "Advanced consistency", "Team library"] },
];

function PlanCredits() {
  return (
    <>
      <PageHeader
        title="Plan & Credits"
        description="Manage your CollabManga AI subscription and credit balance."
        actions={
          <>
            <button className="cma-btn-secondary"><Receipt size={16} /> Billing</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> Upgrade plan</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6 mb-6">
        <Panel>
          <SectionTitle right={<span className="cma-chip cma-chip-active">Active</span>}>Current plan</SectionTitle>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Plan</div>
              <div style={{ font: "700 28px/36px var(--font-display)" }}>Starter Plan</div>
              <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Renews on placeholder date</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</div>
              <div style={{ font: "700 28px/36px var(--font-display)" }}>—</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <span>Credits used</span>
              <span><strong style={{ color: "var(--text-primary)" }}>000</strong> / 000</span>
            </div>
            <div className="mt-2" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: "42%", height: "100%", borderRadius: 999, background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>What credits are used for</SectionTitle>
          <ul className="flex flex-col gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {[
              "Generating a manga page",
              "Generating a character view",
              "Style transfer per variant",
              "Scene preview generation",
              "Chapter outline generation",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check size={14} color="var(--neon)" /> {t}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <SectionTitle>Compare plans</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {plans.map((p) => (
          <Card key={p.name} padding={24} selected={p.featured}>
            <div className="flex items-center justify-between">
              <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{p.tagline}</div>
              {p.current && <Chip active>Current</Chip>}
            </div>
            <div className="mt-2" style={{ font: "700 22px/28px var(--font-display)" }}>{p.name}</div>
            <div className="mt-4 flex items-baseline gap-2">
              <span style={{ font: "700 32px/36px var(--font-display)", color: "var(--text-primary)" }}>{p.price}</span>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>placeholder</span>
            </div>
            <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>{p.credits}</div>
            <ul className="mt-5 flex flex-col gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2"><Check size={14} color="var(--neon)" /> {f}</li>
              ))}
            </ul>
            <button className={p.featured ? "cma-btn-primary w-full justify-center mt-6" : "cma-btn-secondary w-full justify-center mt-6"}>
              {p.current ? "Manage plan" : "Choose plan"}
            </button>
          </Card>
        ))}
      </div>

      <Panel>
        <SectionTitle>Billing history</SectionTitle>
        <div className="grid grid-cols-[1fr_140px_140px_120px] gap-4 px-1 pb-3 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}>
          <div>Description</div><div>Date</div><div>Amount</div><div className="text-right">Invoice</div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_140px_140px_120px] gap-4 items-center px-1 py-3 text-[13px]" style={{ borderBottom: "1px solid var(--border-default)" }}>
            <div>Subscription · placeholder</div>
            <div style={{ color: "var(--text-muted)" }}>—</div>
            <div>—</div>
            <div className="text-right"><button className="cma-btn-ghost" style={{ height: 32 }}>Download</button></div>
          </div>
        ))}
      </Panel>
    </>
  );
}
