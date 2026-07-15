import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, SectionTitle, Chip } from "@/components/cma/Layout";
import { Check, Sparkles, Receipt } from "lucide-react";

export const Route = createFileRoute("/ai/plan")({
  head: () => ({ meta: [{ title: "Plan & Images — CollabManga AI" }] }),
  component: PlanImages,
});

/**
 * Abonnements organisés par IMAGES générées (et non par crédits) :
 * chaque génération consomme 1 image du quota mensuel.
 */
const plans = [
  {
    name: "Starter",
    tagline: "For exploring CollabManga AI",
    price: "23,99 €",
    images: 80,
    features: ["80 images / mois", "Manga Page Creator", "Character Studio", "Bibliothèque d'assets"],
    current: true,
  },
  {
    name: "Creator",
    tagline: "For ongoing manga projects",
    price: "79,99 €",
    images: 300,
    features: ["300 images / mois", "Génération prioritaire", "Raw to Final", "Transfert de style"],
    featured: true,
  },
  {
    name: "Studio",
    tagline: "For teams and studios",
    price: "299,99 €",
    images: 1200,
    features: ["1200 images / mois", "Priorité maximale", "Cohérence avancée", "Bibliothèque d'équipe"],
  },
];

function PlanImages() {
  const current = plans.find((p) => p.current) ?? plans[0];
  return (
    <>
      <PageHeader
        title="Plan & Images"
        description="Gère ton abonnement CollabManga AI et ton quota d'images générées."
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
              <div style={{ font: "700 28px/36px var(--font-display)" }}>{current.name}</div>
              <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                {current.images} images incluses par mois
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</div>
              <div style={{ font: "700 28px/36px var(--font-display)" }}>{current.price}<span className="text-[13px]" style={{ color: "var(--text-muted)" }}> / mois</span></div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <span>Images utilisées ce mois-ci</span>
              <span><strong style={{ color: "var(--text-primary)" }}>0</strong> / {current.images}</span>
            </div>
            <div className="mt-2" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: "0%", height: "100%", borderRadius: 999, background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Ce qui consomme une image</SectionTitle>
          <ul className="flex flex-col gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {[
              "Génération d'une planche manga",
              "Génération d'une carte de personnage",
              "Variante de transfert de style",
              "Finalisation Raw to Final",
              "Génération de décor",
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
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>/ mois</span>
            </div>
            <div className="text-[13px] mt-1 font-bold" style={{ color: "var(--neon)" }}>{p.images} images / mois</div>
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
        <div className="px-1 py-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Aucune facture pour l'instant — l'historique apparaîtra après ton premier paiement.
        </div>
      </Panel>
    </>
  );
}
