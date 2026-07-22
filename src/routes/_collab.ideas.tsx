import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { addIdea, listIdeas, subscribeIdeas } from "@/lib/db";
import { listFavorites, setFavorite } from "@/lib/favorites";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import {
  Search, X, Bookmark, MessageCircle,
  Sparkles, LayoutGrid, List, Images, ChevronDown, Filter, Check,
  RotateCcw, ImageIcon, Plus,
} from "lucide-react";

export const Route = createFileRoute("/_collab/ideas")({
  component: PropositionsPage,
});

/* ---------------- Data ---------------- */

const CATEGORIES = [
  "All", "Autre", "Système de pouvoirs", "Motivations", "Charadesign", "Worldbuilding", "Équipement",
];
type Prop = {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility: string;
  genres: string[];
  tone: string;
  usage: string;
  complexity: string;
  format: string;
  author: string;
  project?: string;
  summary: string;
  description: string;
  hasImage: boolean;
  hue: number;
  saved: number;
  comments: number;
  mine?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  authorId?: string;
  authorAvatarUrl?: string;
  authorBio?: string;
};


/* ---------------- UI atoms ---------------- */

function Chip({ children, tone="neutral", onRemove, className="", onClick, selected }: {
  children: ReactNode; tone?: "neutral"|"neon"|"warning"|"info"|"danger"; onRemove?: () => void;
  className?: string; onClick?: () => void; selected?: boolean;
}) {
  const t = selected ? "neon" : tone;
  const map: Record<string, string> = {
    neutral: "bg-[var(--input-bg)] text-[var(--text-secondary)] border-[var(--border)]",
    neon:    "bg-[var(--neon-soft)] text-[var(--neon)] border-[var(--neon-border)]",
    warning: "bg-[rgba(255,184,77,0.12)] text-[var(--warning)] border-[rgba(255,184,77,0.35)]",
    info:    "bg-[rgba(117,167,255,0.12)] text-[var(--info)] border-[rgba(117,167,255,0.35)]",
    danger:  "bg-[rgba(255,95,126,0.12)] text-[var(--danger)] border-[rgba(255,95,126,0.35)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-[12px] font-semibold leading-none transition-colors ${map[t]} ${onClick?"hover:brightness-110":""} ${className}`}
    >
      <span className="whitespace-nowrap">{children}</span>
      {onRemove && (
        <span
          role="button"
          aria-label="Remove filter"
          onClick={(e)=>{e.stopPropagation(); onRemove();}}
          className="ml-0.5 -mr-1 grid place-items-center h-4 w-4 rounded-full hover:bg-white/10 cursor-pointer"
        ><X className="h-3 w-3"/></span>
      )}
    </button>
  );
}

// One filter row: title + all options shown at once as selectable chips (no dropdown).
function PrimaryBtn({ children, className="", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-[14px] bg-[var(--neon)] text-[#04111E] font-bold text-sm hover:bg-[var(--neon-hover)] transition-colors ${className}`}
    >{children}</button>
  );
}
function SecondaryBtn({ children, className="", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-[14px] bg-transparent border border-[var(--border-strong)] text-[var(--text)] font-bold text-sm hover:bg-white/[0.04] transition-colors ${className}`}
    >{children}</button>
  );
}
function GhostBtn({ children, className="", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 h-9 px-3 rounded-[12px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.04] transition-colors text-sm font-semibold ${className}`}
    >{children}</button>
  );
}
function IconBtn({ children, className="", label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {label:string}) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={`grid place-items-center h-9 w-9 rounded-[12px] bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--neon-border)] hover:text-[var(--text)] transition-colors ${className}`}
    >{children}</button>
  );
}

function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] mb-2">{label}</span>
      {children}
      {hint && !error && <span className="block mt-1.5 text-[13px] text-[var(--text-muted)]">{hint}</span>}
      {error && <span className="block mt-1.5 text-[13px] text-[var(--danger)]">{error}</span>}
    </label>
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-11 rounded-[14px] bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] px-4 text-sm outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] transition ${props.className??""}`}
    />
  );
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full min-h-[140px] rounded-[14px] bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] px-4 py-3.5 text-sm outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] transition leading-[22px] ${props.className??""}`}
    />
  );
}
function Select({ value, onChange, options, className="" }: { value:string; onChange:(v:string)=>void; options:string[]; className?:string }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full h-11 appearance-none rounded-[14px] bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] px-4 pr-10 text-sm outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] transition"
      >
        {options.map(o => <option key={o} value={o} className="bg-[var(--input-bg)]">{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"/>
    </div>
  );
}

function Thumb({ hue, category, tall=false }: { hue:number; category:string; tall?:boolean }) {
  return (
    <div
      className={`relative w-full ${tall?"aspect-[4/3]":"aspect-[16/10]"} rounded-[12px] overflow-hidden border border-[var(--border)]`}
      style={{
        background:
          `radial-gradient(140% 90% at 10% 10%, hsla(${hue},80%,55%,0.35), transparent 60%),
           radial-gradient(120% 80% at 90% 90%, hsla(${(hue+60)%360},80%,55%,0.28), transparent 60%),
           linear-gradient(180deg, #0E193A, #08112B)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.15]" style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)"
      }}/>
      <div className="absolute bottom-2 left-2">
        <Chip tone="neutral" className="!bg-black/40 backdrop-blur-sm">{category}</Chip>
      </div>
    </div>
  );
}
function NoImagePlaceholder() {
  return (
    <div className="relative w-full aspect-[16/10] rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--details)] grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
        <div className="h-10 w-10 rounded-[12px] border border-[var(--border)] grid place-items-center">
          <Sparkles className="h-5 w-5"/>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em]">Text concept</span>
      </div>
    </div>
  );
}

function PropositionsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [genre, setGenre] = useState("All");
  const [tone, setTone] = useState("All");
  const [usage, setUsage] = useState("All");
  const [complexity, setComplexity] = useState("All");
  const [format, setFormat] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState<"cards"|"list"|"moodboard">("cards");

  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Prop | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [dbProps, setDbProps] = useState<Prop[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Idées réelles (Supabase), affichées avant les exemples
  const refreshIdeas = () => {
    setDataError(null);
    void Promise.all([listIdeas(), listFavorites()])
      .then(([rows, favorites]) => {
        setDbProps(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            status: "Published",
            visibility: "Public",
            genres: [] as string[],
            tone: "—",
            usage: "—",
            complexity: "—",
            format: r.image_url ? "Image included" : "Text only",
            author: r.author?.display_name || r.author?.username || "Utilisateur",
            summary: r.description.slice(0, 160),
            description: r.description,
            hasImage: !!r.image_url,
            hue: 150,
            saved: 0,
            comments: r.commentCount ?? 0,
            imageUrl: r.image_url ?? undefined,
            imageUrls: r.image_urls?.length ? r.image_urls : r.image_url ? [r.image_url] : [],
            authorId: r.author_id,
            authorAvatarUrl: r.author?.avatar_url ?? undefined,
            authorBio: r.authorBio ?? undefined,
          })),
        );
        setSaved(new Set(favorites.filter((item) => item.kind === "Idée").map((item) => item.title)));
      })
      .catch((error) => {
        setDbProps([]);
        setDataError(error instanceof Error ? error.message : "Impossible de charger les idées.");
      });
  };
  useEffect(() => {
    refreshIdeas();
    return subscribeIdeas(refreshIdeas);
  }, []);

  const activeFilters = useMemo(() => {
    const arr: { label:string; clear:()=>void }[] = [];
    if (category !== "All") arr.push({ label:`Category: ${category}`, clear:()=>setCategory("All")});
    if (genre !== "All") arr.push({ label:`Genre: ${genre}`, clear:()=>setGenre("All")});
    if (tone !== "All") arr.push({ label:`Tone: ${tone}`, clear:()=>setTone("All")});
    if (usage !== "All") arr.push({ label:`Usage: ${usage}`, clear:()=>setUsage("All")});
    if (complexity !== "All") arr.push({ label:`Complexity: ${complexity}`, clear:()=>setComplexity("All")});
    if (format !== "All") arr.push({ label:`Format: ${format}`, clear:()=>setFormat("All")});
    if (visibility !== "All") arr.push({ label:`Visibility: ${visibility}`, clear:()=>setVisibility("All")});
    if (status !== "All") arr.push({ label:`Status: ${status}`, clear:()=>setStatus("All")});
    if (search) arr.push({ label:`“${search}”`, clear:()=>setSearch("")});
    return arr;
  }, [category,genre,tone,usage,complexity,format,visibility,status,search]);

  const results = useMemo(() => {
    // Production : uniquement les idées réelles (Supabase), plus d'exemples.
    return [...dbProps].filter(p => {
      if (category!=="All" && p.category!==category) return false;
      if (genre!=="All" && !p.genres.includes(genre)) return false;
      if (tone!=="All" && p.tone!==tone) return false;
      if (usage!=="All" && p.usage!==usage) return false;
      if (complexity!=="All" && p.complexity!==complexity) return false;
      if (format!=="All" && p.format!==format) return false;
      if (visibility!=="All" && p.visibility!==visibility) return false;
      if (status!=="All" && p.status!==status) return false;
      if (search && !`${p.title} ${p.summary} ${p.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [dbProps,category,genre,tone,usage,complexity,format,visibility,status,search]);

  const resetFilters = () => {
    setSearch(""); setCategory("All"); setGenre("All"); setTone("All"); setUsage("All");
    setComplexity("All"); setFormat("All"); setVisibility("All"); setStatus("All");
  };

  const toggleSave = async (idea: Prop) => {
    const nextSaved = !saved.has(idea.title);
    try {
      await setFavorite("Idée", idea.title, nextSaved);
      setSaved((current) => {
        const next = new Set(current);
        if (nextSaved) next.add(idea.title); else next.delete(idea.title);
        return next;
      });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Impossible de modifier ce favori.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-8">
        {/* Page header */}
        <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
          <div className="max-w-3xl">
            <h1 className="font-display text-[28px] leading-[36px] font-bold text-[var(--text)]">Idées</h1>
            <p className="mt-2 text-[14px] leading-[22px] text-[var(--text-secondary)]">
              Explore character ideas, worldbuilding concepts, powers, equipment, motivations, and creative suggestions for manga projects.
            </p>
          </div>
          <PrimaryBtn onClick={() => setShowCreate(true)} className="shrink-0">
            <Plus className="h-4 w-4" /> Créer une idée
          </PrimaryBtn>
        </header>

        {dataError && (
          <div className="mb-5 rounded-[14px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-4 py-3 text-[13px] font-semibold text-[var(--danger)]">
            {dataError}
          </div>
        )}

        {/* Filter panel */}
        <section
          className="rounded-[22px] bg-[var(--panel)] border border-[var(--border)] p-5 md:p-6 shadow-[0_12px_30px_rgba(0,0,0,0.24)] mb-6"
          aria-label="Filters"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"/>
            <TextInput
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Search character designs, powers, equipment, worlds, motivations…"
              className="!pl-11"
              aria-label="Search ideas"
            />
          </div>

          {/* Type de proposition — on-page filter */}
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] mb-2">
              Type d'idée
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c} selected={category===c} onClick={()=>setCategory(c)}>
                  {c === "All" ? "Tous" : c}
                </Chip>
              ))}
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] mr-1">
                <Filter className="inline h-3.5 w-3.5 mr-1 -mt-0.5"/>Active
              </span>
              {activeFilters.map((f) => (
                <Chip key={f.label} tone="neon" onRemove={f.clear}>{f.label}</Chip>
              ))}
              <GhostBtn onClick={resetFilters} className="!h-7 !px-2 !text-[12px]">Clear all</GhostBtn>
            </div>
          )}
        </section>

        {/* Results */}
        <div>
          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-[20px] leading-[28px] font-bold text-[var(--text)]">Idées créatives</h2>
                <p className="text-[13px] leading-[20px] text-[var(--text-muted)] mt-1">
                  Showing {results.length} of {dbProps.length} ideas
                </p>
              </div>
              <div className="inline-flex items-center gap-1 bg-[var(--panel)] border border-[var(--border)] rounded-[14px] p-1">
                {([
                  ["cards", LayoutGrid, "Cards"],
                  ["list", List, "Compact list"],
                  ["moodboard", Images, "Moodboard"],
                ] as const).map(([k, Icon, label]) => (
                  <button
                    key={k}
                    onClick={()=>setView(k)}
                    aria-pressed={view===k}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[13px] font-bold transition-colors ${
                      view===k ? "bg-[var(--neon-soft)] text-[var(--neon)]" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                    }`}
                  >
                    <Icon className="h-4 w-4"/><span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {results.length === 0 ? (
              <EmptyState onReset={resetFilters} onCreate={()=>setShowCreate(true)} />
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map(p => (
                  <PropCard key={p.id} p={p} saved={saved.has(p.title)} onSave={()=>void toggleSave(p)}
                    onOpen={()=>setOpen(p)} />
                ))}
              </div>
            ) : view === "list" ? (
              <div className="rounded-[16px] bg-[var(--panel)] border border-[var(--border)] divide-y divide-[var(--border)]">
                {results.map(p => (
                  <ListRow key={p.id} p={p} saved={saved.has(p.title)}
                    onSave={()=>void toggleSave(p)} onOpen={()=>setOpen(p)} />
                ))}
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 xl:columns-3 gap-4 [column-fill:_balance]">
                {results.map(p => (
                  <MoodItem key={p.id} p={p} onOpen={()=>setOpen(p)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {open && (
        <PropModal
          p={open}
          saved={saved.has(open.title)}
          onSave={()=>void toggleSave(open)}
          onClose={()=>setOpen(null)}
        />
      )}
      {showCreate && <CreateModal onClose={()=>setShowCreate(false)} onCreated={refreshIdeas}/>}
    </div>
  );
}

/* ---------------- Card variants ---------------- */

function PropCard({ p, saved, onSave, onOpen }: {
  p: Prop; saved: boolean; onSave: ()=>void; onOpen: ()=>void;
}) {
  return (
    <article
      className={`rounded-[16px] bg-[var(--card)] border p-5 shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] flex flex-col gap-4 ${
        saved ? "border-[var(--neon-border)] shadow-[0_0_0_1px_rgba(57,255,136,0.35),0_0_18px_rgba(57,255,136,0.10)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Chip tone="neon">{p.category}</Chip>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn label={saved?"Saved":"Save"} onClick={onSave} className={saved?"!text-[var(--neon)] !border-[var(--neon-border)]":""}>
            <Bookmark className={`h-4 w-4 ${saved?"fill-current":""}`}/>
          </IconBtn>
        </div>
      </div>

      {p.imageUrl ? (
        <div className="aspect-[16/10] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--input-bg)]">
          <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
        </div>
      ) : p.hasImage ? <Thumb hue={p.hue} category={p.category}/> : <NoImagePlaceholder/>}

      <div>
        <h3 className="text-[15px] leading-[22px] font-extrabold text-[var(--text)]">{p.title}</h3>
        <p className="mt-2 text-[14px] leading-[22px] text-[var(--text-secondary)] line-clamp-3">{p.description}</p>
      </div>

      <div className="pt-3 border-t border-[var(--border)]">
        {/* Ligne 1 : auteur */}
        <div className="min-w-0 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--input-bg)] border border-[var(--border)] grid place-items-center font-display text-[12px] font-bold text-[var(--neon)]">
            {p.authorAvatarUrl ? <img src={p.authorAvatarUrl} alt="" className="h-full w-full object-cover" /> : p.author.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">Profil</div>
            <div className="text-[13px] font-semibold text-[var(--text-secondary)] truncate">
              {p.author}{p.project && <span className="text-[var(--text-muted)]"> · {p.project}</span>}
            </div>
          </div>
        </div>
        {/* Ligne 2 : actions */}
        <div className="mt-3 flex items-center gap-2">
          <PrimaryBtn className="!h-9 !px-3 !text-[13px]" onClick={onOpen}>View Details</PrimaryBtn>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--input-bg)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--neon-border)] hover:text-[var(--text)]"
          >
            <MessageCircle className="h-3.5 w-3.5"/>{p.comments} commentaire{p.comments > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </article>
  );
}

function ListRow({ p, saved, onSave, onOpen }: { p:Prop; saved:boolean; onSave:()=>void; onOpen:()=>void }) {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
      <div className="hidden sm:block w-20 shrink-0">
        {p.hasImage ? (
          <div className="aspect-square rounded-[10px]" style={{
            background: `radial-gradient(circle at 30% 30%, hsla(${p.hue},80%,55%,0.5), transparent 60%), #0E193A`
          }}/>
        ) : (
          <div className="aspect-square rounded-[10px] bg-[var(--details)] border border-[var(--border)] grid place-items-center text-[var(--text-muted)]">
            <Sparkles className="h-4 w-4"/>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Chip tone="neon">{p.category}</Chip>
        </div>
        <h3 className="text-[15px] leading-[22px] font-extrabold truncate">{p.title}</h3>
        <p className="text-[13px] leading-[20px] text-[var(--text-secondary)] truncate">{p.description}</p>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn label={saved?"Saved":"Save"} onClick={onSave} className={saved?"!text-[var(--neon)] !border-[var(--neon-border)]":""}>
          <Bookmark className={`h-4 w-4 ${saved?"fill-current":""}`}/>
        </IconBtn>
        <PrimaryBtn className="!h-9 !px-3 !text-[13px]" onClick={onOpen}>Open</PrimaryBtn>
      </div>
    </div>
  );
}

function MoodItem({ p, onOpen }: { p:Prop; onOpen:()=>void }) {
  const heights = [180, 240, 200, 280, 220, 260];
  const h = heights[Math.abs(p.id.charCodeAt(1)) % heights.length];
  return (
    <button
      onClick={onOpen}
      className="mb-4 block w-full text-left rounded-[16px] overflow-hidden border border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors break-inside-avoid"
    >
      <div style={{ height: h }} className="relative w-full" >
        {p.hasImage ? (
          <div className="absolute inset-0" style={{
            background: `radial-gradient(140% 90% at 10% 10%, hsla(${p.hue},80%,55%,0.35), transparent 60%),
                         radial-gradient(120% 80% at 90% 90%, hsla(${(p.hue+60)%360},80%,55%,0.28), transparent 60%),
                         linear-gradient(180deg, #0E193A, #08112B)`,
          }}/>
        ) : (
          <div className="absolute inset-0 bg-[var(--details)] grid place-items-center">
            <Sparkles className="h-6 w-6 text-[var(--text-muted)]"/>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Chip tone="neon" className="!bg-black/40 backdrop-blur-sm">{p.category}</Chip>
        </div>
      </div>
      <div className="p-3">
        <div className="text-[13px] font-extrabold text-[var(--text)] line-clamp-1">{p.title}</div>
        <div className="text-[12px] text-[var(--text-muted)] line-clamp-2 mt-1">{p.description}</div>
      </div>
    </button>
  );
}

/* ---------------- Empty state ---------------- */

function EmptyState({ onReset, onCreate }: { onReset:()=>void; onCreate:()=>void }) {
  return (
    <div className="rounded-[16px] bg-[var(--panel)] border border-[var(--border)] p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-[14px] bg-[var(--card)] border border-[var(--border)] grid place-items-center text-[var(--text-muted)] mb-4">
        <Search className="h-6 w-6"/>
      </div>
      <h3 className="font-display text-[20px] leading-[28px] font-bold">Aucune idée trouvée</h3>
      <p className="mt-2 text-[14px] leading-[22px] text-[var(--text-secondary)]">
        Try adjusting your filters.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        <SecondaryBtn onClick={onReset}><RotateCcw className="h-4 w-4"/>Reset filters</SecondaryBtn>
      </div>
    </div>
  );
}

/* ---------------- Modal shell ---------------- */

function ModalShell({ children, onClose, maxWidth="1080px", label }: {
  children: ReactNode; onClose: ()=>void; maxWidth?: string; label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/70 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        className="w-full bg-[var(--panel)] border border-[var(--border-strong)] rounded-t-[24px] sm:rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.55)] flex flex-col max-h-[95vh] sm:max-h-[85vh]"
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- Detail modal ---------------- */

function PropModal({ p, saved, onSave, onClose }: {
  p: Prop; saved: boolean; onSave: ()=>void; onClose: ()=>void;
}) {
  const [tab, setTab] = useState<"details" | "comments">("details");
  const [activeImage, setActiveImage] = useState(0);
  const images = p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
  const authorName = p.author === "You" ? "Votre profil" : p.author.replace(/—/g, "").trim() || "Créateur CollabManga";
  const authorBio = p.authorBio || "Ce membre n'a pas encore renseigné de biographie.";

  return (
    <ModalShell onClose={onClose} maxWidth="1120px" label={`${p.category}: ${p.title}`}>
      <div className="p-6 border-b border-[var(--border)] flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Chip tone="neon">{p.category}</Chip>
          <h2 className="mt-3 font-display text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold">
            {p.title}
          </h2>
        </div>
        <IconBtn label="Close" onClick={onClose}><X className="h-4 w-4"/></IconBtn>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[3fr_4fr] gap-6">
        <div className="space-y-5">
          {images[activeImage] ? (
            <div className="max-h-[60vh] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--input-bg)]">
              <img src={images[activeImage]} alt={p.title} className="h-full w-full object-contain" />
            </div>
          ) : p.hasImage ? <Thumb hue={p.hue} category={p.category} tall/> : <NoImagePlaceholder/>}

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border"
                  style={{ borderColor: index === activeImage ? "var(--neon)" : "var(--border)" }}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

        </div>

        <aside className="rounded-[16px] bg-[var(--card)] border border-[var(--border)] p-5 h-fit">
          <div className="cm-popup-tabs mb-5 w-full" role="tablist" aria-label="Détails de l'idée">
            <button type="button" role="tab" aria-selected={tab === "details"} data-active={tab === "details"} onClick={() => setTab("details")} className="cm-popup-tab flex-1">Détails</button>
            <button type="button" role="tab" aria-selected={tab === "comments"} data-active={tab === "comments"} onClick={() => setTab("comments")} className="cm-popup-tab flex-1">Commentaires</button>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
            Créé par
          </div>
          <a href={p.authorId ? `/profile/${p.authorId}` : "#"} className="mt-4 flex items-center gap-3" title={`Voir le profil de ${authorName}`} style={{ textDecoration: "none" }}>
            <div className="h-12 w-12 overflow-hidden rounded-full bg-[var(--input-bg)] border border-[var(--border)] grid place-items-center font-display font-bold text-[var(--neon)]">
              {p.authorAvatarUrl ? <img src={p.authorAvatarUrl} alt="" className="h-full w-full object-cover" /> : authorName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-display text-[16px] font-bold truncate">{authorName}</div>
              {p.project && <div className="mt-0.5 text-[12px] text-[var(--text-muted)] truncate">{p.project}</div>}
            </div>
          </a>
          <p className="mt-4 text-[14px] leading-[22px] text-[var(--text-secondary)]">{authorBio}</p>
          {tab === "details" ? (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">Type d'idée</div>
              <div className="mt-2"><Chip tone="info">{p.category}</Chip></div>
              <h3 className="mt-5 font-display text-[22px] leading-[30px] font-bold">{p.title}</h3>
              <p className="mt-3 text-[14px] leading-[22px] text-[var(--text-secondary)]">{p.description}</p>
            </div>
          ) : (
            <div className="mt-5">
              <CommentsPanel entityType="idea" entityId={p.id} />
            </div>
          )}
        </aside>
      </div>
    </ModalShell>
  );

}

function CreateModal({ onClose, onCreated }: { onClose: ()=>void; onCreated?: ()=>void }) {
  const [ideaImages, setIdeaImages] = useState<string[]>([]);
  const [ideaFiles, setIdeaFiles] = useState<File[]>([]);
  const [activeIdeaIndex, setActiveIdeaIndex] = useState(0);
  const [ideaCategory, setIdeaCategory] = useState(CATEGORIES[1]);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const ideaInputId = "idea-create-images";
  const activeIdeaImage = ideaImages[activeIdeaIndex];
  const addIdeaFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const urls = incoming.map((file) => URL.createObjectURL(file));
    setIdeaFiles((current) => [...current, ...incoming]);
    setIdeaImages((current) => [...current, ...urls]);
  };

  const submitIdea = async () => {
    setCreateError(null);
    if (!ideaTitle.trim()) { setCreateError("Donne un titre à ton idée."); return; }
    if (!ideaDescription.trim()) { setCreateError("Ajoute une description."); return; }
    setSaving(true);
    try {
      await addIdea({
        title: ideaTitle.trim(),
        category: ideaCategory,
        description: ideaDescription.trim(),
        files: ideaFiles,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="980px" label="Créer une idée">
      <div className="p-6 border-b border-[var(--border)] flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-[24px] leading-[32px] font-bold">Créer une idée</h3>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">Ajoute une idée avec ses images, son type, son titre et sa description.</p>
        </div>
        <IconBtn label="Close" onClick={onClose}><X className="h-4 w-4"/></IconBtn>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto scrollbar-thin">
        <div className="min-w-0">
          <label htmlFor={ideaInputId} className="grid aspect-[4/3] cursor-pointer place-items-center overflow-hidden rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--input-bg)]">
            {activeIdeaImage ? (
              <img src={activeIdeaImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <ImageIcon className="h-8 w-8 text-[var(--neon)]" />
                <div className="text-[14px] font-bold">Importer des images</div>
                <div className="text-[12px] text-[var(--text-muted)]">PNG, JPG, WEBP</div>
              </div>
            )}
          </label>
          <input id={ideaInputId} type="file" accept="image/*" multiple className="hidden" onChange={(event) => addIdeaFiles(event.currentTarget.files)} />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {ideaImages.length > 0 ? ideaImages.map((src, index) => (
              <button key={`${src}-${index}`} type="button" onClick={() => setActiveIdeaIndex(index)} className="h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border bg-[var(--card)]" style={{ borderColor: activeIdeaIndex === index ? "var(--neon)" : "var(--border)" }}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            )) : (
              <div className="h-16 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[12px] font-semibold text-[var(--text-muted)] flex items-center">
                Les images importées apparaîtront ici.
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Type d'idée">
            <Select value={ideaCategory} onChange={setIdeaCategory} options={CATEGORIES.filter((c) => c !== "All")} />
          </Field>
          <Field label="Titre">
            <TextInput placeholder="Titre de l'idée" value={ideaTitle} onChange={(e)=>setIdeaTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <TextArea placeholder="Décris l'idée, son intérêt et son usage possible." value={ideaDescription} onChange={(e)=>setIdeaDescription(e.target.value)} />
          </Field>
          {createError && (
            <div className="rounded-[12px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-4 py-3 text-[13px] font-semibold text-[var(--danger)]">
              {createError}
            </div>
          )}
        </div>
      </div>
      <div className="p-5 border-t border-[var(--border)] flex items-center justify-end gap-2">
        <SecondaryBtn onClick={onClose}>Annuler</SecondaryBtn>
        <PrimaryBtn onClick={submitIdea}><Check className="h-4 w-4"/>{saving ? "Publication…" : "Ajouter l'idée"}</PrimaryBtn>
      </div>
    </ModalShell>
  );
}
