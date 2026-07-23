import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { addIllustration, listDiscoverProfiles, listIllustrations, sendProjectInvitationDb, startConversationWith, subscribeIllustrations } from "@/lib/db";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import { listFavorites, setFavorite } from "@/lib/favorites";
import { loadStudioProjects } from "@/lib/studio-projects";
import {
  X, Upload, Bookmark, BookmarkCheck, MessageSquare, Send, ChevronRight, ChevronLeft,
  LayoutGrid, Rows3, Columns3, Heart,
  UserPlus, ZoomIn, ZoomOut, Palette,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_collab/showcase")({
  component: IllustrationsPage,
  head: () => ({
    meta: [
      { title: "Illustrations · CollabManga" },
      { name: "description", content: "Discover manga artists, evaluate their visual style, and invite them to collaborate on original projects." },
    ],
  }),
});

/* ---------------- Tokens ---------------- */
const C = {
  bg: "#050B1D", panel: "#0B1430", card: "#101B3F", input: "#0E193A",
  details: "#08112B", stage: "#060D24",
  text: "#F7FAFF", text2: "#B8C4E5", muted: "#7F8CB3", disabled: "#5E6A90",
  neon: "#39FF88", neonHover: "#25E575",
  neonSoftFill: "rgba(57, 255, 136, 0.12)", neonSoftBorder: "rgba(57, 255, 136, 0.45)",
  border: "rgba(133, 154, 206, 0.18)", borderStrong: "rgba(133, 154, 206, 0.28)",
  danger: "#FF5F7E", warning: "#FFB84D", info: "#75A7FF",
};

const sora: CSSProperties = { fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif" };
const manrope: CSSProperties = { fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" };

/* ---------------- Primitives ---------------- */
function Chip({
  children, tone = "neutral", selected, onRemove, onClick, icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "neon" | "warning" | "info" | "danger";
  selected?: boolean; onRemove?: () => void; onClick?: () => void; icon?: ReactNode;
}) {
  const styles: Record<string, CSSProperties> = {
    neutral: { background: C.input, color: C.text2, border: `1px solid ${C.border}` },
    neon: { background: C.neonSoftFill, color: C.neon, border: `1px solid ${C.neonSoftBorder}` },
    warning: { background: "rgba(255,184,77,0.12)", color: C.warning, border: "1px solid rgba(255,184,77,0.35)" },
    info: { background: "rgba(117,167,255,0.12)", color: C.info, border: "1px solid rgba(117,167,255,0.35)" },
    danger: { background: "rgba(255,95,126,0.12)", color: C.danger, border: "1px solid rgba(255,95,126,0.35)" },
  };
  const t = selected ? styles.neon : styles[tone];
  return (
    <button
      onClick={onClick}
      style={{ ...t, ...manrope, fontWeight: 600, fontSize: 12, lineHeight: "18px", borderRadius: 999, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, cursor: onClick || onRemove ? "pointer" : "default", whiteSpace: "nowrap" }}
    >
      {icon}
      {children}
      {onRemove && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ display: "inline-flex", opacity: 0.8 }}>
          <X size={12} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
function Btn({
  children, variant = "primary", size = "md", onClick, icon, style, full, type = "button",
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  onClick?: () => void; icon?: ReactNode; style?: CSSProperties; full?: boolean;
  type?: "button" | "submit";
}) {
  const h = size === "sm" ? 36 : 44;
  const base: CSSProperties = {
    ...manrope, fontWeight: 700, fontSize: 14, lineHeight: "20px",
    height: h, padding: size === "sm" ? "0 14px" : "0 18px", borderRadius: 14,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    cursor: "pointer", transition: "all 160ms ease", width: full ? "100%" : undefined,
  };
  const v: Record<string, CSSProperties> = {
    primary: { background: C.neon, color: "#04111E", border: "1px solid transparent" },
    secondary: { background: "transparent", color: C.text, border: `1px solid ${C.borderStrong}` },
    ghost: { background: "transparent", color: C.text2, border: "1px solid transparent" },
    danger: { background: "rgba(255,95,126,0.10)", color: C.danger, border: "1px solid rgba(255,95,126,0.35)" },
  };
  return (
    <button
      type={type} onClick={onClick} style={{ ...base, ...v[variant], ...style }}
      onMouseEnter={(e) => {
        if (variant === "primary") (e.currentTarget.style.background = C.neonHover);
        if (variant === "secondary") (e.currentTarget.style.background = "rgba(255,255,255,0.04)");
        if (variant === "ghost") (e.currentTarget.style.color = C.text);
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") (e.currentTarget.style.background = C.neon);
        if (variant === "secondary") (e.currentTarget.style.background = "transparent");
        if (variant === "ghost") (e.currentTarget.style.color = C.text2);
      }}
    >
      {icon}{children}
    </button>
  );
}

function IconBtn({ children, onClick, active, title }: { children: ReactNode; onClick?: () => void; active?: boolean; title?: string }) {
  return (
    <button
      title={title} aria-label={title} onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 12, background: C.card,
        border: `1px solid ${active ? C.neonSoftBorder : C.border}`,
        color: active ? C.neon : C.text2, display: "inline-flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", transition: "all 160ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.neonSoftBorder)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = active ? C.neonSoftBorder : C.border)}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...manrope, fontSize: 12, fontWeight: 600, color: C.text2 }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        ...manrope, background: C.input, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "0 16px", height: 44, fontSize: 14, fontWeight: 500,
        appearance: "none", backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23B8C4E5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 40,
        cursor: "pointer",
      }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: C.input, color: C.text }}>{o}</option>)}
    </select>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        ...manrope, background: C.input, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "0 16px", height: 44, fontSize: 14, fontWeight: 500,
        width: "100%", outline: "none", ...props.style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = C.neon; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(57,255,136,0.10)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...manrope, background: C.input, color: C.text, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "14px 16px", fontSize: 14, fontWeight: 500,
        minHeight: 130, width: "100%", outline: "none", resize: "vertical", ...props.style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = C.neon; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(57,255,136,0.10)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

/* ---------------- Placeholder artwork ---------------- */
type Ratio = "square" | "portrait" | "landscape" | "page" | "cover";
const ratioMap: Record<Ratio, string> = {
  square: "1 / 1", portrait: "3 / 4", landscape: "4 / 3", page: "2 / 3", cover: "3 / 5",
};

function ArtworkPlaceholder({ seed, ratio = "portrait" }: { seed: number; ratio?: Ratio }) {
  // Deterministic gradient placeholders evoking manga panels
  const palettes = [
    ["#1a2960", "#3a1560", "#0a1030"],
    ["#0a2440", "#134a5a", "#061a2e"],
    ["#3a1a4a", "#601a3a", "#160a2a"],
    ["#0a3a3a", "#0a1a4a", "#04122c"],
    ["#4a2a10", "#2a1a4a", "#0a0a2a"],
    ["#1a4a3a", "#0a2a4a", "#061428"],
    ["#4a1a2a", "#1a1a5a", "#0a0e2c"],
    ["#2a3a5a", "#4a2a5a", "#0a1030"],
  ];
  const p = palettes[seed % palettes.length];
  const angle = (seed * 37) % 360;
  return (
    <div
      style={{
        aspectRatio: ratioMap[ratio], width: "100%", borderRadius: 14, overflow: "hidden",
        background: `linear-gradient(${angle}deg, ${p[0]} 0%, ${p[1]} 55%, ${p[2]} 100%)`,
        position: "relative", boxShadow: "inset 0 0 60px rgba(0,0,0,0.35)",
      }}
      role="img" aria-label="Artist illustration placeholder"
    >
      {/* silhouette shapes */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle at ${20 + (seed * 13) % 60}% ${15 + (seed * 7) % 40}%, rgba(255,255,255,0.12), transparent 40%),
        radial-gradient(circle at ${40 + (seed * 11) % 40}% ${70 + (seed * 5) % 20}%, rgba(0,0,0,0.35), transparent 45%)`,
      }} />
      {/* diagonal speed lines */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.15,
        backgroundImage: `repeating-linear-gradient(${(angle + 30) % 180}deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 8px)`,
      }} />
      {/* corner mark */}
      <div style={{
        position: "absolute", left: 12, bottom: 12, width: 26, height: 26, borderRadius: 8,
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)",
      }}>
        <Palette size={13} />
      </div>
    </div>
  );
}

/* ---------------- Data ---------------- */
const ROLES = ["Dessinateur","Scénariste","Créateur de contenu","Lecteur"];

type Art = {
  id: string; title: string; artist: string; role: string; style: string; type: string;
  skills: string[]; availability: "Available now" | "Open to projects" | "Limited" | "Not available";
  ratio: Ratio; seed: number; views: number; saves: number;
  imageUrl?: string; imageUrls?: string[]; description?: string; authorId?: string; avatarUrl?: string;
};

const AVAILABILITY_KEY: Record<Art["availability"], TranslationKey> = {
  "Available now": "showcase.availableNow",
  "Open to projects": "showcase.openToProjects",
  Limited: "showcase.limited",
  "Not available": "showcase.notAvailable",
};

/* ---------------- Page ---------------- */
function IllustrationsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [view, setView] = useState<"masonry" | "grid" | "compact">("masonry");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [openArt, setOpenArt] = useState<Art | null>(null);
  const [invite, setInvite] = useState<Art | null>(null);
  const [realArts, setRealArts] = useState<Art[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  // Illustrations réelles (Supabase) — seule source de la galerie
  const refreshGallery = () => {
    Promise.all([listIllustrations(), listDiscoverProfiles(200)])
      .then(([rows, profiles]) => {
        const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
        setRealArts(
          rows.map((r, i) => {
            const profile = profileById.get(r.author_id);
            return {
            id: r.id,
            title: r.title,
            artist: r.author?.display_name || r.author?.username || "Artiste",
            role: r.author?.role || "Dessinateur",
            style: "—",
            type: "Illustration",
            skills: [],
            availability: (profile?.preferences?.available === false ? "Not available" : "Available now") as Art["availability"],
            ratio: "portrait" as Ratio,
            seed: i + 100,
            views: 0,
            saves: 0,
            imageUrl: r.image_url,
            imageUrls: r.image_urls?.length ? r.image_urls : [r.image_url],
            description: r.description,
            authorId: r.author_id,
            avatarUrl: r.author?.avatar_url || undefined,
          };
          }),
        );
      })
      .catch((error: unknown) => {
        setRealArts([]);
        setPageError(error instanceof Error ? error.message : t("showcase.galleryLoadFailed"));
      });
  };
  useEffect(() => {
    refreshGallery();
    return subscribeIllustrations(refreshGallery);
  }, []);

  useEffect(() => {
    void listFavorites()
      .then((rows) => setSaved(new Set(rows.filter((row) => row.kind === "Illustration").map((row) => row.title))))
      .catch(() => undefined);
  }, []);

  // Production : uniquement les illustrations réelles (Supabase), plus d'exemples.
  const gallery = [...realArts];

  function toggleSave(art: Art) {
    const key = art.title;
    const nextSaved = !saved.has(key);
    setSaved((savedIds) => {
      const next = new Set(savedIds);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    void setFavorite("Illustration", key, nextSaved).catch((error: unknown) => {
      setSaved((savedIds) => {
        const next = new Set(savedIds);
        if (nextSaved) next.delete(key);
        else next.add(key);
        return next;
      });
      setPageError(error instanceof Error ? error.message : t("showcase.favoriteFailed"));
    });
  }

  // Esc to close modals
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (invite) return setInvite(null);
      if (openArt) return setOpenArt(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openArt, invite]);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", ...manrope }}>
      <div className="cm-page" style={{ maxWidth: 1600, margin: "0 auto", padding: 32 }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ ...sora, fontSize: 28, fontWeight: 700, lineHeight: "36px", margin: 0, color: C.text }}>{t("showcase.title")}</h1>
            <p style={{ ...manrope, fontSize: 14, fontWeight: 500, lineHeight: "22px", color: C.text2, margin: "8px 0 0", maxWidth: 640 }}>
              {t("showcase.subtitle")}
            </p>
          </div>
        </header>

        {pageError && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,95,126,0.4)", background: "rgba(255,95,126,0.10)", color: C.danger, fontSize: 13, fontWeight: 700 }}>
            {pageError}
          </div>
        )}

        {/* Gallery */}
        <section>
          {/* Gallery header — view switch only */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ ...manrope, fontSize: 12, color: C.muted, fontWeight: 600, marginRight: 4 }}>{t("showcase.view")}</span>
              <IconBtn active={view === "masonry"} onClick={() => setView("masonry")} title={t("showcase.masonry")}><Rows3 size={16} /></IconBtn>
              <IconBtn active={view === "grid"} onClick={() => setView("grid")} title={t("showcase.grid")}><LayoutGrid size={16} /></IconBtn>
              <IconBtn active={view === "compact"} onClick={() => setView("compact")} title={t("showcase.compact")}><Columns3 size={16} /></IconBtn>
            </div>
          </div>

          {/* Cards */}
          {gallery.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${C.border}`, borderRadius: 22, padding: "56px 24px",
                textAlign: "center", background: C.panel,
              }}
            >
              <div style={{ ...sora, fontSize: 20, fontWeight: 700 }}>{t("showcase.noArtworkYet")}</div>
              <p style={{ ...manrope, fontSize: 14, color: C.text2, marginTop: 8 }}>
                {t("showcase.noArtworkYetText")}
              </p>
            </div>
          ) : (
            <div
              style={
                view === "masonry"
                  ? { columnCount: 4, columnGap: 20 }
                  : view === "grid"
                  ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }
                  : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }
              }
              className="cm-gallery"
            >
              {gallery.map((a) => (
                <ArtCard
                  key={a.id} art={a} masonry={view === "masonry"} compact={view === "compact"}
                  liked={saved.has(a.title)} onLike={() => toggleSave(a)}
                  onOpen={() => setOpenArt(a)}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {openArt && (
        <DetailModal
          art={openArt}
          works={realArts.filter((a) => a.artist === openArt.artist && a.id !== openArt.id)}
          onClose={() => setOpenArt(null)}
          onInvite={() => setInvite(openArt)}
          onContact={() => {
            if (openArt.authorId) {
              void startConversationWith(openArt.authorId)
                .then((conversation) => navigate({ to: "/messages", search: { conversation } }))
                .catch((error: unknown) => setPageError(error instanceof Error ? error.message : t("showcase.conversationFailed")));
            } else setPageError(t("showcase.noProfileLinked"));
          }}
          saved={saved.has(openArt.title)}
          onSave={() => toggleSave(openArt)}
          onOpenArt={(a) => setOpenArt(a)}
          t={t}
        />
      )}
      {invite && <RealInviteModal art={invite} onClose={() => setInvite(null)} t={t} />}

      {/* Responsive */}
      <style>{`
        @media (max-width: 1100px) {
          .cm-main-grid { grid-template-columns: 1fr !important; }
          .cm-gallery { column-count: 2 !important; }
        }
        @media (max-width: 900px) {
          .cm-page { padding: 24px !important; }
        }
        @media (max-width: 640px) {
          .cm-page { padding: 16px !important; }
          .cm-gallery { column-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- Card ---------------- */
function ArtCard({
  art, masonry, compact, liked, onLike, onOpen, t,
}: {
  art: Art; masonry?: boolean; compact?: boolean; liked: boolean;
  onLike: () => void; onOpen: () => void; t: (key: TranslationKey) => string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 10,
        boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
        transition: "all 200ms ease",
        breakInside: masonry ? "avoid" : undefined,
        marginBottom: masonry ? 20 : undefined,
        display: "flex", flexDirection: "column", gap: 12,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}
      onClick={onOpen}
    >
      {/* Fixed-size image frame in cards; the original ratio is shown in the detail view. */}
      {art.imageUrl ? (
        <div style={{ aspectRatio: ratioMap.portrait, width: "100%", borderRadius: 14, overflow: "hidden", background: C.stage }}>
          <img src={art.imageUrl} alt={art.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <ArtworkPlaceholder seed={art.seed} ratio="portrait" />
      )}

      {!compact && (
        <div style={{ padding: "2px 4px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* profile: photo + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {art.avatarUrl ? (
              <img src={art.avatarUrl} alt={art.artist} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.border}`, flexShrink: 0 }} />
            ) : <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `linear-gradient(135deg, hsl(${(art.seed * 47) % 360} 60% 40%), hsl(${(art.seed * 73) % 360} 60% 25%))`,
              border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center",
              ...manrope, fontSize: 12, fontWeight: 800, color: C.text, flexShrink: 0,
            }}>
              A
            </div>}
            <span style={{ ...manrope, fontSize: 14, fontWeight: 800, color: C.text }}>{art.artist}</span>
          </div>

          {/* view details + like + comment */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Btn variant="secondary" size="sm" full onClick={onOpen}>{t("showcase.viewDetails")}</Btn>
            </div>
            <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 8 }}>
              <IconBtn title={liked ? t("showcase.unlike") : t("showcase.like")} active={liked} onClick={onLike}>
                <Heart size={15} fill={liked ? C.neon : "none"} />
              </IconBtn>
              <IconBtn title={t("showcase.comment")} onClick={onOpen}><MessageSquare size={15} /></IconBtn>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


/* ---------------- Modal shell ---------------- */
function ModalShell({ children, onClose, width = 1100 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(2,6,17,0.72)", backdropFilter: "blur(4px)",
        zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: 24, overflowY: "auto",
      }}
      role="dialog" aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.borderStrong}`, borderRadius: 24,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)", width: "100%", maxWidth: width,
          maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
          marginTop: "4vh",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose, subtitle }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ ...sora, fontSize: 20, fontWeight: 700, lineHeight: "28px", color: C.text }}>{title}</div>
        {subtitle && <div style={{ ...manrope, fontSize: 13, color: C.text2, marginTop: 4 }}>{subtitle}</div>}
      </div>
      <IconBtn title="Close" onClick={onClose}><X size={16} /></IconBtn>
    </div>
  );
}

/* ---------------- Detail Modal ---------------- */
function DetailModal({
  art, works = [], onClose, onInvite, onContact, saved, onSave, onOpenArt, t,
}: {
  art: Art; works?: Art[]; onClose: () => void; onInvite: () => void; onContact: () => void;
  saved: boolean; onSave: () => void; onOpenArt?: (a: Art) => void;
  t: (key: TranslationKey) => string;
}) {
  const [tab, setTab] = useState<"profile" | "comments">("profile");
  const [activeImage, setActiveImage] = useState(0);
  const images = art.imageUrls?.length ? art.imageUrls : art.imageUrl ? [art.imageUrl] : [];

  return (
    <ModalShell onClose={onClose} width={1180}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(280px, 2fr)", gap: 0, flex: 1, minHeight: 0 }}>
        {/* Left: viewer */}
        <div style={{ background: C.stage, padding: 24, display: "flex", flexDirection: "column", gap: 16, position: "relative", minHeight: 520 }}>
          <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, zIndex: 2 }}>
            <IconBtn title={t("showcase.previous")} onClick={() => setActiveImage((index) => (index - 1 + images.length) % Math.max(images.length, 1))}><ChevronLeft size={16} /></IconBtn>
            <IconBtn title={t("showcase.next")} onClick={() => setActiveImage((index) => (index + 1) % Math.max(images.length, 1))}><ChevronRight size={16} /></IconBtn>
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, zIndex: 2 }}>
            <IconBtn title={t("showcase.zoomOut")}><ZoomOut size={16} /></IconBtn>
            <IconBtn title={t("showcase.zoomIn")}><ZoomIn size={16} /></IconBtn>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              {images[activeImage] ? (
                <img src={images[activeImage]} alt={art.title} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 14 }} />
              ) : (
                <ArtworkPlaceholder seed={art.seed} ratio={art.ratio} />
              )}
            </div>
          </div>
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", justifyContent: "center" }}>
              {images.map((src, index) => (
                <button key={src} type="button" onClick={() => setActiveImage(index)} style={{ width: 56, height: 56, flex: "0 0 auto", overflow: "hidden", borderRadius: 10, border: `1px solid ${index === activeImage ? C.neon : C.border}`, background: C.input }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: info scroll */}
        <div style={{ background: C.details, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ ...sora, fontSize: 18, fontWeight: 800, lineHeight: "26px", margin: 0 }}>{art.title}</h2>
              <div style={{ ...manrope, fontSize: 12, color: C.muted, marginTop: 3 }}>{art.type}</div>
            </div>
            <IconBtn title={t("showcase.close")} onClick={onClose}><X size={16} /></IconBtn>
          </div>

          <div className="cm-popup-tabs" role="tablist" aria-label={t("showcase.detailsAria")} style={{ width: "100%" }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "profile"}
              data-active={tab === "profile"}
              onClick={() => setTab("profile")}
              className="cm-popup-tab"
              style={{ flex: 1 }}
            >
              {t("showcase.profile")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "comments"}
              data-active={tab === "comments"}
              onClick={() => setTab("comments")}
              className="cm-popup-tab"
              style={{ flex: 1 }}
            >
              {t("showcase.comments")}
            </button>
          </div>

          {tab === "profile" ? (
            <>
          {/* Artist top */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {art.avatarUrl ? (
                <img src={art.avatarUrl} alt={art.artist} style={{ width: 48, height: 48, minWidth: 48, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.border}` }} />
              ) : <div style={{
                width: 48, height: 48, minWidth: 48, flexShrink: 0, borderRadius: "50%",
                background: `linear-gradient(135deg, hsl(${(art.seed * 47) % 360} 60% 40%), hsl(${(art.seed * 73) % 360} 60% 25%))`,
                border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center",
                justifyContent: "center", ...manrope, fontSize: 16, fontWeight: 800,
              }}>{art.artist.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>}
              <div>
                <div style={{ ...manrope, fontSize: 14, fontWeight: 800, color: C.text }}>{art.artist}</div>
                <div style={{ ...manrope, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginTop: 2 }}>{t("showcase.artist")}</div>
              </div>
            </div>
            <Chip tone={art.availability === "Available now" ? "neon" : "info"}>{t(AVAILABILITY_KEY[art.availability])}</Chip>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn variant="primary" icon={<UserPlus size={16} />} onClick={onInvite}>{t("showcase.inviteToProject")}</Btn>
            <Btn variant="secondary" icon={<MessageSquare size={16} />} onClick={onContact}>{t("showcase.contactArtist")}</Btn>
            <Btn variant="ghost" icon={saved ? <BookmarkCheck size={16} color={C.neon} /> : <Bookmark size={16} />} onClick={onSave}>
              {saved ? t("showcase.saved") : t("showcase.saveArtwork")}
            </Btn>
          </div>

          <Section title={t("showcase.artworkDescription")}>
            <p style={{ ...manrope, fontSize: 14, color: C.text2, lineHeight: "22px", margin: 0 }}>
              {art.description || t("showcase.noDescription")}
            </p>
          </Section>

          <Section title={t("showcase.moreFromArtist")}>
            {works.length === 0 ? (
              <p style={{ ...manrope, fontSize: 13, color: C.muted, margin: 0 }}>{t("showcase.noMoreFromArtist")}</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {works.slice(0, 8).map((w) => (
                  <button key={w.id} type="button" onClick={() => onOpenArt?.(w)} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                    {w.imageUrl ? (
                      <img src={w.imageUrl} alt={w.title} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }} />
                    ) : (
                      <ArtworkPlaceholder seed={w.seed} ratio="square" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Section>
            </>
          ) : (
            <Section title={t("showcase.comments")}>
              <CommentsPanel entityType="illustration" entityId={art.id} />
            </Section>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
      <h4 style={{ ...sora, fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: C.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h4>
      {children}
    </div>
  );
}


function RealInviteModal({ art, onClose, t }: { art: Art; onClose: () => void; t: (key: TranslationKey) => string }) {
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStudioProjects<{ id: string; title: string }>()
      .then((rows) => {
        setProjects(rows);
        setProjectId(rows[0]?.id ?? "");
      })
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : t("showcase.projectsLoadFailed")),
      );
  }, [t]);

  const submit = async () => {
    if (!art.authorId) return setError(t("showcase.noAuthorProfile"));
    if (!projectId) return setError(t("showcase.selectProjectFirst"));
    setSending(true);
    setError(null);
    try {
      await sendProjectInvitationDb({ projectId, recipient: art.authorId, role, message: message.trim() || undefined });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("showcase.invitationFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell onClose={onClose} width={640}>
      <ModalHeader title={t("showcase.inviteToProject")} subtitle={`${t("showcase.inviteSubtitle")} ${art.artist}`} onClose={onClose} />
      <div style={{ padding: 24, display: "grid", gap: 18, overflowY: "auto" }}>
        <Field label={t("showcase.projectLabel")}>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            style={{ width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: C.input, color: C.text, padding: "0 12px", fontSize: 14 }}
          >
            <option value="">{t("showcase.selectProject")}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </Field>
        <Field label={t("showcase.roleLabel")}><Select value={role} onChange={setRole} options={ROLES} /></Field>
        <Field label={t("showcase.messageLabel")}><Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("showcase.invitePlaceholder")} /></Field>
        {projects.length === 0 && !error && <p style={{ margin: 0, color: C.warning, fontSize: 13 }}>{t("showcase.createProjectFirst")}</p>}
        {error && <p style={{ margin: 0, color: C.danger, fontSize: 13, fontWeight: 700 }}>{error}</p>}
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onClose}>{t("showcase.cancel")}</Btn>
        <Btn variant="primary" icon={<Send size={16} />} onClick={() => void submit()}>{sending ? t("showcase.sending") : t("showcase.sendInvitation")}</Btn>
      </div>
    </ModalShell>
  );
}

/* ---------------- Upload Modal ---------------- */
function UploadModal({ onClose, onPublished }: { onClose: () => void; onPublished?: () => void }) {
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = "showcase-upload-images";
  const activeImage = images[0]?.url;
  const replaceIndexRef = useRef<number | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const addFiles = (files: FileList | null) => {
    const incoming = Array.from(files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ url: URL.createObjectURL(file), file }));
    if (!incoming.length) return;
    const idx = replaceIndexRef.current;
    replaceIndexRef.current = null;
    setImages((current) => {
      if (idx !== null && idx < current.length) {
        const next = [...current];
        next[idx] = incoming[0];
        return next;
      }
      return [...current, ...incoming];
    });
  };

  const openPicker = (replaceIndex: number | null) => {
    replaceIndexRef.current = replaceIndex;
    pickerRef.current?.click();
  };

  const publish = async () => {
    if (!title.trim()) {
      setError("Donne un titre à ton illustration.");
      return;
    }
    if (!images[0]) {
      setError("Ajoute au moins une image.");
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      await addIllustration({ title: title.trim(), description: description.trim(), files: images.map((image) => image.file) });
      onPublished?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la publication.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ModalShell onClose={onClose} width={980}>
      <ModalHeader title="Upload Illustration" subtitle="Share an artwork to attract scénaristes and manga projects" onClose={onClose} />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, overflowY: "auto" }}>
        {/* Drag area */}
        <label htmlFor={inputId} style={{
          background: C.stage, border: `2px dashed ${C.borderStrong}`, borderRadius: 16,
          padding: 32, textAlign: "center", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10, minHeight: 320, cursor: "pointer",
        }}>
          {activeImage && (
            <img src={activeImage} alt="" style={{ width: "100%", height: "100%", minHeight: 320, objectFit: "cover", borderRadius: 14 }} />
          )}
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: C.neonSoftFill,
            border: `1px solid ${C.neonSoftBorder}`, color: C.neon,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={20} />
          </div>
          <div style={{ ...manrope, fontSize: 14, fontWeight: 700, color: C.text }}>Upload artwork image</div>
          <div style={{ ...manrope, fontSize: 12, color: C.muted }}>Accepted formats placeholder · JPG, PNG, WEBP · up to placeholder size</div>
          <Btn variant="secondary" size="sm" style={{ marginTop: 6 }}>Choose file</Btn>
        </label>
        <input ref={pickerRef} id={inputId} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, gridColumn: "1" }}>
          {images.map((item, index) => (
            <div key={`${item.url}-${index}`} style={{ position: "relative", flex: "0 0 auto" }}>
              <button
                type="button"
                title="Cliquer pour remplacer cette image"
                onClick={() => openPicker(index)}
                style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, background: C.input }}
              >
                <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
              <button
                type="button"
                aria-label="Supprimer cette image"
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#FF5F7E", color: "#04111E", border: "2px solid #0B1430", fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Ajouter une image"
            onClick={() => openPicker(null)}
            style={{ width: 64, height: 64, flex: "0 0 auto", borderRadius: 12, border: "1px dashed rgba(57,255,136,0.45)", background: "rgba(57,255,136,0.06)", color: "#39FF88", fontSize: 22, fontWeight: 900, cursor: "pointer" }}
          >
            +
          </button>
        </div>

        <div style={{ gridColumn: "2", gridRow: "1", display: "grid", gap: 12 }}>
          <Field label="Artwork title *">
            <Input placeholder="Give your artwork a clear title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            placeholder="Describe your artwork, intent, and technical focus…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      {error && (
        <div style={{ margin: "0 24px", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,95,126,0.4)", background: "rgba(255,95,126,0.10)", color: "#ff5f7e", ...manrope, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
      <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon={<Upload size={16} />} onClick={() => void publish()}>
          {publishing ? "Publication…" : "Upload illustration"}
        </Btn>
      </div>
    </ModalShell>
  );
}
