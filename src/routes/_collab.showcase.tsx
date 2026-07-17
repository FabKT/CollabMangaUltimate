import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { addIllustration, listIllustrations, startConversationWith } from "@/lib/db";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import {
  X, Upload, Bookmark, BookmarkCheck, MessageSquare, Send, ChevronRight, ChevronLeft,
  LayoutGrid, Rows3, Columns3, Sparkles, Eye, Heart, Plus, Image as ImageIcon,
  UserPlus, ExternalLink, MoreHorizontal, ZoomIn, ZoomOut, Palette, Zap, Check,
} from "lucide-react";

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
const STYLES = ["All styles","Shonen","Seinen","Shojo","Fantasy manga","Dark manga","Action manga","Sports manga","Comedy manga","Webtoon","Semi-realistic","Realistic manga hybrid","Chibi","Retro anime","Experimental","Other"];
const GENRES = ["All genres","Action","Adventure","Fantasy","Romance","Comedy","Drama","Horror","Mystery","Sports","Slice of life","Sci-fi","Supernatural","Psychological","Historical","Other"];
const TYPES = ["All types","Character design","Full illustration","Manga page","Panel sample","Cover art","Background","Creature design","Weapon design","Outfit design","Expression sheet","Pose study","Sketch","Line art","Colored artwork","Other"];
const SKILLS = ["All skills"];
const TECHS = ["All techniques","Digital","Traditional","Black and white","Full color","Screentone","Line art","Painted","Sketch","Mixed media","AI-assisted","Other"];
const AVAILS = ["Any availability","Available now","Open to projects","Open to short missions","Long-term collaboration","Limited availability","Not available","To define"];

const ROLES = ["Dessinateur","Scénariste","Créateur de contenu","Lecteur"];

type Art = {
  id: string; title: string; artist: string; role: string; style: string; type: string;
  skills: string[]; availability: "Available now" | "Open to projects" | "Limited" | "Not available";
  ratio: Ratio; seed: number; views: number; saves: number;
  imageUrl?: string; description?: string; authorId?: string;
};

const ART_TITLES = [
  "Ronin sous la pluie", "Alliage nocturne", "Cité fantôme", "Serment silencieux", "Éclat de lame",
  "Jardin des cendres", "Toits de Kyoto", "Regard d'orage", "Fleur d'encre", "Duel au crépuscule",
  "Voile écarlate", "Sentinelle de fer", "Aube brisée", "Marée d'ombres",
];
const ART_ARTISTS = [
  "Aiko Tanaka", "Léo Vasseur", "Mika Ito", "Hana Kimura", "Ren Sato",
  "Yui Nakamura", "Sora Fujimoto", "Kenji Watanabe", "Emma Laurent", "Nao Ishida",
  "Théo Marchand", "Rina Abe", "Louis Bernard", "Chloé Girard",
];

const ARTS: Art[] = Array.from({ length: 14 }).map((_, i) => {
  const ratios: Ratio[] = ["portrait", "square", "page", "landscape", "cover", "portrait", "square", "page"];
  const styles = ["Shonen","Seinen","Dark manga","Fantasy manga","Webtoon","Semi-realistic","Action manga","Shojo"];
  const types = ["Character design","Manga page","Cover art","Full illustration","Panel sample","Expression sheet","Background","Line art"];
  const availOpts: Art["availability"][] = ["Available now","Open to projects","Available now","Limited","Open to projects","Available now","Limited","Open to projects"];
  const skillSets = [["Illustration"],["Manga page"],["Cover art"],["Character design"],["Visual style"],["Line work"],["Portfolio"],["Manga art"]];
  return {
    id: `art-${i}`, title: ART_TITLES[i % ART_TITLES.length], artist: ART_ARTISTS[i % ART_ARTISTS.length], role: "Artist",
    style: styles[i % styles.length], type: types[i % types.length],
    skills: skillSets[i % skillSets.length], availability: availOpts[i % availOpts.length],
    ratio: ratios[i % ratios.length], seed: i + 3, views: 0, saves: 0,
  };
});

/* ---------------- Page ---------------- */
function IllustrationsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"masonry" | "grid" | "compact">("masonry");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [openArt, setOpenArt] = useState<Art | null>(null);
  const [invite, setInvite] = useState<Art | null>(null);
  const [contact, setContact] = useState<Art | null>(null);
  const [upload, setUpload] = useState(false);
  const [portfolio, setPortfolio] = useState<Art | null>(null);
  const [realArts, setRealArts] = useState<Art[]>([]);

  // Illustrations réelles (Supabase) — seule source de la galerie
  const refreshGallery = () => {
    listIllustrations()
      .then((rows) =>
        setRealArts(
          rows.map((r, i) => ({
            id: r.id,
            title: r.title,
            artist: r.author?.display_name || r.author?.username || "Artiste",
            role: "Artist",
            style: "—",
            type: "Illustration",
            skills: [],
            availability: "Available now" as const,
            ratio: "portrait" as Ratio,
            seed: i + 100,
            views: 0,
            saves: 0,
            imageUrl: r.image_url,
            description: r.description,
            authorId: r.author_id,
          })),
        ),
      )
      .catch(() => setRealArts([]));
  };
  useEffect(refreshGallery, []);

  // Production : uniquement les illustrations réelles (Supabase), plus d'exemples.
  const gallery = [...realArts];

  function toggleSave(id: string) {
    setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Esc to close modals
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (invite) return setInvite(null);
      if (contact) return setContact(null);
      if (upload) return setUpload(false);
      if (portfolio) return setPortfolio(null);
      if (openArt) return setOpenArt(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openArt, invite, contact, upload, portfolio]);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", ...manrope }}>
      <div className="cm-page" style={{ maxWidth: 1600, margin: "0 auto", padding: 32 }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ ...sora, fontSize: 28, fontWeight: 700, lineHeight: "36px", margin: 0, color: C.text }}>Illustrations</h1>
            <p style={{ ...manrope, fontSize: 14, fontWeight: 500, lineHeight: "22px", color: C.text2, margin: "8px 0 0", maxWidth: 640 }}>
              Discover manga artists, evaluate their visual style, and invite them to collaborate on original projects.
            </p>
          </div>
        </header>

        {/* Gallery */}
        <section>
          {/* Gallery header — view switch only */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ ...manrope, fontSize: 12, color: C.muted, fontWeight: 600, marginRight: 4 }}>View</span>
              <IconBtn active={view === "masonry"} onClick={() => setView("masonry")} title="Masonry"><Rows3 size={16} /></IconBtn>
              <IconBtn active={view === "grid"} onClick={() => setView("grid")} title="Grid"><LayoutGrid size={16} /></IconBtn>
              <IconBtn active={view === "compact"} onClick={() => setView("compact")} title="Compact"><Columns3 size={16} /></IconBtn>
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
              <div style={{ ...sora, fontSize: 20, fontWeight: 700 }}>Aucune illustration publiée</div>
              <p style={{ ...manrope, fontSize: 14, color: C.text2, marginTop: 8 }}>
                La galerie se remplit à mesure que les artistes publient. Publie la première depuis le bouton « Upload Artwork ».
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
                  liked={saved.has(a.id)} onLike={() => toggleSave(a.id)}
                  onOpen={() => setOpenArt(a)}
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
                .then(() => navigate({ to: "/messages" }))
                .catch(() => setContact(openArt));
            } else setContact(openArt);
          }}
          onPortfolio={() => setPortfolio(openArt)}
          saved={saved.has(openArt.id)}
          onSave={() => toggleSave(openArt.id)}
          onOpenArt={(a) => setOpenArt(a)}
        />
      )}
      {invite && <InviteModal art={invite} onClose={() => setInvite(null)} />}
      {contact && <ContactModal art={contact} onClose={() => setContact(null)} />}
      {upload && <UploadModal onClose={() => setUpload(false)} onPublished={refreshGallery} />}
      {portfolio && (
        <PortfolioModal
          art={portfolio}
          works={realArts.filter((a) => a.artist === portfolio.artist)}
          onClose={() => setPortfolio(null)}
          onOpenArt={(a) => { setPortfolio(null); setOpenArt(a); }}
        />
      )}

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
  art, masonry, compact, liked, onLike, onOpen,
}: {
  art: Art; masonry?: boolean; compact?: boolean; liked: boolean;
  onLike: () => void; onOpen: () => void;
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
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: `linear-gradient(135deg, hsl(${(art.seed * 47) % 360} 60% 40%), hsl(${(art.seed * 73) % 360} 60% 25%))`,
              border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center",
              ...manrope, fontSize: 12, fontWeight: 800, color: C.text, flexShrink: 0,
            }}>
              A
            </div>
            <span style={{ ...manrope, fontSize: 14, fontWeight: 800, color: C.text }}>{art.artist}</span>
          </div>

          {/* view details + like + comment */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Btn variant="secondary" size="sm" full onClick={onOpen}>View Details</Btn>
            </div>
            <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 8 }}>
              <IconBtn title={liked ? "Unlike" : "Like"} active={liked} onClick={onLike}>
                <Heart size={15} fill={liked ? C.neon : "none"} />
              </IconBtn>
              <IconBtn title="Comment" onClick={onOpen}><MessageSquare size={15} /></IconBtn>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.input, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <span style={{ ...manrope, fontSize: 13, color: C.text2 }}>{label}</span>
      <span style={{ ...manrope, fontSize: 15, fontWeight: 800, color: value === "--" ? C.muted : C.neon }}>{value}</span>
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
  art, works = [], onClose, onInvite, onContact, onPortfolio, saved, onSave, onOpenArt,
}: {
  art: Art; works?: Art[]; onClose: () => void; onInvite: () => void; onContact: () => void;
  onPortfolio: () => void; saved: boolean; onSave: () => void; onOpenArt?: (a: Art) => void;
}) {
  const [tab, setTab] = useState<"profile" | "comments">("profile");

  return (
    <ModalShell onClose={onClose} width={1180}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(280px, 2fr)", gap: 0, flex: 1, minHeight: 0 }}>
        {/* Left: viewer */}
        <div style={{ background: C.stage, padding: 24, display: "flex", flexDirection: "column", gap: 16, position: "relative", minHeight: 520 }}>
          <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, zIndex: 2 }}>
            <IconBtn title="Previous"><ChevronLeft size={16} /></IconBtn>
            <IconBtn title="Next"><ChevronRight size={16} /></IconBtn>
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, zIndex: 2 }}>
            <IconBtn title="Zoom out"><ZoomOut size={16} /></IconBtn>
            <IconBtn title="Zoom in"><ZoomIn size={16} /></IconBtn>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              {art.imageUrl ? (
                <img src={art.imageUrl} alt={art.title} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 14 }} />
              ) : (
                <ArtworkPlaceholder seed={art.seed} ratio={art.ratio} />
              )}
            </div>
          </div>
        </div>

        {/* Right: info scroll */}
        <div style={{ background: C.details, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ ...sora, fontSize: 18, fontWeight: 800, lineHeight: "26px", margin: 0 }}>{art.title}</h2>
              <div style={{ ...manrope, fontSize: 12, color: C.muted, marginTop: 3 }}>{art.type}</div>
            </div>
            <IconBtn title="Close" onClick={onClose}><X size={16} /></IconBtn>
          </div>

          <div className="cm-popup-tabs" role="tablist" aria-label="Détails de l'illustration" style={{ width: "100%" }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "profile"}
              data-active={tab === "profile"}
              onClick={() => setTab("profile")}
              className="cm-popup-tab"
              style={{ flex: 1 }}
            >
              Profil
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
              Commentaires
            </button>
          </div>

          {tab === "profile" ? (
            <>
          {/* Artist top */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 48, height: 48, minWidth: 48, flexShrink: 0, borderRadius: "50%",
                background: `linear-gradient(135deg, hsl(${(art.seed * 47) % 360} 60% 40%), hsl(${(art.seed * 73) % 360} 60% 25%))`,
                border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center",
                justifyContent: "center", ...manrope, fontSize: 16, fontWeight: 800,
              }}>{art.artist.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
              <div>
                <div style={{ ...manrope, fontSize: 14, fontWeight: 800, color: C.text }}>{art.artist}</div>
                <div style={{ ...manrope, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginTop: 2 }}>Artist</div>
              </div>
            </div>
            <Chip tone={art.availability === "Available now" ? "neon" : "info"}>{art.availability}</Chip>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn variant="primary" icon={<UserPlus size={16} />} onClick={onInvite}>Invite to Project</Btn>
            <Btn variant="secondary" icon={<MessageSquare size={16} />} onClick={onContact}>Contact Artist</Btn>
            <Btn variant="ghost" icon={saved ? <BookmarkCheck size={16} color={C.neon} /> : <Bookmark size={16} />} onClick={onSave}>
              {saved ? "Saved" : "Save Artwork"}
            </Btn>
          </div>

          <Section title="Artwork description">
            <p style={{ ...manrope, fontSize: 14, color: C.text2, lineHeight: "22px", margin: 0 }}>
              {art.description || "Aucune description fournie."}
            </p>
          </Section>

          <Section title="More from this artist">
            {works.length === 0 ? (
              <p style={{ ...manrope, fontSize: 13, color: C.muted, margin: 0 }}>Aucune autre illustration de cet artiste pour l'instant.</p>
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
            <Section title="Commentaires">
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...manrope, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ ...manrope, fontSize: 14, fontWeight: 700, color: C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ---------------- Invite Modal ---------------- */
function InviteModal({ art, onClose }: { art: Art; onClose: () => void }) {
  const [role, setRole] = useState(ROLES[0]);
  const [mode, setMode] = useState("Rémunéré");
  return (
    <ModalShell onClose={onClose} width={640}>
      <ModalHeader title="Invite to project" subtitle={`Send a project invitation to ${art.artist}`} onClose={onClose} />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, overflowY: "auto" }}>
        <Field label="Manga project">
          <Select value="Select one of your projects" onChange={() => {}} options={["Select one of your projects","Project placeholder A","Project placeholder B","Project placeholder C"]} />
        </Field>
        <Field label="Proposed role">
          <Select value={role} onChange={setRole} options={ROLES} />
        </Field>
        <Field label="Collaboration mode">
          <Select value={mode} onChange={setMode} options={["Rémunéré", "Non rémunéré"]} />
        </Field>
        <Field label="Invitation message">
          <Textarea placeholder="Introduce the project, expectations, timeline and why this artist is a fit…" />
        </Field>
        <Field label="Attach project summary">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip icon={<Plus size={12} />}>Attach announcement</Chip>
            <Chip icon={<Plus size={12} />}>Attach project brief</Chip>
          </div>
        </Field>
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon={<Send size={16} />} onClick={onClose}>Send invitation</Btn>
      </div>
    </ModalShell>
  );
}

/* ---------------- Contact Modal ---------------- */
function ContactModal({ art, onClose }: { art: Art; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} width={620}>
      <ModalHeader title="Contact artist" subtitle={`Send a message to ${art.artist}`} onClose={onClose} />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, overflowY: "auto" }}>
        <Field label="Message subject">
          <Input placeholder="Short subject about your project or intent" />
        </Field>
        <Field label="Message content">
          <Textarea placeholder="Introduce yourself, your project, and why you're reaching out…" />
        </Field>
        <Field label="Optional project attachment">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip icon={<Plus size={12} />}>Attach project</Chip>
            <Chip icon={<Plus size={12} />}>Attach announcement</Chip>
          </div>
        </Field>
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon={<Send size={16} />} onClick={onClose}>Send message</Btn>
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
      await addIllustration({ title: title.trim(), description: description.trim(), file: images[0].file });
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

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", background: C.input, border: `1px solid ${C.border}`,
        borderRadius: 12, cursor: "pointer",
      }}
    >
      <span style={{ ...manrope, fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
      <span style={{
        width: 38, height: 22, borderRadius: 999, background: on ? C.neon : C.card,
        position: "relative", transition: "all 160ms", border: `1px solid ${on ? C.neonSoftBorder : C.border}`,
      }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%",
          background: on ? "#04111E" : C.text2, transition: "all 160ms",
        }} />
      </span>
    </button>
  );
}

/* ---------------- Portfolio Modal ---------------- */
function PortfolioModal({ art, works, onClose, onOpenArt }: { art: Art; works: Art[]; onClose: () => void; onOpenArt: (a: Art) => void }) {
  return (
    <ModalShell onClose={onClose} width={1080}>
      <ModalHeader title="Artist portfolio" subtitle="Complete artist portfolio preview" onClose={onClose} />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, overflowY: "auto" }}>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: `linear-gradient(135deg, hsl(${(art.seed * 47) % 360} 60% 40%), hsl(${(art.seed * 73) % 360} 60% 25%))`,
            border: `1px solid ${C.border}`, display: "inline-flex", alignItems: "center",
            justifyContent: "center", ...manrope, fontSize: 32, fontWeight: 800,
          }}>A</div>
          <div>
            <div style={{ ...sora, fontSize: 20, fontWeight: 700 }}>{art.artist}</div>
            <div style={{ ...manrope, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginTop: 4 }}>Artist</div>
          </div>
          <Chip tone="neon">{art.availability}</Chip>
          <p style={{ ...manrope, fontSize: 13, color: C.text2, lineHeight: "20px", margin: 0 }}>
            Bio placeholder introducing the artist's background, favorite genres, main influences and collaboration intent.
          </p>
          <div>
            <div style={{ ...manrope, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Main styles</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Chip>{art.style}</Chip><Chip>Shonen</Chip><Chip>Dark manga</Chip>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn variant="primary" full icon={<UserPlus size={16} />}>Invite to Project</Btn>
            <Btn variant="secondary" full icon={<MessageSquare size={16} />}>Contact Artist</Btn>
          </div>
        </aside>
        <div>
          <div style={{ ...sora, fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Portfolio artworks</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {works.map((w) => (
              <button key={w.id} onClick={() => onOpenArt(w)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                <ArtworkPlaceholder seed={w.seed} ratio={w.ratio === "landscape" ? "square" : w.ratio} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
