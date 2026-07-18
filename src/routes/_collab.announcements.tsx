import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listAnnouncements } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { addInterested, listInterested } from "@/lib/announcement-interest";
import { SITE_LANGUAGES, languageLabel } from "@/lib/languages";
import {
  Bookmark,
  X,
  ChevronDown,
  ImageIcon,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  respondToProposal,
  sendAnnouncementSponsoring,
  sendCollaborationInvitation,
} from "@/lib/user-workflows";

export const Route = createFileRoute("/_collab/announcements")({
  head: () => ({ meta: [{ title: "Annonces — CollabManga" }] }),
  component: AnnouncementsPage,
});

// ---------- Design tokens (inline for isolation from any global overrides) ----------
const C = {
  bg: "#050B1D",
  panel: "#0B1430",
  card: "#101B3F",
  input: "#0E193A",
  details: "#08112B",
  text: "#F7FAFF",
  sec: "#B8C4E5",
  muted: "#7F8CB3",
  disabled: "#5E6A90",
  neon: "#39FF88",
  neonHover: "#25E575",
  neonSoftFill: "rgba(57, 255, 136, 0.12)",
  neonSoftBorder: "rgba(57, 255, 136, 0.45)",
  border: "rgba(133, 154, 206, 0.18)",
  borderStrong: "rgba(133, 154, 206, 0.28)",
  danger: "#FF5F7E",
};

const sora = { fontFamily: '"Sora", ui-sans-serif, system-ui, sans-serif' };
const manrope = { fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif' };

// ---------- Mock data ----------
export type ProjectAnnouncement = {
  kind: "project";
  id: string;
  title: string;
  projectName: string;
  cover?: string;
  description: string;
  roleNeeded: string;
  remuneration: boolean;
  engagement: "Long terme" | "Ponctuel";
  genre: string;
  mode: string;
  availability: string;
  status: string;
  language: string;
  experience: string;
  requiredSkills: string[];
  fullDescription: string;
  requirements: string;
  contribution: string;
  team: string;
  application: string;
};

type UserAnnouncement = {
  kind: "user";
  id: string;
  title: string;
  userName: string;
  avatarInitials: string;
  portfolioImage?: string;
  description: string;
  roleOffered: string;
  remuneration: boolean;
  engagement: "Long terme" | "Ponctuel";
  mainSkill: string;
  genre: string;
  availability: string;
  language: string;
  experience: string;
  mainSkills: string[];
  preferredGenres: string[];
  mode: string;
  fullDescription: string;
  lookingFor: string;
  contact: string;
};

type Announcement = ProjectAnnouncement | UserAnnouncement;

// ---------- Reusable primitives ----------

function PrimaryButton({
  children,
  onClick,
  type = "button",
  fullWidth,
  leftIcon,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...manrope,
        background: hover ? C.neonHover : C.neon,
        color: "#04111E",
        height: 44,
        padding: "0 18px",
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: "20px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : undefined,
        border: "none",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
    >
      {leftIcon}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  fullWidth,
  leftIcon,
}: {
  children: ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...manrope,
        background: hover ? "rgba(255,255,255,0.04)" : C.card,
        color: C.text,
        height: 44,
        padding: "0 18px",
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 700,
        lineHeight: "20px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : undefined,
        border: `1px solid ${hover ? "rgba(133,154,206,0.40)" : C.borderStrong}`,
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      {leftIcon}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...manrope,
        background: "transparent",
        color: hover ? C.text : C.sec,
        height: 44,
        padding: "0 14px",
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36,
        height: 36,
        background: C.card,
        border: `1px solid ${hover ? "rgba(133,154,206,0.40)" : C.border}`,
        borderRadius: 12,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.sec,
        cursor: "pointer",
        transition: "border-color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  leftIcon,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  leftIcon?: ReactNode;
  ariaLabel: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 260px",
        minWidth: 200,
      }}
    >
      {leftIcon && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: C.muted,
            display: "flex",
          }}
        >
          {leftIcon}
        </div>
      )}
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{
          ...manrope,
          width: "100%",
          background: C.input,
          border: `1px solid ${focus ? C.neon : "rgba(133,154,206,0.20)"}`,
          boxShadow: focus ? "0 0 0 3px rgba(57,255,136,0.10)" : "none",
          color: C.text,
          borderRadius: 14,
          height: 44,
          padding: leftIcon ? "0 14px 0 38px" : "0 14px",
          fontSize: 14,
          fontWeight: 500,
          outline: "none",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        }}
      />
    </div>
  );
}

function Chip({
  children,
  active,
  onRemove,
}: {
  children: ReactNode;
  active?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        ...manrope,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        background: active ? C.neonSoftFill : C.input,
        border: `1px solid ${active ? C.neonSoftBorder : C.border}`,
        color: active ? C.neon : C.sec,
        whiteSpace: "nowrap",
      }}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          style={{
            display: "inline-flex",
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            padding: 0,
            marginLeft: 2,
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        ...manrope,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: C.muted,
      }}
    >
      {children}
    </div>
  );
}

// ---------- Constants ----------

const ROLES = [
  "Dessinateur",
  "Scénariste",
  "Créateur de contenu",
  "Lecteur",
];




// ---------- Filter options ----------

const GENRES_FR = ["Shonen", "Shojo", "Seinen", "Josei"];
const SOUS_GENRES = ["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"];

// ---------- Page ----------

const ROLE_FILTERS = ROLES;
const SEARCH_TARGETS = [
  { value: "", label: "Tout" },
  { value: "project", label: "Rechercher un projet" },
  { value: "collaborator", label: "Rechercher un collaborateur" },
] as const;

type Filters = {
  search: string;
  target: "" | "project" | "collaborator";
  langue: string[];
  statut: string;
  typeAnnonce: string;
  genres: string[];
  sousGenres: string[];
  remunerationOnly: boolean;
  engagement: "" | "Long terme" | "Ponctuel";
};

const EMPTY_FILTERS: Filters = {
  search: "",
  target: "",
  langue: [],
  statut: "",
  typeAnnonce: "",
  genres: [],
  sousGenres: [],
  remunerationOnly: false,
  engagement: "",
};

function itemRole(item: Announcement) {
  return item.kind === "project" ? item.roleNeeded : item.roleOffered;
}

function remunerationLabel(item: Announcement) {
  return item.remuneration ? "Rémunération active" : "Sans rémunération";
}

function itemLanguageMatches(item: Announcement, selected: string[]) {
  if (selected.length === 0) return true;
  const language = item.language.toLowerCase();
  return selected.some((lang) => {
    if (lang === "FR") return language.includes("french") || language.includes("fr");
    if (lang === "ENG") return language.includes("english") || language.includes("eng");
    if (lang === "ES") return language.includes("spanish") || language.includes("es");
    if (lang === "IT") return language.includes("italian") || language.includes("it");
    if (lang === "JP") return language.includes("japanese") || language.includes("jp");
    return false;
  });
}

function itemGenre(item: Announcement) {
  return item.genre ?? "Shonen";
}

function itemSubGenres(item: Announcement): string[] {
  return item.kind === "project" ? item.requiredSkills : item.preferredGenres;
}

function itemSearchText(item: Announcement) {
  const base =
    item.kind === "project"
      ? [
          item.title,
          item.projectName,
          item.description,
          item.roleNeeded,
          itemGenre(item),
          ...itemSubGenres(item),
          item.status,
          item.language,
        ]
      : [
          item.title,
          item.userName,
          item.description,
          item.roleOffered,
          item.mainSkill,
          itemGenre(item),
          ...itemSubGenres(item),
          item.language,
        ];
  return base.join(" ").toLowerCase();
}

function AnnouncementsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detailsFor, setDetailsFor] = useState<Announcement | null>(null);
  const [workflowModal, setWorkflowModal] = useState<null | { kind: "apply" | "invite" | "sponsor"; item: Announcement }>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserAnnouncement[]>([]);
  const [dbProjects, setDbProjects] = useState<ProjectAnnouncement[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Annonces réelles (Supabase), affichées avant les exemples
  useEffect(() => {
    listAnnouncements()
      .then((rows) => {
        const users: UserAnnouncement[] = [];
        const projects: ProjectAnnouncement[] = [];
        for (const r of rows) {
          const author = r.author?.display_name || r.author?.username || "Utilisateur";
          if (r.mode === "project") {
            projects.push({
              kind: "project",
              id: r.id,
              title: r.title,
              projectName: r.project_title || r.title,
              description: r.hook || r.description.slice(0, 160),
              roleNeeded: r.status_sought || "—",
              genre: r.genres[0] ?? "—",
              mode: "À définir",
              availability: "À définir",
              status: "Open",
              language: r.language,
              experience: "—",
              remuneration: false,
              engagement: "Long terme",
              requiredSkills: r.subgenres.slice(0, 3),
              fullDescription: r.description,
              requirements: "",
              contribution: "",
              team: "",
              application: "",
            });
          } else {
            users.push({
              kind: "user",
              id: r.id,
              title: r.title,
              userName: author,
              avatarInitials: author.slice(0, 2).toUpperCase(),
              description: r.hook || r.description.slice(0, 160),
              roleOffered: r.status_sought || "—",
              remuneration: false,
              engagement: "Long terme",
              mainSkill: r.status_sought || "—",
              genre: r.genres[0] ?? "—",
              availability: "À définir",
              language: r.language,
              experience: "—",
              mainSkills: r.status_sought ? [r.status_sought] : [],
              preferredGenres: [...r.genres, ...r.subgenres].slice(0, 5),
              mode: "À définir",
              fullDescription: r.description,
              lookingFor: r.hook,
              contact: "",
            });
          }
        }
        setDbUsers(users);
        setDbProjects(projects);
      })
      .catch(() => {
        setDbUsers([]);
        setDbProjects([]);
      });
  }, []);

  // Production : uniquement les annonces réelles (Supabase), plus aucun exemple.
  const data: Announcement[] =
    filters.target === "project"
      ? [...dbUsers]
      : filters.target === "collaborator"
        ? [...dbProjects]
        : [...dbProjects, ...dbUsers];

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const query = filters.search.trim().toLowerCase();
      if (query && !itemSearchText(a).includes(query)) return false;
      if (!itemLanguageMatches(a, filters.langue)) return false;
      if (filters.statut && itemRole(a) !== filters.statut) return false;
      if (filters.remunerationOnly && !a.remuneration) return false;
      if (filters.engagement && a.engagement !== filters.engagement) return false;
      if (filters.genres.length > 0 && !filters.genres.includes(itemGenre(a))) return false;
      if (filters.sousGenres.length > 0 && !filters.sousGenres.some((sg) => itemSubGenres(a).includes(sg))) return false;
      return true;
    });
  }, [data, filters]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        ...manrope,
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "var(--page-pad, 32px)",
        }}
        className="cm-page"
      >
        {/* Page Header */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 340px" }}>
            <h1
              style={{
                ...sora,
                fontSize: 28,
                fontWeight: 700,
                lineHeight: "36px",
                color: C.text,
                margin: 0,
              }}
            >
              Announcements
            </h1>
            <p
              style={{
                ...manrope,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: "22px",
                color: C.sec,
                margin: "8px 0 0",
                maxWidth: 640,
              }}
            >
              Find manga projects looking for collaborators or creators looking for a project.
            </p>
          </div>
        </header>

        <AnnouncementFilterBar filters={filters} setFilters={setFilters} />

        {/* Grid */}
        {loading ? (
          <CardGrid>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </CardGrid>
        ) : filtered.length === 0 ? (
          <EmptyState onReset={() => setFilters(EMPTY_FILTERS)} />
        ) : (
          <CardGrid>
            {filtered.map((a) =>
              a.kind === "project" ? (
                <ProjectCard
                  key={a.id}
                  item={a}
                  onView={() => setDetailsFor(a)}
                  onApply={() => setWorkflowModal({ kind: "apply", item: a })}
                />
              ) : (
                <UserCard
                  key={a.id}
                  item={a}
                  onView={() => setDetailsFor(a)}
                  onInvite={() => setWorkflowModal({ kind: "invite", item: a })}
                />
              ),
            )}
          </CardGrid>
        )}
      </div>

      {detailsFor && (
        <DetailsModal
          item={detailsFor}
          onClose={() => setDetailsFor(null)}
          onApply={() => setWorkflowModal({ kind: "apply", item: detailsFor })}
        />
      )}
      {workflowModal && (
        <AnnouncementWorkflowModal
          action={workflowModal.kind}
          item={workflowModal.item}
          onClose={() => setWorkflowModal(null)}
          onDone={(message) => {
            setWorkflowModal(null);
            setFeedback(message);
            window.setTimeout(() => setFeedback(null), 3200);
          }}
        />
      )}
      {feedback && <WorkflowToast>{feedback}</WorkflowToast>}

      <style>{`
        .cm-page { padding: 32px; }
        @media (max-width: 1024px) { .cm-page { padding: 24px; } }
        @media (max-width: 640px) { .cm-page { padding: 16px; } }
        body { background: ${C.bg}; }
      `}</style>
    </div>
  );
}

function AnnouncementFilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedCount =
    filters.langue.length +
    filters.genres.length +
    filters.sousGenres.length +
    (filters.remunerationOnly ? 1 : 0) +
    (filters.engagement ? 1 : 0);
  const setRole = (role: string) => setFilters((f) => ({ ...f, statut: role }));
  const setTarget = (target: Filters["target"]) => setFilters((f) => ({ ...f, target }));

  return (
    <section
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 22,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <TextInput
          value={filters.search}
          onChange={(value) => setFilters((f) => ({ ...f, search: value }))}
          placeholder="Rechercher une annonce, un projet, un role..."
          ariaLabel="Rechercher une annonce"
          leftIcon={<Search size={16} />}
        />
        <SecondaryButton
          onClick={() => setAdvancedOpen(true)}
          leftIcon={<SlidersHorizontal size={16} />}
        >
          Filtres avancés{advancedCount > 0 ? ` (${advancedCount})` : ""}
        </SecondaryButton>
      </div>

      <div style={{ marginTop: 18 }}>
        <FilterChipRow label="Je veux">
          {SEARCH_TARGETS.map((target) => (
            <FilterChip
              key={target.value || "all"}
              label={target.label}
              active={filters.target === target.value}
              onClick={() => setTarget(target.value)}
            />
          ))}
        </FilterChipRow>
      </div>

      <FilterChipRow label="Rôle">
        <FilterChip label="Tout" active={filters.statut === ""} onClick={() => setRole("")} />
        {ROLE_FILTERS.map((role) => (
          <FilterChip
            key={role}
            label={role}
            active={filters.statut === role}
            onClick={() => setRole(role)}
          />
        ))}
      </FilterChipRow>

      {advancedOpen && (
        <AnnouncementAdvancedFiltersModal
          filters={filters}
          setFilters={setFilters}
          onClose={() => setAdvancedOpen(false)}
        />
      )}
    </section>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}

// ---------- Cards ----------

function CardShell({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      tabIndex={0}
      style={{
        background: C.card,
        border: `1px solid ${hover ? "rgba(133,154,206,0.34)" : C.border}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 160ms ease, border-color 160ms ease",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </article>
  );
}

function CategoryChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        ...manrope,
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: C.input,
        border: `1px solid ${C.border}`,
        color: C.sec,
      }}
    >
      {children}
    </span>
  );
}

function RemunerationBadge() {
  return (
    <span
      aria-label="Rémunération active"
      title="Rémunération active"
      style={{
        ...sora,
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.neonSoftFill,
        border: `1px solid ${C.neonSoftBorder}`,
        color: C.neon,
        fontSize: 15,
        fontWeight: 900,
      }}
    >
      €
    </span>
  );
}

function CoverArt({ title }: { title: string }) {
  // Deterministic hue per title for visual variety without real images
  const hue = Array.from(title).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 14,
        overflow: "hidden",
        background: `linear-gradient(135deg, hsl(${hue} 55% 22%) 0%, hsl(${(hue + 40) % 360} 60% 12%) 60%, #08112B 100%)`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.14), transparent 60%), radial-gradient(circle at 80% 80%, rgba(57,255,136,0.10), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 999,
          background: "rgba(5, 11, 29, 0.6)",
          border: `1px solid ${C.border}`,
          color: C.sec,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <ImageIcon size={11} /> Cover
      </div>
    </div>
  );
}

function AvatarBlock({ initials, title }: { initials: string; title: string }) {
  const hue = Array.from(title).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 14,
        overflow: "hidden",
        background: `linear-gradient(135deg, hsl(${hue} 40% 20%) 0%, ${C.details} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: "50%",
          background: C.card,
          border: `1px solid ${C.borderStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...sora,
          fontSize: 26,
          fontWeight: 700,
          color: C.text,
          letterSpacing: "0.04em",
        }}
      >
        {initials}
      </div>
    </div>
  );
}

function MetaGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginTop: 16,
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ minWidth: 0 }}>
          <MetaLabel>{it.label}</MetaLabel>
          <div
            style={{
              ...manrope,
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              lineHeight: "20px",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  category,
  description,
  saved,
  onSave,
  remuneration,
}: {
  title: string;
  subtitle: string;
  category: string;
  description: string;
  saved: boolean;
  onSave: () => void;
  remuneration?: boolean;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...manrope,
              fontSize: 16,
              fontWeight: 800,
              lineHeight: "22px",
              color: C.text,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {title}
          </div>
          <div
            style={{
              ...manrope,
              fontSize: 13,
              fontWeight: 600,
              color: C.sec,
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {remuneration && <RemunerationBadge />}
          <IconButton
            ariaLabel={saved ? "Remove bookmark" : "Save announcement"}
            onClick={onSave}
          >
            <Bookmark
              size={16}
              style={{ color: saved ? C.neon : C.sec }}
              fill={saved ? C.neon : "none"}
            />
          </IconButton>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <CategoryChip>{category}</CategoryChip>
      </div>
      <p
        style={{
          ...manrope,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: "22px",
          color: C.sec,
          margin: "12px 0 0",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function CardFooter({
  primaryLabel,
  onPrimary,
  onView,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onView: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginTop: 20,
      }}
    >
      <SecondaryButton fullWidth onClick={onView}>
        View Details
      </SecondaryButton>
      <PrimaryButton fullWidth onClick={onPrimary}>
        {primaryLabel}
      </PrimaryButton>
    </div>
  );
}

function RoleSpotlight({
  label,
  role,
}: {
  label: string;
  role: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 16,
        padding: "12px 14px",
        borderRadius: 14,
        background: C.neonSoftFill,
        border: `1px solid ${C.neonSoftBorder}`,
      }}
    >
      <span
        style={{
          ...manrope,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.neon,
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...sora,
          fontSize: 15,
          fontWeight: 800,
          color: C.text,
          textAlign: "right",
        }}
      >
        {role}
      </span>
    </div>
  );
}

export function ProjectCard({
  item,
  onView,
  onApply,
}: {
  item: ProjectAnnouncement;
  onView: () => void;
  onApply: () => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <CardShell>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1 }}>
        <CoverArt title={item.projectName} />
        <RoleSpotlight label="Rôle recherché" role={item.roleNeeded} />
        <CardHeader
          title={item.title}
          subtitle={item.projectName}
          category="Recherche collaborateur"
          description={item.description}
          saved={saved}
          onSave={() => setSaved((s) => !s)}
          remuneration={item.remuneration}
        />
        <MetaGrid
          items={[
            { label: "Genre", value: itemGenre(item) },
            { label: "Sous-genres", value: itemSubGenres(item).join(", ") },
            { label: "Engagement", value: item.engagement },
            { label: "Rémunération", value: item.remuneration ? "Oui" : "Non" },
          ]}
        />
        <div style={{ flex: 1 }} />
        <CardFooter primaryLabel="Apply" onPrimary={onApply} onView={onView} />
      </div>
    </CardShell>
  );
}

function UserCard({ item, onView, onInvite }: { item: UserAnnouncement; onView: () => void; onInvite: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <CardShell>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1 }}>
        <AvatarBlock initials={item.avatarInitials} title={item.userName} />
        <RoleSpotlight label="Rôle proposé" role={item.roleOffered} />
        <CardHeader
          title={item.title}
          subtitle={item.userName}
          category="Recherche projet"
          description={item.description}
          saved={saved}
          onSave={() => setSaved((s) => !s)}
          remuneration={item.remuneration}
        />
        <MetaGrid
          items={[
            { label: "Genre", value: itemGenre(item) },
            { label: "Sous-genres", value: itemSubGenres(item).join(", ") },
            { label: "Engagement", value: item.engagement },
            { label: "Rémunération", value: item.remuneration ? "Oui" : "Non" },
          ]}
        />
        <div style={{ flex: 1 }} />
        <CardFooter primaryLabel="Invite" onPrimary={onInvite} onView={onView} />
      </div>
    </CardShell>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
        }}
      />
      <div
        style={{
          height: 16,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 6,
          marginTop: 20,
          width: "80%",
        }}
      />
      <div
        style={{
          height: 12,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 6,
          marginTop: 10,
          width: "50%",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 20,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div
              style={{
                height: 10,
                width: 60,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 4,
              }}
            />
            <div
              style={{
                height: 14,
                marginTop: 6,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 6,
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 20,
        }}
      >
        <div style={{ height: 44, borderRadius: 14, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ height: 44, borderRadius: 14, background: "rgba(57,255,136,0.15)" }} />
      </div>
    </div>
  );
}

function EmptyState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px dashed ${C.borderStrong}`,
        borderRadius: 22,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...sora,
          fontSize: 18,
          fontWeight: 700,
          lineHeight: "26px",
          color: C.text,
        }}
      >
        No announcements found
      </div>
      <p
        style={{
          ...manrope,
          fontSize: 14,
          fontWeight: 500,
          color: C.sec,
          maxWidth: 460,
          margin: "8px auto 24px",
        }}
      >
        Try adjusting your filters to find matching announcements.
      </p>
      <div style={{ display: "inline-flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <SecondaryButton onClick={onReset}>Reset Filters</SecondaryButton>
      </div>
    </div>
  );
}

// ---------- Modals ----------

function ModalShell({
  children,
  onClose,
  maxWidth = 960,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  maxWidth?: number;
  label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(2, 6, 20, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "85vh",
          background: C.panel,
          border: `1px solid ${C.borderStrong}`,
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "22px 24px",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            ...sora,
            fontSize: 18,
            fontWeight: 700,
            lineHeight: "26px",
            color: C.text,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              ...manrope,
              fontSize: 13,
              fontWeight: 500,
              color: C.sec,
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <IconButton ariaLabel="Close" onClick={onClose}>
        <X size={16} />
      </IconButton>
    </div>
  );
}

export function DetailsModal({
  item,
  onClose,
  onApply,
  hideApply = false,
}: {
  item: Announcement;
  onClose: () => void;
  onApply?: () => void;
  /** Masque le bouton « Apply » (vue depuis un projet : lecture seule). */
  hideApply?: boolean;
}) {
  const [tab, setTab] = useState<"comments" | "interested">("comments");
  const [saved, setSaved] = useState(false);
  const isProject = item.kind === "project";
  const entityTitle = isProject ? item.projectName : item.userName;
  const entitySubtitle = isProject ? "Projet recruteur" : itemRole(item);
  const entityDescription = isProject ? item.fullDescription : item.fullDescription;
  const comments = isProject
    ? [
        "Brief clair, le role recherche est facile a comprendre.",
        "Le projet semble deja assez structure pour rejoindre l'equipe.",
      ]
    : [
        "Profil interessant, les competences annoncees correspondent bien au besoin.",
        "Portfolio a demander avant invitation, mais la disponibilite est claire.",
      ];
  // Intéressés réels (ceux qui ont répondu) pour les annonces de projet.
  const interested = isProject
    ? listInterested(item.id).map((p) => p.name)
    : ["Kurogane Requiem", "Emberline", "Orbital Silence"];

  return (
    <ModalShell onClose={onClose} maxWidth={1280} label="Announcement details">
      <ModalHeader
        title={item.title}
        subtitle={entityTitle}
        onClose={onClose}
      />
      <div
        style={{
          overflow: "auto",
          background: C.details,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr) minmax(280px, 2fr)",
            minWidth: 980,
          }}
        >
          <aside style={{ padding: 24, borderRight: `1px solid ${C.border}` }}>
            {isProject ? (
              <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <CoverArt title={item.projectName} />
              </div>
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: C.card,
                  border: `1px solid ${C.borderStrong}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...sora,
                  fontSize: 30,
                  fontWeight: 700,
                  color: C.text,
                }}
              >
                {item.avatarInitials}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <CategoryChip>{entitySubtitle}</CategoryChip>
              <h3 style={{ ...sora, marginTop: 10, fontSize: 22, lineHeight: "30px", fontWeight: 700, color: C.text }}>
                {entityTitle}
              </h3>
              <p style={{ ...manrope, marginTop: 10, fontSize: 14, lineHeight: "22px", fontWeight: 500, color: C.sec }}>
                {entityDescription}
              </p>
            </div>

            <div style={{ marginTop: 18 }}>
              <MetaLabel>Genre</MetaLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <Chip>{itemGenre(item)}</Chip>
                {itemSubGenres(item).map((genre) => (
                  <Chip key={genre}>{genre}</Chip>
                ))}
              </div>
            </div>
          </aside>

          <section style={{ padding: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <CategoryChip>{itemRole(item)}</CategoryChip>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <Chip>{remunerationLabel(item)}</Chip>
              <Chip>{item.engagement}</Chip>
            </div>
            <h2 style={{ ...sora, marginTop: 14, fontSize: 28, lineHeight: "36px", fontWeight: 800, color: C.text }}>
              {item.title}
            </h2>
            <p style={{ ...manrope, marginTop: 12, fontSize: 15, lineHeight: "24px", fontWeight: 500, color: C.sec }}>
              {item.description}
            </p>
            <div
              style={{
                marginTop: 22,
                paddingTop: 22,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <MetaLabel>Description</MetaLabel>
              <p style={{ ...manrope, marginTop: 8, fontSize: 14, lineHeight: "23px", fontWeight: 500, color: C.text }}>
                {item.fullDescription}
              </p>
            </div>
          </section>

          <aside style={{ padding: 18, borderLeft: `1px solid ${C.border}` }}>
            <div className="cm-popup-tabs" role="tablist" aria-label="Activite de l'annonce" style={{ width: "100%", padding: 4, borderRadius: 14 }}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "comments"}
                data-active={tab === "comments"}
                onClick={() => setTab("comments")}
                className="cm-popup-tab"
                style={{ flex: 1, minHeight: 34, padding: "0 10px", fontSize: 12 }}
              >
                Commentaires
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "interested"}
                data-active={tab === "interested"}
                onClick={() => setTab("interested")}
                className="cm-popup-tab"
                style={{ flex: 1, minHeight: 34, padding: "0 10px", fontSize: 12 }}
              >
                Intéressés
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {tab === "comments"
                ? comments.map((comment, index) => (
                    <div key={comment} style={{ padding: 12, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                      <p style={{ ...manrope, color: C.text, fontSize: 12, fontWeight: 800 }}>Utilisateur {index + 1}</p>
                      <p style={{ ...manrope, marginTop: 6, color: C.sec, fontSize: 13, fontWeight: 500, lineHeight: "20px" }}>
                        {comment}
                      </p>
                    </div>
                  ))
                : interested.length === 0
                  ? <p style={{ ...manrope, color: C.muted, fontSize: 13, fontWeight: 500, padding: 8 }}>Aucun intéressé pour l'instant.</p>
                  : interested.map((name) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: C.input, color: C.neon, ...sora, fontSize: 12, fontWeight: 800 }}>
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ ...manrope, color: C.text, fontSize: 13, fontWeight: 800 }}>{name}</span>
                      </div>
                    ))}
            </div>
          </aside>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          padding: "16px 24px",
          borderTop: `1px solid ${C.border}`,
          background: C.panel,
          flexWrap: "wrap",
        }}
      >
        <GhostButton onClick={() => setSaved((s) => !s)}>
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} style={{ marginRight: 6, display: "inline", verticalAlign: "middle" }} />
          {saved ? "Enregistré" : "Save"}
        </GhostButton>
        {!hideApply && <PrimaryButton onClick={onApply}>Apply to Project</PrimaryButton>}
      </div>
    </ModalShell>
  );
}

const selectStyle = {
  ...manrope,
  width: "100%",
  height: 44,
  borderRadius: 14,
  border: `1px solid rgba(133,154,206,0.20)`,
  background: C.input,
  color: C.text,
  padding: "0 14px",
  fontSize: 14,
  fontWeight: 700,
  outline: "none",
};

const textareaStyle = {
  ...manrope,
  width: "100%",
  minHeight: 120,
  borderRadius: 14,
  border: `1px solid rgba(133,154,206,0.20)`,
  background: C.input,
  color: C.text,
  padding: 14,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "22px",
  resize: "vertical" as const,
  outline: "none",
};

export function AnnouncementWorkflowModal({
  action,
  item,
  onClose,
  onDone,
}: {
  action: "apply" | "invite" | "sponsor";
  item: Announcement;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [projectTitle, setProjectTitle] = useState(item.kind === "project" ? item.projectName : "Neon Ronin");
  const [role, setRole] = useState(item.kind === "project" ? item.roleNeeded : item.roleOffered);
  const [duration, setDuration] = useState("14 jours");
  const [level, setLevel] = useState("Standard");
  const [meName, setMeName] = useState("Vous");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user.user_metadata as Record<string, string | undefined> | undefined;
      const name = meta?.display_name || meta?.full_name || meta?.username || data.session?.user.email?.split("@")[0];
      if (name) setMeName(name);
    });
  }, []);

  const title =
    action === "apply"
      ? "Répondre à l'annonce"
      : action === "invite"
        ? "Inviter au projet"
        : "Sponsoriser l'annonce";

  const submit = () => {
    setError("");
    if (action === "apply") {
      if (!message.trim()) {
        setError("Ajoute un court message de réponse.");
        return;
      }
      const owner = item.kind === "project" ? `${item.projectName} team` : item.userName;
      respondToProposal({
        proposalTitle: item.title,
        accepted: true,
        message,
        recipient: owner,
      });
      // Répondre à une annonce de projet → on rejoint la liste des intéressés (§3).
      if (item.kind === "project") addInterested(item.id, meName);
      onDone("Réponse envoyée.");
      return;
    }
    if (action === "invite") {
      if (!projectTitle.trim()) {
        setError("Choisis ou indique le projet concerné.");
        return;
      }
      if (item.kind !== "user") {
        setError("Sélectionne une annonce utilisateur pour inviter un collaborateur.");
        return;
      }
      sendCollaborationInvitation({
        recipient: item.userName,
        projectTitle,
        role,
        message,
      });
      onDone("Invitation envoyée. Elle apparaît maintenant dans les workflows et notifications.");
      return;
    }
    if (!duration.trim() || !level.trim()) {
      setError("La durée et le niveau de mise en avant sont obligatoires.");
      return;
    }
    sendAnnouncementSponsoring({
      announcementTitle: item.title,
      owner: item.kind === "project" ? `${item.projectName} team` : item.userName,
      duration,
      level,
      message,
    });
    onDone("Demande de sponsoring envoyée. Une notification de confirmation est prête.");
  };

  return (
    <ModalShell onClose={onClose} maxWidth={720} label={title}>
      <ModalHeader title={title} subtitle={item.title} onClose={onClose} />
      <div style={{ display: "grid", gap: 16, padding: 24, background: C.details }}>
        {action === "invite" && (
          <>
            <FieldLabel>Projet concerné</FieldLabel>
            <TextInput value={projectTitle} onChange={setProjectTitle} placeholder="Titre du projet" ariaLabel="Projet concerné" />
            <FieldLabel>Rôle proposé</FieldLabel>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              style={selectStyle}
            >
              {["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </>
        )}
        {action === "sponsor" && (
          <>
            <FieldLabel>Durée du sponsoring</FieldLabel>
            <TextInput value={duration} onChange={setDuration} placeholder="Ex : 14 jours" ariaLabel="Durée du sponsoring" />
            <FieldLabel>Niveau de mise en avant</FieldLabel>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              style={selectStyle}
            >
              {["Standard", "Premium", "Top"].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </>
        )}
        <FieldLabel>{action === "apply" ? "Message de réponse" : "Message personnalisé"}</FieldLabel>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            action === "apply"
              ? "Présente ton profil, tes disponibilités et pourquoi tu réponds à cette annonce."
              : "Ajoute un contexte utile pour le destinataire."
          }
          style={textareaStyle}
        />
        {error && <div style={{ ...manrope, color: C.danger, fontSize: 13, fontWeight: 700 }}>{error}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: `1px solid ${C.border}`, background: C.panel }}>
        <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
        <PrimaryButton onClick={submit}>{action === "sponsor" ? "Envoyer la demande" : "Confirmer"}</PrimaryButton>
      </div>
    </ModalShell>
  );
}

function WorkflowToast({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 70,
        maxWidth: 420,
        padding: "14px 16px",
        borderRadius: 16,
        background: C.card,
        border: `1px solid ${C.neonSoftBorder}`,
        color: C.text,
        boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
        ...manrope,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        ...manrope,
        fontSize: 12,
        fontWeight: 700,
        color: C.sec,
        display: "block",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...manrope,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: "18px",
        borderRadius: 999,
        padding: "7px 14px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: `1px solid ${active ? C.neonSoftBorder : C.border}`,
        background: active ? C.neon : C.input,
        color: active ? "#04111E" : C.sec,
        transition: "background 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function FilterChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{children}</div>
    </div>
  );
}

function AnnouncementAdvancedFiltersModal({
  filters,
  setFilters,
  onClose,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onClose: () => void;
}) {
  const toggleArr = (key: "langue" | "genres" | "sousGenres", val: string) =>
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  const clearAdvanced = () =>
    setFilters((f) => ({
      ...f,
      langue: [],
      genres: [],
      sousGenres: [],
      remunerationOnly: false,
      engagement: "",
    }));

  return (
    <ModalShell onClose={onClose} maxWidth={820} label="Filtres avancés">
      <ModalHeader title="Filtres avancés" subtitle="Affinez par langue, genre et sous-genre." onClose={onClose} />
      <div style={{ overflow: "auto", padding: 24, background: C.details }}>
        <FilterChipRow label="Langage">
          <select
            value=""
            onChange={(e) => {
              const code = e.target.value;
              if (code && !filters.langue.includes(code)) toggleArr("langue", code);
            }}
            aria-label="Ajouter une langue au filtre"
            style={{
              height: 38,
              borderRadius: 12,
              background: C.input,
              border: `1px solid ${C.border}`,
              color: C.text,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <option value="">Ajouter une langue…</option>
            {SITE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {filters.langue.map((language) => (
            <FilterChip
              key={language}
              label={`${languageLabel(language)} ✕`}
              active
              onClick={() => toggleArr("langue", language)}
            />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Rémunération">
          <div style={{ width: 280, maxWidth: "100%" }}>
            <ToggleSwitchField
              label={filters.remunerationOnly ? "Rémunération active" : "Toutes les annonces"}
              checked={filters.remunerationOnly}
              onChange={(checked) => setFilters((f) => ({ ...f, remunerationOnly: checked }))}
            />
          </div>
        </FilterChipRow>

        <FilterChipRow label="Engagement">
          <FilterChip
            label="Tout"
            active={filters.engagement === ""}
            onClick={() => setFilters((f) => ({ ...f, engagement: "" }))}
          />
          {(["Long terme", "Ponctuel"] as const).map((engagement) => (
            <FilterChip
              key={engagement}
              label={engagement}
              active={filters.engagement === engagement}
              onClick={() => setFilters((f) => ({ ...f, engagement }))}
            />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Genre">
          {GENRES_FR.map((genre) => (
            <FilterChip
              key={genre}
              label={genre}
              active={filters.genres.includes(genre)}
              onClick={() => toggleArr("genres", genre)}
            />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Sous-genre">
          {SOUS_GENRES.map((subGenre) => (
            <FilterChip
              key={subGenre}
              label={subGenre}
              active={filters.sousGenres.includes(subGenre)}
              onClick={() => toggleArr("sousGenres", subGenre)}
            />
          ))}
        </FilterChipRow>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          padding: "16px 24px",
          borderTop: `1px solid ${C.border}`,
          background: C.panel,
        }}
      >
        <SecondaryButton onClick={clearAdvanced}>Réinitialiser</SecondaryButton>
        <PrimaryButton onClick={onClose}>Appliquer</PrimaryButton>
      </div>
    </ModalShell>
  );
}

function ToggleSwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        minHeight: 44,
        borderRadius: 14,
        border: `1px solid ${checked ? C.neonSoftBorder : C.border}`,
        background: checked ? C.neonSoftFill : C.input,
        color: checked ? C.neon : C.sec,
        padding: "0 12px",
        cursor: "pointer",
      }}
    >
      <span style={{ ...manrope, fontSize: 13, fontWeight: 800 }}>{label}</span>
      <span
        style={{
          position: "relative",
          width: 40,
          height: 22,
          borderRadius: 999,
          background: checked ? "rgba(57,255,136,0.38)" : C.card,
          border: `1px solid ${checked ? C.neonSoftBorder : C.borderStrong}`,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: checked ? C.neon : C.sec,
            transition: "left 140ms ease",
          }}
        />
      </span>
    </button>
  );
}

