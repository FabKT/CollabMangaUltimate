import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listAnnouncements } from "@/lib/db";
import {
  Bookmark,
  Plus,
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
type ProjectAnnouncement = {
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

const PROJECTS: ProjectAnnouncement[] = [
  {
    kind: "project",
    id: "p1",
    title: "Seeking dessinateur for chapter 4",
    projectName: "Kurogane Requiem",
    description:
      "Dark fantasy series in production. Looking for a dessinateur to reinforce the atmosphere of our night scenes.",
    roleNeeded: "Dessinateur",
    remuneration: true,
    engagement: "Long terme",
    genre: "Fantasy",
    mode: "Revenue share",
    availability: "Part-time",
    status: "Open",
    language: "English",
    experience: "Intermediate",
    requiredSkills: ["Manga page drawing", "Lighting", "Clip Studio Paint"],
    fullDescription:
      "Kurogane Requiem is a dark fantasy manga entering its second arc. We publish monthly and need a dessinateur with a strong sense of mood and cinematic lighting to handle 20 pages per chapter.",
    requirements:
      "At least one completed manga project. Comfortable with page composition, inking, and consistent visual rhythm across chapters.",
    contribution: "20 pages per month with a 2-week turnaround per chapter.",
    team: "Scénariste, dessinateur, lecteur (3 members).",
    application:
      "Send a short intro and 2-3 manga page samples through the Apply button. We respond within 5 days.",
  },
  {
    kind: "project",
    id: "p2",
    title: "Scénariste wanted for slice-of-life oneshot",
    projectName: "Café Between Chapters",
    description:
      "Short romantic oneshot, 30 pages. Looking for a scénariste to co-develop the emotional beats.",
    roleNeeded: "Scénariste",
    remuneration: false,
    engagement: "Ponctuel",
    genre: "Slice of life",
    mode: "Portfolio collaboration",
    availability: "Flexible",
    status: "Open",
    language: "English / French",
    experience: "Beginner accepted",
    requiredSkills: ["Dialogue", "Story structure", "Character voice"],
    fullDescription:
      "A quiet, character-driven oneshot set in a small café. The art is already in early thumbnails; we need a scénariste to co-develop pacing and dialogue.",
    requirements: "Passion for character-driven stories. Open to first-time collaborators.",
    contribution: "Script + 2 rounds of dialogue polish.",
    team: "Dessinateur, lecteur (2 members).",
    application: "Apply with a short writing sample of any length.",
  },
  {
    kind: "project",
    id: "p3",
    title: "Dessinateur needed for ongoing shonen",
    projectName: "Ashen Verdict",
    description:
      "Action shonen, chapter 12 in progress. Need a reliable dessinateur for long-term collaboration.",
    roleNeeded: "Dessinateur",
    remuneration: true,
    engagement: "Long terme",
    genre: "Action",
    mode: "Paid",
    availability: "Long-term",
    status: "Open",
    language: "English",
    experience: "Intermediate",
    requiredSkills: ["Dynamic poses", "Action panels", "Photoshop"],
    fullDescription:
      "Ongoing action shonen with 12 chapters published. Looking for a dessinateur to help with dynamic action pages across upcoming arcs.",
    requirements: "Portfolio with at least 2 manga page samples. Familiarity with action composition.",
    contribution: "1 chapter per month, roughly 25 pages.",
    team: "Scénariste, dessinateur, lecteur (3 members).",
    application: "Apply with rate expectations and 1 sample page.",
  },
  {
    kind: "project",
    id: "p4",
    title: "Dessinateur for sci-fi world",
    projectName: "Orbital Silence",
    description:
      "Space-station drama. We need a dessinateur comfortable with mechanical detail.",
    roleNeeded: "Dessinateur",
    remuneration: true,
    engagement: "Ponctuel",
    genre: "Sci-fi",
    mode: "Revenue share",
    availability: "Weekends only",
    status: "Open",
    language: "English",
    experience: "Advanced",
    requiredSkills: ["Perspective", "Mech design", "Photoshop"],
    fullDescription:
      "Orbital Silence is a moody sci-fi drama set on a decaying space station. Interiors and exteriors both matter — we need someone who enjoys drawing hardware.",
    requirements: "Strong perspective and mechanical drawing samples required.",
    contribution: "8-10 background panels per week.",
    team: "Scénariste, dessinateur (2 members).",
    application: "Submit portfolio link and availability.",
  },
  {
    kind: "project",
    id: "p5",
    title: "Dessinateur for new fantasy manga",
    projectName: "Emberline",
    description:
      "Pre-production. Looking for a dessinateur to shape our main cast of six.",
    roleNeeded: "Dessinateur",
    remuneration: false,
    engagement: "Ponctuel",
    genre: "Fantasy",
    mode: "Volunteer",
    availability: "Flexible",
    status: "Draft",
    language: "English / Spanish",
    experience: "Intermediate",
    requiredSkills: ["Character drawing", "Costume drawing", "Silhouettes"],
    fullDescription:
      "Emberline is a fantasy manga in pre-production. We have world lore and the plot skeleton. Now we need a dessinateur to define six main characters.",
    requirements: "Portfolio with character sheet samples.",
    contribution: "Six character sheets + rough expressions.",
    team: "Scénariste, dessinateur (2 members).",
    application: "Apply with 3 character samples.",
  },
  {
    kind: "project",
    id: "p6",
    title: "Lecteur needed for chapter release",
    projectName: "Silverline",
    description:
      "Established indie manga preparing a release pass. Need a careful reader for feedback.",
    roleNeeded: "Lecteur",
    remuneration: true,
    engagement: "Ponctuel",
    genre: "Drama",
    mode: "Paid",
    availability: "Short-term",
    status: "Open",
    language: "English → Japanese",
    experience: "Advanced",
    requiredSkills: ["Reading feedback", "Dialogue notes", "Continuity checks"],
    fullDescription:
      "Silverline has 20 chapters in English. We want a reading pass on the first arc before wider release.",
    requirements: "Comfortable giving clear story, dialogue, and continuity feedback.",
    contribution: "8 chapters, ~28 pages each.",
    team: "Scénariste, dessinateur, lecteur (3 members).",
    application: "Send rate and one short sample translation.",
  },
];

const USERS: UserAnnouncement[] = [
  {
    kind: "user",
    id: "u1",
    title: "Dessinateur available for long-term project",
    userName: "Aiko M.",
    avatarInitials: "AM",
    description:
      "Three years of experience drawing shonen and seinen chapters. Looking for a serious ongoing series.",
    roleOffered: "Dessinateur",
    remuneration: true,
    engagement: "Long terme",
    mainSkill: "Manga page drawing",
    genre: "Action",
    availability: "Part-time",
    language: "English / Japanese",
    experience: "Advanced",
    mainSkills: ["Manga pages", "Inking", "Mood lighting", "Clip Studio Paint"],
    preferredGenres: ["Action", "Fantasy", "Sci-fi"],
    mode: "Revenue share",
    fullDescription:
      "I have drawn roughly 200 pages across three indie projects. I focus on atmosphere-driven scenes and enjoy long-term collaboration.",
    lookingFor:
      "Ongoing series with a clear release cadence. Prefer teams of 3+ with a lecteur in place.",
    contact: "Reach out through Contact — I respond within 48 hours.",
  },
  {
    kind: "user",
    id: "u2",
    title: "Scénariste with 5 completed oneshots",
    userName: "Léo R.",
    avatarInitials: "LR",
    description:
      "Scénariste specializing in character-driven drama. Open to genre mixes.",
    roleOffered: "Scénariste",
    remuneration: false,
    engagement: "Ponctuel",
    mainSkill: "Story structure",
    genre: "Drama",
    availability: "Flexible",
    language: "English / French",
    experience: "Intermediate",
    mainSkills: ["Story structure", "Dialogue", "Worldbuilding"],
    preferredGenres: ["Drama", "Slice of life", "Psychological"],
    mode: "Portfolio collaboration",
    fullDescription:
      "Five completed oneshots (10-40 pages) with different dessinateurs. I focus on emotional pacing and quiet scenes.",
    lookingFor:
      "A short series (5-10 chapters) with a dessinateur looking for a scénariste.",
    contact: "Prefer initial contact via message with a brief pitch.",
  },
  {
    kind: "user",
    id: "u3",
    title: "Dessinateur looking for fantasy project",
    userName: "Nadia K.",
    avatarInitials: "NK",
    description:
      "Dessinateur with a focus on costume detail and cultural fusion.",
    roleOffered: "Dessinateur",
    remuneration: false,
    engagement: "Ponctuel",
    mainSkill: "Character drawing",
    genre: "Fantasy",
    availability: "Weekends only",
    language: "English",
    experience: "Intermediate",
    mainSkills: ["Character drawing", "Costume", "Turnarounds", "Silhouettes"],
    preferredGenres: ["Fantasy", "Historical", "Adventure"],
    mode: "Volunteer",
    fullDescription:
      "I draw characters with an emphasis on cultural detail and silhouette clarity. Portfolio focuses on fantasy casts.",
    lookingFor:
      "A fantasy project in pre-production needing 3-6 character sheets.",
    contact: "Message me — I share full portfolio on request.",
  },
  {
    kind: "user",
    id: "u4",
    title: "Créateur de contenu available for short missions",
    userName: "Sam T.",
    avatarInitials: "ST",
    description:
      "Content creator with 40+ manga videos shipped. Available for short-term promotion missions.",
    roleOffered: "Créateur de contenu",
    remuneration: true,
    engagement: "Ponctuel",
    mainSkill: "Manga promotion",
    genre: "Action",
    availability: "Short-term",
    language: "English",
    experience: "Advanced",
    mainSkills: ["Video hooks", "Review scripts", "Community posts"],
    preferredGenres: ["Action", "Horror", "Mystery"],
    mode: "Paid",
    fullDescription: "Content creator, 40+ manga videos shipped across four indie campaigns.",
    lookingFor: "Short-term projects, 1-3 chapters, with clear pitch material.",
    contact: "Contact for rate sheet.",
  },
  {
    kind: "user",
    id: "u5",
    title: "Lecteur with feedback eye",
    userName: "Priya S.",
    avatarInitials: "PS",
    description: "Reader offering structural feedback and continuity notes.",
    roleOffered: "Lecteur",
    remuneration: false,
    engagement: "Ponctuel",
    mainSkill: "Story feedback",
    genre: "Romance",
    availability: "Available now",
    language: "English",
    experience: "Beginner accepted",
    mainSkills: ["Structural feedback", "Continuity notes", "Character notes"],
    preferredGenres: ["Romance", "Slice of life", "Drama"],
    mode: "Volunteer",
    fullDescription:
      "I read scripts and rough chapters and provide structured feedback on structure, pacing, and character clarity.",
    lookingFor: "Scénaristes who want a second pair of eyes before finalizing chapters.",
    contact: "Reach out with a script snippet.",
  },
  {
    kind: "user",
    id: "u6",
    title: "Dessinateur open to revenue share",
    userName: "Kenji O.",
    avatarInitials: "KO",
    description:
      "Dessinateur specialized in urban and interior environments.",
    roleOffered: "Dessinateur",
    remuneration: true,
    engagement: "Long terme",
    mainSkill: "Perspective",
    genre: "Slice of life",
    availability: "Long-term",
    language: "English / Japanese",
    experience: "Advanced",
    mainSkills: ["Perspective", "Urban environments", "Interiors", "Photoshop"],
    preferredGenres: ["Slice of life", "Drama", "Romance"],
    mode: "Revenue share",
    fullDescription:
      "Six years drawing background environments. I favor grounded settings — cities, apartments, cafés.",
    lookingFor: "Ongoing series willing to share revenue.",
    contact: "Message me for portfolio.",
  },
];

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

function SelectInput({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  minWidth = 160,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  ariaLabel: string;
  placeholder: string;
  minWidth?: number;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ position: "relative", flex: `0 1 ${minWidth}px`, minWidth }}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          ...manrope,
          width: "100%",
          appearance: "none",
          background: C.input,
          border: `1px solid ${focus ? C.neon : "rgba(133,154,206,0.20)"}`,
          boxShadow: focus ? "0 0 0 3px rgba(57,255,136,0.10)" : "none",
          color: value ? C.text : C.muted,
          borderRadius: 14,
          height: 44,
          padding: "0 38px 0 14px",
          fontSize: 14,
          fontWeight: 500,
          outline: "none",
          cursor: "pointer",
        }}
      >
        <option value="" style={{ background: C.input, color: C.muted }}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: C.input, color: C.text }}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: C.muted,
          pointerEvents: "none",
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

const GENRES = [
  "Shonen",
  "Seinen",
  "Shojo",
  "Josei",
];

const MODES = [
  "To define",
  "Volunteer",
  "Paid",
  "Revenue share",
  "Portfolio collaboration",
  "Long-term collaboration",
  "Short-term mission",
];

const AVAILABILITIES = [
  "Available now",
  "Part-time",
  "Weekends only",
  "Flexible",
  "Long-term",
  "Short-term",
  "To define",
];

// ---------- Filter options ----------

const LANGUES = ["FR", "ENG", "ES", "IT", "JP"];
const STATUTS = ["Dessinateur", "Scénariste"];
const TYPES_ANNONCE = ["Adhésions", "Invitation"];
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

const DEMOGRAPHIC_BY_ID: Record<string, string> = {
  p1: "Seinen",
  p2: "Josei",
  p3: "Shonen",
  p4: "Seinen",
  p5: "Shojo",
  p6: "Josei",
  u1: "Shonen",
  u2: "Josei",
  u3: "Shojo",
  u4: "Seinen",
  u5: "Josei",
  u6: "Seinen",
};

const SUB_GENRES_BY_ID: Record<string, string[]> = {
  p1: ["Action", "Fantastique"],
  p2: ["Romance", "Slice of life"],
  p3: ["Action", "Aventure"],
  p4: ["Science fiction", "Mystère"],
  p5: ["Fantastique", "Aventure"],
  p6: ["Drame", "Historique"],
  u1: ["Action", "Aventure"],
  u2: ["Drame", "Slice of life"],
  u3: ["Fantastique", "Aventure"],
  u4: ["Horreur", "Mystère"],
  u5: ["Romance", "Drame"],
  u6: ["Slice of life", "Drame"],
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
  return DEMOGRAPHIC_BY_ID[item.id] ?? "Shonen";
}

function itemSubGenres(item: Announcement) {
  return SUB_GENRES_BY_ID[item.id] ?? [];
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

  const data: Announcement[] =
    filters.target === "project"
      ? [...dbUsers, ...USERS]
      : filters.target === "collaborator"
        ? [...dbProjects, ...PROJECTS]
        : [...dbProjects, ...dbUsers, ...PROJECTS, ...USERS];

  const filtered = useMemo(() => {
    return data.filter((a) => {
      const query = filters.search.trim().toLowerCase();
      if (query && !itemSearchText(a).includes(query)) return false;
      if (!itemLanguageMatches(a, filters.langue)) return false;
      if (filters.statut && itemRole(a) !== filters.statut) return false;
      if (filters.remunerationOnly && !a.remuneration) return false;
      if (filters.engagement && a.engagement !== filters.engagement) return false;
      if (filters.genres.length > 0 && !filters.genres.includes(DEMOGRAPHIC_BY_ID[a.id])) return false;
      if (filters.sousGenres.length > 0 && !filters.sousGenres.some((sg) => SUB_GENRES_BY_ID[a.id]?.includes(sg))) return false;
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

function AnnouncementFilters({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const toggleArr = (key: "langue" | "genres" | "sousGenres", val: string) =>
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  const setSingle = (key: "statut" | "typeAnnonce", val: string) => setFilters((f) => ({ ...f, [key]: val }));

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
      <FilterChipRow label="Language">
        {LANGUES.map((l) => (
          <FilterChip key={l} label={l} active={filters.langue.includes(l)} onClick={() => toggleArr("langue", l)} />
        ))}
      </FilterChipRow>

      <FilterChipRow label="Statut recherché">
        <FilterChip label="Tout" active={filters.statut === ""} onClick={() => setSingle("statut", "")} />
        {STATUTS.map((s) => (
          <FilterChip key={s} label={s} active={filters.statut === s} onClick={() => setSingle("statut", s)} />
        ))}
      </FilterChipRow>

      <FilterChipRow label="Type d'annonce">
        <FilterChip label="Tout" active={filters.typeAnnonce === ""} onClick={() => setSingle("typeAnnonce", "")} />
        {TYPES_ANNONCE.map((t) => (
          <FilterChip key={t} label={t} active={filters.typeAnnonce === t} onClick={() => setSingle("typeAnnonce", t)} />
        ))}
      </FilterChipRow>

      <FilterChipRow label="Genre">
        {GENRES_FR.map((g) => (
          <FilterChip key={g} label={g} active={filters.genres.includes(g)} onClick={() => toggleArr("genres", g)} />
        ))}
      </FilterChipRow>

      <FilterChipRow label="Sous-genre">
        {SOUS_GENRES.map((sg) => (
          <FilterChip key={sg} label={sg} active={filters.sousGenres.includes(sg)} onClick={() => toggleArr("sousGenres", sg)} />
        ))}
      </FilterChipRow>
    </section>
  );
}

// ---------- Grid ----------

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

function ProjectCard({
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

function DetailsModal({
  item,
  onClose,
  onApply,
}: {
  item: Announcement;
  onClose: () => void;
  onApply: () => void;
}) {
  const [tab, setTab] = useState<"comments" | "interested">("comments");
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
  const interested = isProject
    ? ["Aiko M.", "Kenji O.", "Sam T."]
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
        <GhostButton>Save</GhostButton>
        <PrimaryButton onClick={onApply}>Apply to Project</PrimaryButton>
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

function AnnouncementWorkflowModal({
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
  const [error, setError] = useState("");

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

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div
        style={{
          ...sora,
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          ...manrope,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: "22px",
          color: C.sec,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function DetailMeta({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginTop: 20,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <MetaLabel>{it.label}</MetaLabel>
          <div
            style={{
              ...manrope,
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginTop: 6,
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillList({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {items.map((s) => (
        <Chip key={s}>{s}</Chip>
      ))}
    </div>
  );
}

function ProjectDetails({ item }: { item: ProjectAnnouncement }) {
  return (
    <div>
      <div
        style={{
          width: "100%",
          aspectRatio: "21/9",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <CoverArt title={item.projectName} />
      </div>
      <div style={{ marginTop: 16 }}>
        <CategoryChip>Project looking for partners</CategoryChip>
        <div
          style={{
            ...sora,
            fontSize: 22,
            fontWeight: 700,
            color: C.text,
            marginTop: 10,
          }}
        >
          {item.projectName}
        </div>
      </div>
      <DetailMeta
        items={[
          { label: "Role needed", value: item.roleNeeded },
          { label: "Project genre", value: itemGenre(item) },
          { label: "Sub-genres", value: itemSubGenres(item).join(", ") },
          { label: "Project status", value: item.status },
          { label: "Availability", value: item.availability },
          { label: "Language", value: item.language },
          { label: "Experience level", value: item.experience },
        ]}
      />
      <DetailSection title="Required skills">
        <SkillList items={item.requiredSkills} />
      </DetailSection>
      <DetailSection title="Full description">{item.fullDescription}</DetailSection>
      <DetailSection title="Role requirements">{item.requirements}</DetailSection>
      <DetailSection title="Expected contribution">{item.contribution}</DetailSection>
      <DetailSection title="Team">{item.team}</DetailSection>
      <DetailSection title="Linked project">Project page — placeholder link.</DetailSection>
      <DetailSection title="Application instructions">{item.application}</DetailSection>
    </div>
  );
}

function UserDetails({ item }: { item: UserAnnouncement }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
        <div>
          <CategoryChip>User looking for project</CategoryChip>
          <div
            style={{
              ...sora,
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
              marginTop: 10,
            }}
          >
            {item.userName}
          </div>
        </div>
      </div>
      <DetailMeta
        items={[
          { label: "Role offered", value: item.roleOffered },
          { label: "Genre", value: itemGenre(item) },
          { label: "Sub-genres", value: itemSubGenres(item).join(", ") },
          { label: "Availability", value: item.availability },
          { label: "Language", value: item.language },
          { label: "Experience level", value: item.experience },
        ]}
      />
      <DetailSection title="Main skills">
        <SkillList items={item.mainSkills} />
      </DetailSection>
      <DetailSection title="Preferred sub-genres">
        <SkillList items={item.preferredGenres} />
      </DetailSection>
      <DetailSection title="Portfolio">Portfolio link — placeholder.</DetailSection>
      <DetailSection title="Full description">{item.fullDescription}</DetailSection>
      <DetailSection title="Looking for">{item.lookingFor}</DetailSection>
      <DetailSection title="Contact instructions">{item.contact}</DetailSection>
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div
        style={{
          ...sora,
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
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
          {LANGUES.map((language) => (
            <FilterChip
              key={language}
              label={language}
              active={filters.langue.includes(language)}
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

function AdvancedFiltersModal({
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
  const setSingle = (key: "statut" | "typeAnnonce", val: string) => setFilters((f) => ({ ...f, [key]: val }));

  return (
    <ModalShell onClose={onClose} maxWidth={820} label="Filtres avancés">
      <ModalHeader title="Filtres avancés" subtitle="Affinez votre recherche." onClose={onClose} />
      <div style={{ overflow: "auto", padding: 24, background: C.details }}>
        <FilterChipRow label="Langage">
          {LANGUES.map((l) => (
            <FilterChip key={l} label={l} active={filters.langue.includes(l)} onClick={() => toggleArr("langue", l)} />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Statut recherché">
          <FilterChip label="Tout" active={filters.statut === ""} onClick={() => setSingle("statut", "")} />
          {STATUTS.map((s) => (
            <FilterChip key={s} label={s} active={filters.statut === s} onClick={() => setSingle("statut", s)} />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Type d'annonce">
          <FilterChip label="Tout" active={filters.typeAnnonce === ""} onClick={() => setSingle("typeAnnonce", "")} />
          {TYPES_ANNONCE.map((t) => (
            <FilterChip key={t} label={t} active={filters.typeAnnonce === t} onClick={() => setSingle("typeAnnonce", t)} />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Genre">
          {GENRES_FR.map((g) => (
            <FilterChip key={g} label={g} active={filters.genres.includes(g)} onClick={() => toggleArr("genres", g)} />
          ))}
        </FilterChipRow>

        <FilterChipRow label="Sous-genre">
          {SOUS_GENRES.map((sg) => (
            <FilterChip key={sg} label={sg} active={filters.sousGenres.includes(sg)} onClick={() => toggleArr("sousGenres", sg)} />
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
        <SecondaryButton onClick={() => setFilters(EMPTY_FILTERS)}>Réinitialiser</SecondaryButton>
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

function CreateAnnouncementModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<"project" | "user">("project");
  const [remuneration, setRemuneration] = useState(false);
  const [engagement, setEngagement] = useState<"Long terme" | "Ponctuel">("Long terme");
  return (
    <ModalShell onClose={onClose} maxWidth={880} label="Create announcement">
      <ModalHeader
        title="Create announcement"
        subtitle="Publish a collaboration opportunity or offer your skills."
        onClose={onClose}
      />
      <div style={{ overflow: "auto", padding: 24, background: C.details }}>
        <div
          style={{
            ...sora,
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            marginBottom: 12,
          }}
        >
          Announcement type
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(
            [
              { id: "project", label: "Project looking for partners" },
              { id: "user", label: "User looking for project" },
            ] as const
          ).map((opt) => {
            const active = type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                style={{
                  ...manrope,
                  flex: "1 1 260px",
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 14,
                  background: active ? C.neonSoftFill : C.card,
                  border: `1px solid ${active ? C.neonSoftBorder : C.border}`,
                  color: active ? C.neon : C.text,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {type === "project" ? (
          <>
            <FormSection title="Project">
              <div>
                <FieldLabel>Linked project</FieldLabel>
                <SelectInput
                  value=""
                  onChange={() => {}}
                  options={["Kurogane Requiem", "Ashen Verdict", "Emberline"]}
                  placeholder="Select project"
                  ariaLabel="Linked project"
                  minWidth={0}
                />
              </div>
              <div>
                <FieldLabel>Project cover image</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="Upload or paste URL" ariaLabel="Project cover image" />
              </div>
              <div>
                <FieldLabel>Announcement title</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="e.g. Seeking dessinateur for arc 2" ariaLabel="Announcement title" />
              </div>
              <div>
                <FieldLabel>Role needed</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={ROLES} placeholder="Select role" ariaLabel="Role needed" minWidth={0} />
              </div>
            </FormSection>
            <FormSection title="Requirements">
              <div>
                <FieldLabel>Required skills</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="Comma-separated skills" ariaLabel="Required skills" />
              </div>
              <div>
                <FieldLabel>Project genre</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={GENRES} placeholder="Select genre" ariaLabel="Project genre" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Collaboration mode</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={MODES} placeholder="Select mode" ariaLabel="Collaboration mode" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Rémunération</FieldLabel>
                <ToggleSwitchField label={remuneration ? "Rémunération active" : "Sans rémunération"} checked={remuneration} onChange={setRemuneration} />
              </div>
              <div>
                <FieldLabel>Engagement</FieldLabel>
                <SelectInput value={engagement} onChange={(value) => setEngagement(value as "Long terme" | "Ponctuel")} options={["Long terme", "Ponctuel"]} placeholder="Select engagement" ariaLabel="Engagement" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Availability</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={AVAILABILITIES} placeholder="Select availability" ariaLabel="Availability" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Language</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="e.g. English" ariaLabel="Language" />
              </div>
              <div>
                <FieldLabel>Experience level</FieldLabel>
                <SelectInput
                  value=""
                  onChange={() => {}}
                  options={["Beginner accepted", "Intermediate", "Advanced", "Professional"]}
                  placeholder="Select level"
                  ariaLabel="Experience level"
                  minWidth={0}
                />
              </div>
            </FormSection>
            <FormSection title="Content">
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Short description</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="One-line summary" ariaLabel="Short description" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Full description</FieldLabel>
                <TextArea placeholder="Describe the project, expectations, and context…" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Application instructions</FieldLabel>
                <TextArea placeholder="How should collaborators apply?" rows={3} />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={["Draft", "Open"]} placeholder="Select status" ariaLabel="Status" minWidth={0} />
              </div>
            </FormSection>
          </>
        ) : (
          <>
            <FormSection title="Profile">
              <div>
                <FieldLabel>Avatar or portfolio image</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="Upload or paste URL" ariaLabel="Avatar or portfolio image" />
              </div>
              <div>
                <FieldLabel>Role offered</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={ROLES} placeholder="Select role" ariaLabel="Role offered" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Main skills</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="Comma-separated skills" ariaLabel="Main skills" />
              </div>
              <div>
                <FieldLabel>Preferred genres</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="e.g. Action, Drama" ariaLabel="Preferred genres" />
              </div>
            </FormSection>
            <FormSection title="Collaboration">
              <div>
                <FieldLabel>Availability</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={AVAILABILITIES} placeholder="Select availability" ariaLabel="Availability" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Collaboration mode</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={MODES} placeholder="Select mode" ariaLabel="Collaboration mode" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Rémunération</FieldLabel>
                <ToggleSwitchField label={remuneration ? "Rémunération active" : "Sans rémunération"} checked={remuneration} onChange={setRemuneration} />
              </div>
              <div>
                <FieldLabel>Engagement</FieldLabel>
                <SelectInput value={engagement} onChange={(value) => setEngagement(value as "Long terme" | "Ponctuel")} options={["Long terme", "Ponctuel"]} placeholder="Select engagement" ariaLabel="Engagement" minWidth={0} />
              </div>
              <div>
                <FieldLabel>Language</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="e.g. English" ariaLabel="Language" />
              </div>
              <div>
                <FieldLabel>Portfolio link</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="https://…" ariaLabel="Portfolio link" />
              </div>
            </FormSection>
            <FormSection title="Content">
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Short description</FieldLabel>
                <TextInput value="" onChange={() => {}} placeholder="One-line summary" ariaLabel="Short description" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Full description</FieldLabel>
                <TextArea placeholder="Describe your background, style, and goals…" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Contact instructions</FieldLabel>
                <TextArea placeholder="How should teams reach out?" rows={3} />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <SelectInput value="" onChange={() => {}} options={["Draft", "Open"]} placeholder="Select status" ariaLabel="Status" minWidth={0} />
              </div>
            </FormSection>
          </>
        )}
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
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onClose}>Send Application</PrimaryButton>
      </div>
    </ModalShell>
  );
}

function TextArea({ placeholder, rows = 5 }: { placeholder?: string; rows?: number }) {
  const [focus, setFocus] = useState(false);
  return (
    <textarea
      rows={rows}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...manrope,
        width: "100%",
        background: C.input,
        border: `1px solid ${focus ? C.neon : "rgba(133,154,206,0.20)"}`,
        boxShadow: focus ? "0 0 0 3px rgba(57,255,136,0.10)" : "none",
        color: C.text,
        borderRadius: 14,
        padding: "12px 14px",
        fontSize: 14,
        fontWeight: 500,
        outline: "none",
        resize: "vertical",
        minHeight: 100,
      }}
    />
  );
}
