import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileImage,
  UserPlus,
  ImagePlus,
  Wand2,
  PenLine,
  ArrowLeftRight,
  Sparkles,
  UserSquare2,
  Images,
  History,
  CreditCard,
  Zap,
  ChevronsUpDown,
  Users,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { amIAdmin } from "@/server-functions/admin-billing";
import { getMyBilling } from "@/server-functions/stripe-billing";
import { onCreditsChanged } from "@/lib/credits-events";
import { PLANS } from "@/lib/billing-plans";
import { LanguageSelect, useI18n, type TranslationKey } from "@/lib/i18n";
import { isLocalAiClientMode } from "@/lib/local-ai-mode";

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
      { label: "Swap", to: "/ai/swap", icon: ArrowLeftRight },
      { label: "Studio libre", to: "/ai/free-studio", icon: Sparkles },
      { label: "Modification d'image", to: "/ai/image-edit", icon: ImagePlus },
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
    items: [{ label: "Plan & Images", to: "/ai/plan", icon: CreditCard }],
  },
];

const aiGroupKeys: TranslationKey[] = ["nav.creation", "nav.library", "nav.account"];
const aiGroupKeyByTitle: Record<string, TranslationKey> = {
  Création: "nav.creation",
  Bibliothèque: "nav.library",
  Compte: "nav.account",
};
const aiItemKeys: Record<string, TranslationKey> = {
  "/ai/manga-page": "nav.mangaPage",
  "/ai/character-create": "nav.characterCreate",
  "/ai/style-transfer": "nav.styleTransfer",
  "/ai/free-studio": "nav.freeStudio",
  "/ai/image-edit": "nav.imageEdit",
  "/ai/characters": "nav.characterLibrary",
  "/ai/history": "nav.history",
  "/ai/plan": "nav.plan",
  "/ai/sketch-final": "nav.rawFinal",
  "/ai/swap": "nav.swap",
  "/ai/admin": "nav.admin",
};

export function Sidebar({ forceVisible = false }: { forceVisible?: boolean }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/ai" ? pathname === "/ai" : pathname.startsWith(to));
  // Lien admin affiché uniquement pour les administrateurs (vérifié côté serveur).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (isLocalAiClientMode) {
      setIsAdmin(true);
      return;
    }
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

  const visibleGroups = isLocalAiClientMode
    ? groups.filter((group) => group.title !== "Compte")
    : groups;
  const renderedGroups: Group[] = isAdmin
    ? visibleGroups.map((g) =>
        g.title === (isLocalAiClientMode ? "Bibliothèque" : "Compte")
          ? {
              ...g,
              items: [
                ...g.items,
                { label: "Admin — Facturation", to: "/ai/admin", icon: ShieldCheck },
              ],
            }
          : g,
      )
    : groups;

  // Quota réel de l'abonnement, rafraîchi au montage, au retour de focus
  // et après chaque génération.
  const [quota, setQuota] = useState<{ plan: string; remaining: number; total: number } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (isLocalAiClientMode) return;
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await getMyBilling({ data: { accessToken: token } });
        if (cancelled) return;
        if (res.configured && res.subscription?.plan && res.period) {
          setQuota({
            plan: res.subscription.plan,
            remaining: res.period.remaining,
            total: res.period.quota,
          });
        } else {
          setQuota(null);
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const off = onCreditsChanged(() => void load());
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      off();
    };
  }, []);

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
          CollabManga AI
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
          <span
            className="block text-[11px] leading-tight truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {t("nav.workspace")}
          </span>
        </span>
        <ChevronsUpDown size={14} style={{ color: "var(--text-muted)" }} />
      </button>

      {/* Switch to CollabManga (social network) */}
      {!isLocalAiClientMode && (
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
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              background: "linear-gradient(135deg,#4ea8ff,#39ff88)",
            }}
          >
            <Users size={13} color="#04111e" strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1 text-left text-[12px] font-bold truncate">
            CollabManga (réseau)
          </span>
          <ArrowLeft size={13} style={{ color: "var(--text-muted)" }} />
        </Link>
      )}

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
                {t(aiGroupKeyByTitle[g.title] ?? aiGroupKeys[i])}
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
                        {aiItemKeys[it.to] ? t(aiItemKeys[it.to]) : it.label}
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

      {/* Quota réel de l'abonnement (crédits restants) */}
      {!isLocalAiClientMode && (
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
            <span style={{ font: "700 12px/16px var(--font-sans)" }}>
              {quota
                ? (PLANS[quota.plan as keyof typeof PLANS]?.label ?? quota.plan)
                : "Aucun plan"}
            </span>
            {quota && (
              <span
                className="cma-chip cma-chip-active"
                style={{ height: 18, padding: "0 6px", fontSize: 10 }}
              >
                Active
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {quota ? (
              <>
                Crédits{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {quota.remaining}
                </span>{" "}
                / {quota.total}
              </>
            ) : (
              "Aucun abonnement actif"
            )}
          </div>
          <div
            className="my-2"
            style={{
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${quota && quota.total > 0 ? Math.round((quota.remaining / quota.total) * 100) : 0}%`,
                height: "100%",
                background: "var(--neon)",
                boxShadow: "0 0 10px rgba(57,255,136,0.5)",
              }}
            />
          </div>
          <Link
            to="/ai/plan"
            className="cma-btn-primary w-full justify-center"
            style={{ height: 32, fontSize: 12 }}
          >
            {quota ? "Gérer le plan" : "Choisir un plan"}
          </Link>
        </div>
      )}
    </aside>
  );
}
