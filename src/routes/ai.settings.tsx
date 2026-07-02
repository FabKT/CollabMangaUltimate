import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Card, Label, Input, SectionTitle, Chip } from "@/components/cma/Layout";

export const Route = createFileRoute("/ai/settings")({
  head: () => ({ meta: [{ title: "AI Settings — CollabManga AI" }] }),
  component: AiSettings,
});

function AiSettings() {
  return (
    <>
      <PageHeader
        title="AI Settings"
        description="Defaults that apply across the CollabManga AI workspace."
        actions={
          <>
            <button className="cma-btn-secondary">Reset</button>
            <button className="cma-btn-primary">Save changes</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding={24}>
          <SectionTitle>Generation defaults</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>Default generation language</Label><Input defaultValue="English" /></div>
            <div>
              <Label>Default manga page format</Label>
              <div className="flex flex-wrap gap-2">
                {["Single page", "Spread", "Webtoon vertical"].map((c, i) => (
                  <Chip key={c} active={i === 0}>{c}</Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Default creativity level</Label>
              <input type="range" defaultValue={60} className="w-full accent-[color:var(--neon)]" />
            </div>
            <div>
              <Label>Default reference fidelity</Label>
              <input type="range" defaultValue={75} className="w-full accent-[color:var(--neon)]" />
            </div>
            <div>
              <Label>Default character consistency strength</Label>
              <input type="range" defaultValue={80} className="w-full accent-[color:var(--neon)]" />
            </div>
          </div>
        </Card>

        <Card padding={24}>
          <SectionTitle>Behavior</SectionTitle>
          <div className="flex flex-col gap-3">
            <Toggle label="Auto-save generations" defaultChecked />
            <Toggle label="Notify on long generations" defaultChecked />
            <Toggle label="Confirm before deleting from history" defaultChecked />
            <Toggle label="Preview before saving variants" />
          </div>
          <div className="mt-5">
            <Label>History retention</Label>
            <div className="flex flex-wrap gap-2">
              {["30 days", "90 days", "1 year", "Forever"].map((c, i) => (
                <Chip key={c} active={i === 1}>{c}</Chip>
              ))}
            </div>
          </div>
        </Card>

        <Card padding={24}>
          <SectionTitle>Content safety</SectionTitle>
          <div className="flex flex-col gap-3">
            <Toggle label="Block explicit content" defaultChecked />
            <Toggle label="Block real-person likeness" defaultChecked />
            <Toggle label="Strict copyright filter" />
          </div>
        </Card>

        <Card padding={24}>
          <SectionTitle>Notifications</SectionTitle>
          <div className="flex flex-col gap-3">
            <Toggle label="Generation completed" defaultChecked />
            <Toggle label="Generation failed" defaultChecked />
            <Toggle label="Credit balance low" defaultChecked />
            <Toggle label="Weekly summary email" />
          </div>
        </Card>
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
