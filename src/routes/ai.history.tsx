import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Input, Chip, SectionTitle } from "@/components/cma/Layout";
import { Search, Image as ImageIcon, RotateCcw, Copy, Trash2, GitCompare } from "lucide-react";

export const Route = createFileRoute("/ai/history")({
  head: () => ({ meta: [{ title: "History — CollabManga AI" }] }),
  component: HistoryPage,
});

const types = ["All", "Manga page", "Chapter", "Scene", "Character", "Style transfer", "Edit"];
const statuses = ["Completed", "Failed", "In progress"] as const;

function HistoryPage() {
  const [type, setType] = useState("All");

  return (
    <>
      <PageHeader
        title="History"
        description="Restore, duplicate, or compare any past generation."
        actions={<button className="cma-btn-secondary"><GitCompare size={16} /> Compare versions</button>}
      />

      <Panel className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_200px] gap-3">
          <div className="relative">
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <Input placeholder="Search generations" style={{ paddingLeft: 38 }} />
          </div>
          <Input placeholder="From date" />
          <Input placeholder="To date" />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {types.map((t) => (<Chip key={t} active={t === type} onClick={() => setType(t)}>{t}</Chip>))}
        </div>
      </Panel>

      <Panel padding={0}>
        <div className="grid grid-cols-[80px_1fr_140px_180px_200px] gap-4 px-5 py-3 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)" }}>
          <div>Result</div><div>Prompt</div><div>Status</div><div>Assets</div><div className="text-right">Actions</div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => {
          const status = statuses[i % statuses.length];
          return (
            <div key={i} className="grid grid-cols-[80px_1fr_140px_180px_200px] gap-4 items-center px-5 py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
              <div className="aspect-square grid place-items-center" style={{ background: "var(--bg-input)", borderRadius: 10, width: 64, height: 64 }}>
                <ImageIcon size={20} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold truncate">Manga page — rooftop scene, dusk lighting, character A in foreground</div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{types[(i % (types.length - 1)) + 1]} · just now</div>
              </div>
              <StatusPill status={status} />
              <div className="flex flex-wrap gap-1">
                <Chip>Character A</Chip>
                <Chip>Rooftop</Chip>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button className="cma-icon-btn" aria-label="Restore"><RotateCcw size={14} /></button>
                <button className="cma-icon-btn" aria-label="Duplicate"><Copy size={14} /></button>
                <button className="cma-icon-btn" aria-label="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </Panel>
    </>
  );
}

function StatusPill({ status }: { status: "Completed" | "Failed" | "In progress" }) {
  const map = {
    Completed: { c: "var(--neon)", bg: "rgba(57,255,136,0.12)", border: "var(--neon-soft-border)" },
    Failed: { c: "var(--danger)", bg: "rgba(255,95,126,0.12)", border: "rgba(255,95,126,0.45)" },
    "In progress": { c: "var(--warning)", bg: "rgba(255,184,77,0.12)", border: "rgba(255,184,77,0.45)" },
  } as const;
  const v = map[status];
  return (
    <span className="inline-flex items-center gap-2 px-3 h-7 rounded-full text-[12px] font-bold"
      style={{ color: v.c, background: v.bg, border: `1px solid ${v.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: v.c }} />
      {status}
    </span>
  );
}
