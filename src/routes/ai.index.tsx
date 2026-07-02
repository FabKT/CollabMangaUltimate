import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Card, Panel, SectionTitle } from "@/components/cma/Layout";
import {
  FileImage, UserSquare2, Wand2, BookOpen, Library, History,
  Sparkles, Clock, Zap, ArrowUpRight, Image as ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/ai/")({
  head: () => ({ meta: [{ title: "AI Dashboard — CollabManga AI" }] }),
  component: Dashboard,
});

const quickActions: { title: string; desc: string; to: string; icon: LucideIcon; accent?: boolean }[] = [
  { title: "Create Manga Page", desc: "Compose a page with AI generation", to: "/ai/manga-page", icon: FileImage, accent: true },
  { title: "Create Character", desc: "Design a reusable character sheet", to: "/ai/characters", icon: UserSquare2 },
  { title: "Change Character Style", desc: "Re-style with intensity controls", to: "/ai/style-transfer", icon: Wand2 },
  { title: "Build Chapter", desc: "Structure a complete chapter", to: "/ai/chapter", icon: BookOpen },
  { title: "Open Asset Library", desc: "Browse characters, scenes, refs", to: "/ai/assets", icon: Library },
  { title: "View History", desc: "Restore or duplicate generations", to: "/ai/history", icon: History },
];

function Dashboard() {
  return (
    <>
      <PageHeader
        title="AI Dashboard"
        description="Your production hub for manga pages, chapters, and characters."
        actions={
          <>
            <button className="cma-btn-secondary">
              <Sparkles size={16} /> Prompt Library
            </button>
            <Link to="/ai/manga-page" className="cma-btn-primary">
              <Zap size={16} /> New Manga Page
            </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[
          { label: "Credits remaining", value: "000", hint: "Starter Plan", accent: true },
          { label: "Pages generated", value: "00", hint: "Last 30 days" },
          { label: "Characters", value: "00", hint: "In library" },
          { label: "Chapters", value: "00", hint: "In progress" },
        ].map((s) => (
          <Card key={s.label}>
            <div className="cma-label">{s.label}</div>
            <div
              className="mt-2"
              style={{ font: "700 28px/36px var(--font-display)", color: s.accent ? "var(--neon)" : "var(--text-primary)" }}
            >
              {s.value}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>{s.hint}</div>
          </Card>
        ))}
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {quickActions.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.to} to={q.to} className="block group">
              <Card padding={20}>
                <div className="flex items-start justify-between">
                  <div
                    className="grid place-items-center"
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: q.accent ? "var(--neon-soft)" : "var(--bg-input)",
                      border: `1px solid ${q.accent ? "var(--neon-soft-border)" : "var(--border-default)"}`,
                      color: q.accent ? "var(--neon)" : "var(--text-secondary)",
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <ArrowUpRight size={16} style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="mt-4" style={{ font: "700 14px/20px var(--font-sans)" }}>{q.title}</div>
                <div className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>{q.desc}</div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent pages */}
        <Panel className="lg:col-span-2">
          <SectionTitle right={<Link to="/ai/history" className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}>View all</Link>}>
            Recent manga pages
          </SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="cma-card overflow-hidden" style={{ padding: 0 }}>
                <div
                  className="aspect-[3/4] grid place-items-center"
                  style={{ background: "linear-gradient(160deg, rgba(57,255,136,0.06), rgba(117,167,255,0.05))" }}
                >
                  <ImageIcon size={28} style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="p-3">
                  <div className="text-[13px] font-bold">Untitled Page {i + 1}</div>
                  <div className="text-[12px] flex items-center gap-1 mt-1" style={{ color: "var(--text-muted)" }}>
                    <Clock size={12} /> Just now
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent characters + plan */}
        <div className="flex flex-col gap-6">
          <Panel>
            <SectionTitle right={<Link to="/ai/characters" className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}>Open</Link>}>
              Recent characters
            </SectionTitle>
            <ul className="flex flex-col gap-2">
              {["Character A", "Character B", "Character C", "Character D"].map((n) => (
                <li key={n} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: "var(--bg-input)" }}>
                  <div
                    className="grid place-items-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
                  >
                    <UserSquare2 size={18} style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{n}</div>
                    <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Updated recently</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <SectionTitle>Current plan</SectionTitle>
            <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>You're on the <strong style={{ color: "var(--text-primary)" }}>Starter Plan</strong>.</div>
            <div className="mt-3" style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: "42%", height: "100%", borderRadius: 999, background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
            </div>
            <div className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>000 of 000 credits used this cycle</div>
            <Link to="/ai/plan" className="cma-btn-primary mt-4 w-full justify-center">Upgrade plan</Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
