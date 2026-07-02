import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, Label, Input, Textarea, Chip, SectionTitle } from "@/components/cma/Layout";
import { Plus, Image as ImageIcon, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ai/scene")({
  head: () => ({ meta: [{ title: "Scene Builder — CollabManga AI" }] }),
  component: SceneBuilder,
});

function SceneBuilder() {
  return (
    <>
      <PageHeader
        title="Scene Builder"
        description="Define reusable scenes you can drop into the Manga Page Creator."
        actions={
          <>
            <button className="cma-btn-secondary">Save scene</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> Generate preview</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6">
        <Panel>
          <SectionTitle>Scene definition</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>Location</Label><Input placeholder="Rooftop, neon district…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Time of day</Label><Input placeholder="Dusk" /></div>
              <div><Label>Weather</Label><Input placeholder="Light rain" /></div>
            </div>
            <div>
              <Label>Atmosphere</Label>
              <div className="flex flex-wrap gap-2">
                {["Cinematic", "Quiet", "Oppressive", "Hopeful"].map((t, i) => (<Chip key={t} active={i === 0}>{t}</Chip>))}
              </div>
            </div>
            <div><Label>Characters present</Label><Input placeholder="Character A, Character B" /></div>
            <div><Label>Character positions</Label><Textarea placeholder="A foreground left, B background right…" /></div>
            <div><Label>Main action</Label><Textarea placeholder="What is happening" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Camera angle</Label><Input placeholder="Low / high / dutch" /></div>
              <div><Label>Emotional intensity</Label><Input placeholder="High" /></div>
            </div>
            <div><Label>Key props</Label><Input placeholder="Umbrella, neon sign…" /></div>
            <div><Label>Background details</Label><Textarea placeholder="Skyline, signage, crowd density…" /></div>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <SectionTitle>Preview</SectionTitle>
            <div className="aspect-[16/9] grid place-items-center" style={{ background: "var(--bg-stage)", borderRadius: 14, border: "1px dashed var(--border-default)" }}>
              <ImageIcon size={28} style={{ color: "var(--text-muted)" }} />
            </div>
          </Panel>

          <Panel>
            <SectionTitle right={<button className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}><Plus size={14} /> New scene</button>}>
              Saved scenes
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} padding={12} selected={i === 0}>
                  <div className="aspect-[16/10] grid place-items-center mb-3" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                    <ImageIcon size={20} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="text-[13px] font-bold">Scene {i + 1}</div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>Rooftop · Dusk · Rain</div>
                </Card>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
