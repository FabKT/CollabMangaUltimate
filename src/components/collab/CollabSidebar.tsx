import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Compass,
  Handshake,
  Store,
  Megaphone,
  Image as ImageIcon,
  Folder,
  Lightbulb,
  BookOpen,
  MessageSquare,
  Bell,
  User,
  Settings,
  Zap,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LanguageSelect, useI18n, type TranslationKey } from "@/lib/i18n";

type Item = { label: string; to: string; icon: LucideIcon; badge?: string };
type Group = { title?: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Communauté",
    items: [
      { label: "Home", to: "/hub", icon: Home },
      { label: "Découvrir", to: "/discover", icon: Compass },
      { label: "Annonces", to: "/announcements", icon: Megaphone },
      { label: "Sponsoring", to: "/sponsorship", icon: Handshake },
      { label: "Hub parrainage", to: "/sponsorship-hub", icon: Store },
      { label: "Illustration", to: "/showcase", icon: ImageIcon },
    ],
  },
  {
    title: "Création",
    items: [
      { label: "Mes projets", to: "/studio", icon: Folder },
      { label: "Idées", to: "/ideas", icon: Lightbulb },
    ],
  },
  {
    title: "Lecture",
    items: [{ label: "Catalogue", to: "/manga", icon: BookOpen }],
  },
  {
    title: "Communication",
    items: [
      { label: "Messages", to: "/messages", icon: MessageSquare },
      { label: "Notifications", to: "/notifications", icon: Bell },
    ],
  },
  {
    title: "Compte",
    items: [
      { label: "Profil", to: "/profile", icon: User },
      { label: "Paramètres", to: "/settings", icon: Settings },
    ],
  },
];

const groupKeys: TranslationKey[] = [
  "nav.community",
  "nav.creation",
  "nav.reading",
  "nav.communication",
  "nav.account",
];

const itemKeys: Record<string, TranslationKey> = {
  "/hub": "nav.home",
  "/discover": "nav.discover",
  "/announcements": "nav.announcements",
  "/sponsorship": "nav.sponsoring",
  "/sponsorship-hub": "nav.sponsorshipHub",
  "/showcase": "nav.illustrations",
  "/studio": "nav.projects",
  "/ideas": "nav.ideas",
  "/manga": "nav.catalog",
  "/messages": "nav.messages",
  "/notifications": "nav.notifications",
  "/profile": "nav.profile",
  "/settings": "nav.settings",
};

export function CollabSidebar({ forceVisible = false }: { forceVisible?: boolean }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  return (
    <aside
      className={`${forceVisible ? "flex" : "cm-desktop-sidebar hidden xl:flex"} flex-col shrink-0 overflow-hidden ${forceVisible ? "relative max-h-[calc(100dvh-24px)]" : "sticky top-0 h-screen"}`}
      style={{
        width: forceVisible ? "100%" : 248,
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

      {/* Switch to CollabManga AI */}
      <Link
        to="/ai"
        className="flex items-center gap-2 w-full mb-4 px-2 transition-colors"
        style={{
          height: 44,
          borderRadius: 10,
          border: "1px solid var(--neon-soft-border)",
          background: "var(--neon-soft)",
        }}
      >
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "linear-gradient(135deg, #39ff88, #12b76a)",
          }}
        >
          <Sparkles size={14} color="#04111e" strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span
            className="block text-[13px] font-bold leading-tight truncate"
            style={{ color: "var(--neon)" }}
          >
            CollabManga AI
          </span>
          <span
            className="block text-[11px] leading-tight truncate"
            style={{ color: "var(--text-muted)" }}
          >
            Studio de création IA
          </span>
        </span>
        <ArrowRight size={14} style={{ color: "var(--neon)" }} />
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto -mr-1 pr-1">
        {groups.map((g, i) => (
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
                {t(groupKeys[i])}
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
                      <span
                        className="flex-1 truncate"
                        style={{ font: "600 13px/18px var(--font-sans)" }}
                      >
                        {itemKeys[it.to] ? t(itemKeys[it.to]) : it.label}
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

      <LanguageSelect placement="up" className="cma-input mt-3 !h-9 !w-full" />
    </aside>
  );
}
