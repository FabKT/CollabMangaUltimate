import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileImage, BookOpen, Clapperboard, UserSquare2, Wand2,
  Library, Sparkles, History, CreditCard, Settings, ChevronsLeft, ChevronsRight, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Item = { label: string; to: string; icon: LucideIcon };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  { title: "Overview", items: [{ label: "AI Dashboard", to: "/ai", icon: LayoutDashboard }] },
  { title: "Create", items: [
    { label: "Manga Page Creator", to: "/ai/manga-page", icon: FileImage },
    { label: "Chapter Builder", to: "/ai/chapter", icon: BookOpen },
    { label: "Scene Builder", to: "/ai/scene", icon: Clapperboard },
  ]},
  { title: "Characters", items: [
    { label: "Character Studio", to: "/ai/characters", icon: UserSquare2 },
    { label: "Style Transfer", to: "/ai/style-transfer", icon: Wand2 },
  ]},
  { title: "Library", items: [
    { label: "Asset Library", to: "/ai/assets", icon: Library },
    { label: "Prompt Library", to: "/ai/prompts", icon: Sparkles },
    { label: "History", to: "/ai/history", icon: History },
  ]},
  { title: "Account", items: [
    { label: "Plan & Credits", to: "/ai/plan", icon: CreditCard },
    { label: "AI Settings", to: "/ai/settings", icon: Settings },
  ]},
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/ai" ? pathname === "/ai" : pathname.startsWith(to));

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen transition-[width] duration-200 ease-out"
      style={{
        width: collapsed ? 76 : 260,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid rgba(133,154,206,0.16)",
        padding: collapsed ? "20px 12px" : "20px 16px",
      }}
    >
      {/* Identity */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 grid place-items-center"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, rgba(57,255,136,0.18), rgba(57,255,136,0.04))",
              border: "1px solid rgba(57,255,136,0.45)",
              boxShadow: "0 0 18px rgba(57,255,136,0.18)",
            }}
          >
            <Zap size={20} color="var(--neon)" strokeWidth={2.4} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                CollabManga AI
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                Creative Studio
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid place-items-center transition-colors"
            style={{
              width: 34, height: 34, borderRadius: 12,
              border: "1px solid var(--border-default)", color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neon-soft-border)"; e.currentTarget.style.color = "var(--neon)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="grid place-items-center mx-auto mb-4"
          style={{
            width: 34, height: 34, borderRadius: 12,
            border: "1px solid var(--border-default)", color: "var(--text-secondary)",
          }}
        >
          <ChevronsRight size={16} />
        </button>
      )}

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto -mr-1 pr-1">
        {groups.map((g, i) => (
          <div key={g.title} style={{ marginTop: i === 0 ? 0 : 20 }}>
            {!collapsed && (
              <div
                className="px-3 mb-2"
                style={{
                  font: "800 11px/16px var(--font-sans)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {g.title}
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {g.items.map((it) => {
                const active = isActive(it.to);
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      title={collapsed ? it.label : undefined}
                      className="group flex items-center gap-3 relative transition-colors"
                      style={{
                        height: 44,
                        padding: collapsed ? 0 : "0 12px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        borderRadius: 12,
                        background: active ? "var(--neon-soft)" : "transparent",
                        color: active ? "var(--neon)" : "var(--text-secondary)",
                        border: active ? "1px solid rgba(57,255,136,0.28)" : "1px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          e.currentTarget.style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }
                      }}
                    >
                      {active && !collapsed && (
                        <span
                          aria-hidden
                          style={{
                            position: "absolute", left: -16, top: 10, bottom: 10, width: 3,
                            background: "var(--neon)", borderRadius: 999,
                            boxShadow: "0 0 10px rgba(57,255,136,0.6)",
                          }}
                        />
                      )}
                      <Icon size={18} strokeWidth={2.1} />
                      {!collapsed && (
                        <span style={{ font: "700 14px/20px var(--font-sans)" }}>{it.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account / usage */}
      <div className="mt-5">
        {collapsed ? (
          <div
            className="grid place-items-center mx-auto"
            style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            title="Starter Plan · Credits: 000"
          >
            <CreditCard size={18} color="var(--neon)" />
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: 16, padding: 16,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ font: "700 13px/18px var(--font-sans)" }}>Starter Plan</span>
              <span className="cma-chip cma-chip-active" style={{ height: 22, padding: "0 8px" }}>Active</span>
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Credits: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>000</span> / 000
            </div>
            <div
              className="my-3"
              style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}
            >
              <div style={{ width: "42%", height: "100%", background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
            </div>
            <button className="cma-btn-primary w-full justify-center" style={{ height: 38 }}>
              Upgrade
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
