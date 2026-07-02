import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, Label, Input, Textarea, Chip, SectionTitle } from "@/components/cma/Layout";
import { Sparkles, Plus, FileImage } from "lucide-react";

export const Route = createFileRoute("/ai/chapter")({
  head: () => ({ meta: [{ title: "Chapter Builder — CollabManga AI" }] }),
  component: ChapterBuilder,
});

function ChapterBuilder() {
  return (
    <>
      <PageHeader
        title="Chapter Builder"
        description="Structure an entire chapter before generating pages."
        actions={
          <>
            <button className="cma-btn-secondary">Save draft</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> Generate outline</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
        {/* Config */}
        <Panel>
          <SectionTitle>Configuration</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>Chapter title</Label><Input placeholder="Chapter 01 — The Rooftop" /></div>
            <div><Label>Objective</Label><Input placeholder="What this chapter must achieve" /></div>
            <div><Label>Synopsis</Label><Textarea placeholder="Brief synopsis…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pages</Label><Input type="number" defaultValue={18} /></div>
              <div><Label>Pacing</Label><Input placeholder="Steady / fast / slow" /></div>
            </div>
            <div>
              <Label>Emotional tone</Label>
              <div className="flex flex-wrap gap-2">
                {["Tense", "Hopeful", "Melancholic", "Action", "Quiet"].map((t, i) => (
                  <Chip key={t} active={i === 0}>{t}</Chip>
                ))}
              </div>
            </div>
            <div><Label>Characters involved</Label><Input placeholder="Character A, Character B…" /></div>
            <div><Label>Locations</Label><Input placeholder="Rooftop, alleyway…" /></div>
            <div><Label>Key beats</Label><Textarea placeholder="List important story beats" /></div>
            <div><Label>Cliffhanger / ending</Label><Textarea placeholder="How the chapter ends" /></div>
          </div>
        </Panel>

        {/* Output */}
        <Panel>
          <SectionTitle right={<button className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}><Plus size={14} /> Add scene</button>}>
            Chapter outline
          </SectionTitle>

          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((s) => (
              <Card key={s}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Scene {s}</div>
                    <div className="text-[15px] font-bold">Untitled scene</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip>Action</Chip>
                    <Chip>3 pages</Chip>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((p) => (
                    <div key={p} className="cma-card" style={{ padding: 12 }}>
                      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Page {p}</div>
                      <div className="text-[13px] mt-1 font-bold">Panels & action</div>
                      <div className="aspect-[3/4] mt-2 grid place-items-center" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                        <FileImage size={20} style={{ color: "var(--text-muted)" }} />
                      </div>
                      <div className="text-[12px] mt-2" style={{ color: "var(--text-secondary)" }}>
                        Dialogue notes and action beats appear here.
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
