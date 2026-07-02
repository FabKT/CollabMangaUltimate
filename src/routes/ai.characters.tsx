import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, Label, Input, Textarea, Chip, SectionTitle } from "@/components/cma/Layout";
import { UserSquare2, Plus, Upload, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/ai/characters")({
  head: () => ({ meta: [{ title: "Character Studio — CollabManga AI" }] }),
  component: CharacterStudio,
});

const views = [
  { label: "Front view", status: "done" },
  { label: "Side profile", status: "done" },
  { label: "Back view", status: "pending" },
  { label: "Three-quarter", status: "pending" },
  { label: "Expressions", status: "in_progress" },
  { label: "Outfit variations", status: "pending" },
  { label: "Accessories", status: "pending" },
  { label: "Color notes", status: "done" },
];

function CharacterStudio() {
  return (
    <>
      <PageHeader
        title="Character Studio"
        description="Build stable, reusable characters with multi-view consistency."
        actions={
          <>
            <button className="cma-btn-secondary"><Upload size={16} /> Upload base</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> Save character</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6">
        <div className="flex flex-col gap-6">
          {/* Main preview */}
          <Panel>
            <SectionTitle right={<span className="cma-chip">Identity locked</span>}>
              Character preview
            </SectionTitle>
            <div className="aspect-[16/10] grid place-items-center" style={{ background: "var(--bg-stage)", borderRadius: 14, border: "1px solid var(--border-default)" }}>
              <UserSquare2 size={40} style={{ color: "var(--text-muted)" }} />
            </div>
          </Panel>

          {/* Views grid */}
          <Panel>
            <SectionTitle right={<button className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}><Plus size={14} /> Add view</button>}>
              Character sheet
            </SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {views.map((v) => (
                <Card key={v.label} padding={12} selected={v.status === "in_progress"}>
                  <div className="aspect-[3/4] grid place-items-center mb-3" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                    <UserSquare2 size={22} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-bold truncate">{v.label}</div>
                    <StatusDot status={v.status} />
                  </div>
                  <button className="cma-btn-secondary mt-3 w-full justify-center" style={{ height: 34, padding: "0 12px" }}>
                    {v.status === "done" ? "Refine" : "Generate"}
                  </button>
                </Card>
              ))}
            </div>
          </Panel>
        </div>

        {/* Details */}
        <Panel>
          <SectionTitle>Character details</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>Name</Label><Input placeholder="Character name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Age</Label><Input placeholder="18" /></div>
              <div><Label>Height</Label><Input placeholder="172cm" /></div>
            </div>
            <div><Label>Body proportions</Label><Input placeholder="Athletic, lean…" /></div>
            <div><Label>Outfit</Label><Textarea placeholder="Describe primary outfit…" /></div>
            <div><Label>Accessories</Label><Input placeholder="Earring, scarf…" /></div>
            <div><Label>Color notes</Label><Input placeholder="Black hair, jade eyes…" /></div>
            <div><Label>Personality</Label><Textarea placeholder="Personality notes" /></div>
            <div>
              <Label>Identity constraints</Label>
              <div className="flex flex-wrap gap-2">
                {["Keep face", "Keep hair", "Keep outfit", "Keep eyes"].map((t, i) => (
                  <Chip key={t} active={i < 2}>{t}</Chip>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { c: string; label: string }> = {
    done: { c: "var(--neon)", label: "Done" },
    in_progress: { c: "var(--warning)", label: "In progress" },
    pending: { c: "var(--text-disabled)", label: "Pending" },
  };
  const v = map[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
      {status === "done" ? <Check size={12} color={v.c} /> : <span style={{ width: 8, height: 8, borderRadius: 999, background: v.c }} />}
      {v.label}
    </span>
  );
}
