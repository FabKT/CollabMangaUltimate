import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Card, Input, Chip, SectionTitle } from "@/components/cma/Layout";
import { Search, Plus, Copy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ai/prompts")({
  head: () => ({ meta: [{ title: "Prompt Library — CollabManga AI" }] }),
  component: PromptLibrary,
});

const cats = ["All", "Page generation", "Character design", "Scene composition", "Dialogue", "Action sequence", "Style", "Correction"];

function PromptLibrary() {
  const [cat, setCat] = useState("All");

  return (
    <>
      <PageHeader
        title="Prompt Library"
        description="Reusable prompts and presets for any AI tool."
        actions={<button className="cma-btn-primary"><Plus size={16} /> Create prompt</button>}
      />

      <Panel className="mb-6">
        <div className="relative">
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <Input placeholder="Search prompts" style={{ paddingLeft: 38 }} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {cats.map((c) => (<Chip key={c} active={c === cat} onClick={() => setCat(c)}>{c}</Chip>))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} padding={20}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {cats[(i % (cats.length - 1)) + 1]}
                </div>
                <div className="text-[15px] font-bold mt-1">Prompt preset {i + 1}</div>
              </div>
              <Sparkles size={16} color="var(--neon)" />
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              A short preview of the saved prompt template that describes composition, tone, and style cues…
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["#dynamic", "#rain", "#close-up"].map((t) => <Chip key={t}>{t}</Chip>)}
            </div>
            <div className="flex items-center justify-between mt-5">
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Used 000 times</span>
              <div className="flex items-center gap-2">
                <button className="cma-icon-btn" aria-label="Copy"><Copy size={14} /></button>
                <button className="cma-btn-secondary" style={{ height: 36, padding: "0 14px" }}>Use</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
