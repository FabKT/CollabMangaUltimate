import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Card, Label, Chip, SectionTitle } from "@/components/cma/Layout";
import { Wand2, Upload, ArrowLeftRight, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/ai/style-transfer")({
  head: () => ({ meta: [{ title: "Style Transfer — CollabManga AI" }] }),
  component: StyleTransfer,
});

const styles = [
  "Shonen Adventure", "Classic Martial Arts Manga", "Dark Seinen", "Soft Romance Manga",
  "Retro Anime", "Modern Webtoon", "Realistic Manga Hybrid", "Chibi",
  "High-detail Fantasy", "Sports Manga",
];

function StyleTransfer() {
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);

  return (
    <>
      <PageHeader
        title="Style Transfer"
        description="Transform a character into a new visual style while preserving identity."
        actions={
          <>
            <button className="cma-btn-secondary"><Upload size={16} /> Upload image</button>
            <button className="cma-btn-primary"><Wand2 size={16} /> Apply style</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-6">
        <Panel>
          <SectionTitle right={<span className="cma-chip"><ArrowLeftRight size={12} /> Before / After</span>}>
            Comparison
          </SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {["Before", "After"].map((label, i) => (
              <div key={label}>
                <Label>{label}</Label>
                <div
                  className="aspect-[3/4] grid place-items-center"
                  style={{
                    background: "var(--bg-stage)",
                    borderRadius: 14,
                    border: i === 1 ? "1px solid var(--neon-soft-border)" : "1px solid var(--border-default)",
                    boxShadow: i === 1 ? "var(--shadow-neon)" : "none",
                  }}
                >
                  <ImageIcon size={28} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <SectionTitle>Style presets</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {styles.map((s) => (
                <Card key={s} as="button" padding={12} selected={s === selectedStyle}>
                  <button type="button" onClick={() => setSelectedStyle(s)} className="w-full text-left">
                    <div className="aspect-[16/10] grid place-items-center mb-2" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                      <ImageIcon size={20} style={{ color: "var(--text-muted)" }} />
                    </div>
                    <div className="text-[13px] font-bold">{s}</div>
                  </button>
                </Card>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle>Controls</SectionTitle>
          <div className="flex flex-col gap-5">
            <div>
              <Label>Selected character</Label>
              <div className="flex flex-wrap gap-2">
                {["Character A", "Character B", "Character C"].map((c, i) => (
                  <Chip key={c} active={i === 0}>{c}</Chip>
                ))}
              </div>
            </div>

            <div>
              <Label>Target style</Label>
              <div className="cma-chip cma-chip-active" style={{ height: 36, padding: "0 14px" }}>
                <Wand2 size={14} /> {selectedStyle}
              </div>
            </div>

            <div>
              <Label>Style intensity</Label>
              <input type="range" defaultValue={70} className="w-full accent-[color:var(--neon)]" />
              <div className="flex justify-between text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                <span>Subtle</span><span>Full</span>
              </div>
            </div>

            <div>
              <Label>Identity preservation</Label>
              <div className="flex flex-col gap-2">
                {["Preserve face", "Preserve hair", "Preserve outfit", "Relax body proportions"].map((t, i) => (
                  <Toggle key={t} label={t} defaultChecked={i < 2} />
                ))}
              </div>
            </div>

            <button className="cma-btn-primary justify-center"><Wand2 size={16} /> Save as variant</button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Toggle({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className="flex items-center justify-between w-full p-3 rounded-xl"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)" }}
    >
      <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{label}</span>
      <span
        style={{
          width: 36, height: 20, borderRadius: 999,
          background: on ? "var(--neon)" : "rgba(255,255,255,0.12)",
          position: "relative", transition: "background 120ms ease",
          boxShadow: on ? "0 0 10px rgba(57,255,136,0.5)" : "none",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: 999, background: "#04111E",
          transition: "left 120ms ease",
        }} />
      </span>
    </button>
  );
}
