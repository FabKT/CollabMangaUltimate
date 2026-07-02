import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Card, Input, Chip, SectionTitle } from "@/components/cma/Layout";
import { Search, Grid3x3, List, Image as ImageIcon, Plus, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/ai/assets")({
  head: () => ({ meta: [{ title: "Asset Library — CollabManga AI" }] }),
  component: AssetLibrary,
});

const cats = ["All", "Characters", "Backgrounds", "Objects", "References", "Generated Pages", "Style Variants", "Scenes"];

function AssetLibrary() {
  const [cat, setCat] = useState("All");
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <>
      <PageHeader
        title="Asset Library"
        description="All your reusable AI assets in one place."
        actions={
          <>
            <button className="cma-btn-secondary">Import</button>
            <button className="cma-btn-primary"><Plus size={16} /> New asset</button>
          </>
        }
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <Input placeholder="Search assets" style={{ paddingLeft: 38 }} />
          </div>
          <div className="flex items-center gap-1 p-1" style={{ background: "var(--bg-input)", borderRadius: 12, border: "1px solid var(--border-default)" }}>
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} icon={<Grid3x3 size={14} />} />
            <ViewBtn active={view === "list"} onClick={() => setView("list")} icon={<List size={14} />} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {cats.map((c) => (
            <Chip key={c} active={c === cat} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>
      </Panel>

      {view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <Card key={i} padding={12} selected={i === 0}>
              <div className="aspect-square grid place-items-center mb-3" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                <ImageIcon size={24} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate">Asset {i + 1}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last used —</div>
                </div>
                <span className="cma-chip" style={{ height: 22, padding: "0 8px" }}>
                  {["Char", "Bg", "Obj", "Ref"][i % 4]}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Panel padding={0}>
          <div className="grid grid-cols-[1fr_120px_140px_60px] gap-4 px-5 py-3 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}>
            <div>Asset</div><div>Type</div><div>Last used</div><div></div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_140px_60px] gap-4 items-center px-5 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-input)" }}>
                  <ImageIcon size={16} style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="text-[13px] font-bold truncate">Asset {i + 1}</div>
              </div>
              <Chip>{["Character","Background","Object","Reference"][i % 4]}</Chip>
              <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>—</div>
              <button className="cma-icon-btn"><MoreHorizontal size={14} /></button>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

function ViewBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center"
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: active ? "var(--neon-soft)" : "transparent",
        color: active ? "var(--neon)" : "var(--text-secondary)",
      }}
    >
      {icon}
    </button>
  );
}
