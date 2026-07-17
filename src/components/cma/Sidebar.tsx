import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileImage,
  UserPlus,
  ImagePlus,
  Wand2,
  PenLine,
  UserSquare2,
  Images,
  History,
  CreditCard,
  Settings,
  Zap,
  ChevronsUpDown,
  Users,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { amIAdmin } from "@/server-functions/admin-billing";

type Item = { label: string; to: string; icon: LucideIcon; badge?: string };
type Group = { title?: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Création",
    items: [
      { label: "Manga Page Creator", to: "/ai/manga-page", icon: FileImage },
      { label: "Création de personnage", to: "/ai/character-create", icon: UserPlus },
      { label: "Transfert de style", to: "/ai/style-transfer", icon: Wand2 },
      { label: "Raw to Final", to: "/ai/sketch-final", icon: PenLine },
    ],
  },
  {
    title: "Bibliothèque",
    items: [
      { label: "Bibliothèque de personnages", to: "/ai/characters", icon: UserSquare2 },
      { label: "Historique", to: "/ai/history", icon: History },
    ],
  },
  {
    title: "Compte",
    items: [
      { label: "Plan & Images", to: "/ai/plan", icon: CreditCard },
      { label: "Paramètres", to: "/ai/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ forceVisible = false }: { forceVisible?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/ai" ? pathname === "/ai" : pathname.startsWith(to));

  // Lien admin affiché uniquement pour les administrateurs (vérifié côté serveur).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await amIAdmin({ data: { accessToken: token } });
        setIsAdmin(res.admin);
      } catch {
        /* pas admin */
      }
    })();
  }, []);

  const renderedGroups: Group[] = isAdmin
    ? groups.map((g) =>
        g.title === "Compte"
          ? { ...g, items: [...g.items, { label: "Admin — Facturation", to: "/ai/admin", icon: ShieldCheck }] }
          : g,
      )
    : groups;

  return (
    <aside
      className={`${forceVisible ? "flex" : "hidden md:flex"} flex-col shrink-0 sticky top-0 h-screen`}
      style={{
        width: 248,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid rgba(133,154,206,0.16)",
        padding: "14px 10px",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-2 mb-3">
        <div
          className="shrink-0 grid place-items-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(57,255,136,0.18), rgba(57,255,136,0.04))",
            border: "1px solid rgba(57,255,136,0.45)",
            boxShadow: "0 0 14px rgba(57,255,136,0.16)",
          }}
        >
          <Zap size={15} color="var(--neon)" strokeWidth={2.4} />
        </div>
        <span
          className="font-bold text-[15px] leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          CollabManga
        </span>
      </div>

      {/* Workspace switcher */}
      <button
        className="flex items-center gap-2 w-full mb-4 px-2 transition-colors"
        style={{
          height: 44,
          borderRadius: 10,
          border: "1px solid var(--border-default)",
          background: "var(--bg-elevated)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--neon-soft-border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
        }}
      >
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "linear-gradient(135deg, #39ff88, #12b76a)",
          }}
        >
          <span className="text-[11px] font-black" style={{ color: "#04111e" }}>
            C
          </span>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[13px] font-bold leading-tight truncate">CollabCreative</span>
          <span className="block text-[11px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>
            Espace de travail
          </span>
        </span>
        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)" }} />
      </button>

      {/* Switch to CollabManga (social network) */}
      <Link
        to="/hub"
        className="flex items-center gap-2 w-full mb-4 px-2 transition-colors"
        style={{
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--border-default)",
          background: "var(--bg-elevated)",
        }}
      >
        <span
          className="grid place-items-center shrink-0"
          style={{ width: 24, height: 24, borderRadius: 8, background: "linear-gradient(135deg,#4ea8ff,#39ff88)" }}
        >
          <Users size={13} color="#04111e" strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1 text-left text-[12px] font-bold truncate">
          CollabManga (réseau)
        </span>
        <ArrowLeft size={13} style={{ color: "var(--text-muted)" }} />
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto -mr-1 pr-1">
        {renderedGroups.map((g, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
            {g.title && (
              <div
                className="px-2 mb-1"
                style={{
                  font: "800 10px/14px var(--font-sans)",
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {g.title}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = isActive(it.to);
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className="group flex items-center gap-2.5 relative transition-colors"
                      style={{
                        height: 34,
                        padding: "0 8px",
                        borderRadius: 8,
                        background: active ? "var(--neon-soft)" : "transparent",
                        color: active ? "var(--neon)" : "var(--text-secondary)",
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
                      <Icon size={17} strokeWidth={2} className="shrink-0" />
                      <span className="flex-1 truncate" style={{ font: "600 13px/18px var(--font-sans)" }}>
                        {it.label}
                      </span>
                      {it.badge && (
                        <span
                          className="shrink-0"
                          style={{
                            font: "700 10px/1 var(--font-sans)",
                            padding: "3px 6px",
                            borderRadius: 6,
                            color: "var(--neon)",
                            background: "var(--neon-soft)",
                            border: "1px solid var(--neon-soft-border)",
                          }}
                        >
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Compact usage */}
      <div
        className="mt-2"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span style={{ font: "700 12px/16px var(--font-sans)" }}>Starter</span>
          <span className="cma-chip cma-chip-active" style={{ height: 18, padding: "0 6px", fontSize: 10 }}>
            Active
          </span>
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Credits <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>000</span> / 000
        </div>
        <div
          className="my-2"
          style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}
        >
          <div style={{ width: "42%", height: "100%", background: "var(--neon)", boxShadow: "0 0 10px rgba(57,255,136,0.5)" }} />
        </div>
        <button className="cma-btn-primary w-full justify-center" style={{ height: 32, fontSize: 12 }}>
          Upgrade
        </button>
      </div>
    </aside>
  );
}
