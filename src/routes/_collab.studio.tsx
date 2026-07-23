import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Search, MoreHorizontal,
  Edit3, Copy, Trash2, Check, Upload, Image as ImageIcon, Calendar as CalendarIcon,
  StickyNote, Megaphone, ChevronLeft, ChevronRight,
  BookOpen, Layers, AlertTriangle, FileImage, RefreshCw, Save, Play,
  ArrowUpDown, Target, Star, X,
  Users, UserPlus, Rocket, Undo2, Handshake, Info,
} from "lucide-react";
import { addSponsorOption, updateSponsorOption } from "@/lib/sponsorship-options";
import { ServiceFormModal } from "@/components/sponsorship/ServiceFormModal";
import { DetailDialog } from "@/components/sponsorship/DetailDialog";
import { announcementFromStudioSponsorship } from "@/lib/sponsorship-map";
import { projectAnnouncementFromRecruit } from "@/lib/recruit-map";
import { DetailsModal as RecruitDetailsModal } from "./_collab.announcements";
import {
  deleteStudioProject,
  leaveStudioProject,
  loadStudioProjects,
  removeStudioProjectMember,
  saveStudioProjects,
  subscribeStudioProjects,
  transferStudioProjectOwnership,
  updateStudioProjectMember,
} from "@/lib/studio-projects";
import { addAnnouncement, sendProjectInvitationDb, updateAnnouncement } from "@/lib/db";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  formatMoney as formatSponsorshipMoney,
  STATUS_META as SPONSORSHIP_STATUS_META,
  useSponsorships as useLinkedSponsorships,
} from "@/features/sponsorships/store";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_collab/studio")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" && search.project.trim() ? search.project : undefined,
    chapter: typeof search.chapter === "string" && search.chapter.trim() ? search.chapter : undefined,
  }),
  head: () => ({ meta: [{ title: "Mes projets — CollabManga" }] }),
  component: CollabMangaPage,
});

/* ---------- Types & mock data ---------- */

type ProjectStatus = "Draft" | "In progress" | "Paused" | "Finished";
type ChapterStatus = "Draft" | "In progress" | "Ready for review" | "Published";
type CandidateStatus = "Empty" | "Imported" | "Selected" | "Validated";
type NoteCategory = "Story" | "Character" | "Scene" | "Task" | "Reminder" | "Sponsorship" | "Other";

interface Candidate { id: string; status: CandidateStatus; image?: string; }
interface PageItem {
  id: string; number: number; title: string; description: string;
  candidates: Candidate[]; validatedCandidateId: string | null;
  noteRef?: string; updated: string;
}
interface Chapter {
  id: string; number: number; title: string; status: ChapterStatus;
  objective: string; pages: PageItem[]; updated: string;
}
interface Note {
  id: string; title: string; preview: string; content: string;
  category: NoteCategory; date?: string; priority: "Low" | "Medium" | "High"; status: string;
}
interface Sponsorship {
  id: string; title: string; status: "Draft" | "Open" | "Paused" | "Closed" | "Archived";
  publicId?: string;
  description: string; created: string;
  platform: string; videoType: string; duration: string;
  subscribers: number; subscribersMax?: number; quantity: number; price: string; paymentMode: string;
}
interface RecruitAnnouncement {
  id: string; title: string; hook: string; language: string;
  publicId?: string;
  role: string; status: "Ouverte" | "Brouillon";
  description: string; commitment: string; compensation: string;
  remunerated: boolean; created: string;
}
interface Project {
  id: string; title: string; synopsis: string; status: ProjectStatus;
  chaptersCount: number; validatedPages: number; totalPages: number;
  updated: string; genres: string[]; chapters: Chapter[]; notes: Note[]; sponsorships: Sponsorship[];
  recruits?: RecruitAnnouncement[];
  /** Sous-genres favoris du projet. */
  subgenres?: string[];
  /** Langue du projet (par défaut : langue du site choisie par l'utilisateur). */
  language?: string;
  /** Couverture importée (data URL). */
  coverDataUrl?: string;
  /** Projet visible dans le catalogue public (masquable dans les paramètres). */
  catalogVisible?: boolean;
  /** Membres du projet avec leur niveau d'accès. */
  collaborators?: Collaborator[];
  /** Note publique, lorsqu'elle est disponible depuis le catalogue. */
  rating?: number;
}

const COLLAB_ROLES = ["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"];

function hasPublishedChapter(p: Project) {
  return p.chapters.some((c) => c.status === "Published");
}

function deriveProjectState(p: Project): Project {
  const chaptersCount = p.chapters.length;
  const totalPages = p.chapters.reduce((total, chapter) => total + chapter.pages.length, 0);
  const validatedPages = p.chapters.reduce(
    (total, chapter) => total + chapter.pages.filter((page) => page.validatedCandidateId).length,
    0,
  );
  const countsChanged = p.chaptersCount !== chaptersCount || p.totalPages !== totalPages || p.validatedPages !== validatedPages;
  const withCounts = countsChanged ? { ...p, chaptersCount, totalPages, validatedPages } : p;
  const published = hasPublishedChapter(withCounts);
  if (!published) {
    if (withCounts.status === "Draft" && !withCounts.catalogVisible) return withCounts;
    return { ...withCounts, status: "Draft", catalogVisible: false };
  }
  if (withCounts.status === "Finished") {
    return withCounts.catalogVisible ? withCounts : { ...withCounts, catalogVisible: true };
  }
  const status: ProjectStatus = withCounts.catalogVisible ? "In progress" : "Paused";
  return withCounts.status === status ? withCounts : { ...withCounts, status };
}

/**
 * Règles de statut du projet :
 * - aucun chapitre publié → Draft, jamais visible dans le catalogue ;
 * - ≥1 chapitre publié + visible → In progress ;
 * - ≥1 chapitre publié + masqué → Paused ;
 * - Finished (choisi dans les paramètres) → reste visible dans le catalogue.
 */
function normalizeProjectState(p: Project): Project {
  const chapters = (Array.isArray(p.chapters) ? p.chapters : []).map((chapter, chapterIndex) => {
    const rawPages = Array.isArray(chapter.pages) && chapter.pages.length > 0 ? chapter.pages : makeEmptyPages(1);
    const pages = rawPages.map((page, pageIndex) => {
      const rawCandidates = Array.isArray(page.candidates) && page.candidates.length > 0
        ? page.candidates
        : [{ id: `c-restored-${Date.now()}-${chapterIndex}-${pageIndex}`, status: "Empty" as CandidateStatus }];
      const candidates = rawCandidates.map((candidate, candidateIndex) => ({
        id: candidate.id || `c-restored-${Date.now()}-${chapterIndex}-${pageIndex}-${candidateIndex}`,
        image: typeof candidate.image === "string" ? candidate.image : undefined,
        status: (candidate.image ? "Imported" : "Empty") as CandidateStatus,
      }));
      const validatedCandidateId = candidates.some((candidate) => candidate.id === page.validatedCandidateId && candidate.image)
        ? page.validatedCandidateId
        : null;
      return {
        ...page,
        id: page.id || `p-restored-${Date.now()}-${chapterIndex}-${pageIndex}`,
        number: Number.isFinite(page.number) ? page.number : pageIndex + 1,
        title: typeof page.title === "string" ? page.title : `Page ${pageIndex + 1}`,
        description: typeof page.description === "string" ? page.description : "",
        candidates: candidates.map((candidate) => ({
          ...candidate,
          status: candidate.id === validatedCandidateId ? "Validated" : candidate.status,
        })),
        validatedCandidateId,
        updated: typeof page.updated === "string" ? page.updated : "À l'instant",
      };
    });
    return {
      ...chapter,
      id: chapter.id || `ch-restored-${Date.now()}-${chapterIndex}`,
      number: Number.isFinite(chapter.number) ? chapter.number : chapterIndex + 1,
      title: typeof chapter.title === "string" ? chapter.title : `Chapitre ${chapterIndex + 1}`,
      objective: typeof chapter.objective === "string" ? chapter.objective : "Objectif à définir.",
      pages,
      updated: typeof chapter.updated === "string" ? chapter.updated : "À l'instant",
    };
  });
  const safeProject: Project = {
    ...p,
    chapters,
    chaptersCount: chapters.length,
    totalPages: chapters.reduce((total, chapter) => total + chapter.pages.length, 0),
    validatedPages: chapters.reduce(
      (total, chapter) => total + chapter.pages.filter((page) => page.validatedCandidateId).length,
      0,
    ),
    genres: Array.isArray(p.genres) ? p.genres : [],
    subgenres: Array.isArray(p.subgenres) ? p.subgenres : [],
    notes: Array.isArray(p.notes) ? p.notes : [],
    sponsorships: Array.isArray(p.sponsorships) ? p.sponsorships : [],
    recruits: (Array.isArray(p.recruits) ? p.recruits : []).map((recruit) => ({
      ...recruit,
      title: recruit.title || (recruit.role ? `Recherche ${recruit.role}` : "Annonce de recrutement"),
      hook: recruit.hook || "",
      language: recruit.language || "FR",
    })),
    collaborators: Array.isArray(p.collaborators) && p.collaborators.length > 0 ? p.collaborators : defaultCollaborators(),
  };
  return deriveProjectState(safeProject);
}

function normalizeStoredProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Project>;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  return normalizeProjectState({
    id: raw.id,
    title: raw.title,
    synopsis: typeof raw.synopsis === "string" ? raw.synopsis : "Synopsis à compléter.",
    status: raw.status ?? "Draft",
    chaptersCount: raw.chaptersCount ?? 0,
    validatedPages: raw.validatedPages ?? 0,
    totalPages: raw.totalPages ?? 0,
    updated: typeof raw.updated === "string" ? raw.updated : "À l'instant",
    genres: raw.genres ?? [],
    subgenres: raw.subgenres ?? [],
    chapters: raw.chapters ?? [],
    notes: raw.notes ?? [],
    sponsorships: raw.sponsorships ?? [],
    recruits: raw.recruits ?? [],
    coverDataUrl: raw.coverDataUrl,
    catalogVisible: raw.catalogVisible,
    collaborators: raw.collaborators,
    rating: typeof raw.rating === "number" ? Math.max(0, Math.min(5, raw.rating)) : undefined,
  });
}

// Chaque nouvelle page démarre avec un seul candidat vide ; d'autres peuvent être ajoutés librement.
const makeEmptyPages = (n: number): PageItem[] =>
  Array.from({ length: n }).map((_, i) => {
    const idx = i + 1;
    return {
      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      number: idx,
      title: `Page ${idx}`,
      description: "",
      candidates: [{ id: `c-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`, status: "Empty" as CandidateStatus }],
      validatedCandidateId: null,
      updated: "À l'instant",
    };
  });

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Le fichier sélectionné n'est pas une image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(file);
  });
}

/* ---------- Small UI primitives ---------- */

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "neon" | "warn" | "danger" | "info" }) {
  const styles: Record<string, string> = {
    neutral: "bg-[var(--input-bg)] text-[var(--text-secondary)] border-[var(--border-default)]",
    neon: "bg-[var(--neon-soft)] text-[var(--neon)] border-[var(--neon-border)]",
    warn: "bg-[rgba(255,184,77,0.10)] text-[var(--warning)] border-[rgba(255,184,77,0.35)]",
    danger: "bg-[rgba(255,95,126,0.10)] text-[var(--danger)] border-[rgba(255,95,126,0.35)]",
    info: "bg-[rgba(117,167,255,0.10)] text-[var(--info)] border-[rgba(117,167,255,0.35)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${styles[tone]}`}>
      {tone === "neon" && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

function toneForProjectStatus(s: ProjectStatus) {
  return s === "Finished" ? "neon" : s === "In progress" ? "info" : s === "Draft" ? "neutral" : "warn";
}
function toneForChapterStatus(s: ChapterStatus) {
  return s === "Published" ? "neon" : s === "Ready for review" ? "info" : s === "In progress" ? "warn" : "neutral";
}

function PrimaryButton({ children, onClick, className = "", icon: Icon }: { children: React.ReactNode; onClick?: () => void; className?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <button onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--neon)] px-[18px] text-[14px] font-bold text-[#04111E] transition-colors hover:bg-[var(--neon-hover)] ${className}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
function SecondaryButton({ children, onClick, className = "", icon: Icon }: { children: React.ReactNode; onClick?: () => void; className?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <button onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-[14px] border border-[var(--border-strong)] bg-transparent px-[18px] text-[14px] font-bold text-[var(--text-primary)] transition-colors hover:bg-white/[0.04] ${className}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
function GhostButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-[14px] px-3 text-[14px] font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] ${className}`}>{children}</button>
  );
}
function DangerButton({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick?: () => void; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <button onClick={onClick} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-[18px] text-[14px] font-bold text-[var(--danger)] transition-colors hover:bg-[rgba(255,95,126,0.18)]">
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
function IconButton({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick?: () => void; ariaLabel: string }) {
  return (
    <button aria-label={ariaLabel} onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--border-default)] bg-[var(--elevated)] text-[var(--text-secondary)] transition-colors hover:border-[var(--neon-border)] hover:text-[var(--text-primary)]">
      {children}
    </button>
  );
}
function TextInput({ value, onChange, placeholder, icon: Icon, className = "" }: { value?: string; onChange?: (v: string) => void; placeholder?: string; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />}
      <input
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-shadow focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] ${Icon ? "pl-11" : ""}`}
      />
    </div>
  );
}
function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? "border-[var(--neon-border)] bg-[var(--neon-soft)] text-[var(--neon)]" : "border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
      {label}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--input-bg)]">
      <div className="h-full rounded-full bg-[var(--neon)]" style={{ width: `${v}%`, boxShadow: v > 0 ? "0 0 12px rgba(57,255,136,0.35)" : undefined }} />
    </div>
  );
}

/* ---------- Cover placeholder ---------- */

function CoverPlaceholder({ title, className = "" }: { title: string; className?: string }) {
  const { t } = useI18n();
  const initials = title.split(" ").map(w => w[0]).slice(0, 2).join("");
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-gradient-to-br from-[#0E1736] via-[#0B1430] to-[#050B1D] ${className}`}>
      <div className="absolute inset-3 rounded-[10px] border border-[var(--border-default)]" />
      <div className="absolute inset-6 rounded-[8px] border border-dashed border-[var(--border-default)]" />
      <div className="relative z-10 flex flex-col items-center gap-2 px-3 text-center">
        <div className="font-display text-[28px] font-bold text-[var(--text-primary)]">{initials}</div>
        <div className="tiny-meta text-[var(--text-muted)]">{t("mangaDetail.coverPending")}</div>
      </div>
      <div className="absolute right-2 top-2 rounded-md bg-black/40 px-1.5 py-0.5 tiny-meta text-[var(--text-muted)]">3:4</div>
    </div>
  );
}

/* ---------- Page Header ---------- */

function PageHeader({
  eyebrow, title, description, back, actions,
}: { eyebrow?: React.ReactNode; title: string; description?: string; back?: { label: string; onClick: () => void }; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <button onClick={back.onClick} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--neon)]">
            <ArrowLeft className="h-4 w-4" /> {back.label}
          </button>
        )}
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[28px] font-bold leading-9 text-[var(--text-primary)]">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--text-secondary)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- STATE 1: Project selection ---------- */

function ProjectSelection({ projects, onOpen, onCreate }: { projects: Project[]; onOpen: (id: string) => void; onCreate: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [sortAscending, setSortAscending] = useState(true);

  const filtered = useMemo(() => {
    const query = q.trim().toLocaleLowerCase("fr");
    return projects
      .filter((project) => !query || project.title.toLocaleLowerCase("fr").includes(query))
      .sort((a, b) => {
        const order = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
        return sortAscending ? order : -order;
      });
  }, [projects, q, sortAscending]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("studio.myProjects")}
        description={t("studio.projectSelectionDesc")}
        actions={<PrimaryButton icon={Plus} onClick={onCreate}>{t("studio.createProjectBtn")}</PrimaryButton>}
      />

      {/* Control bar — search + sort only */}
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput icon={Search} value={q} onChange={setQ} placeholder={t("studio.searchProjects")} className="sm:flex-1" />
          <SecondaryButton icon={ArrowUpDown} className="!h-10 !px-3" onClick={() => setSortAscending((value) => !value)}>
            {sortAscending ? "A–Z" : "Z–A"}
          </SecondaryButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-12 text-center shadow-[var(--shadow-panel)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--elevated)]"><BookOpen className="h-6 w-6 text-[var(--neon)]" /></div>
          <h2 className="mt-5 font-display text-[20px] font-bold">{t("studio.noProjectsYetTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--text-secondary)]">{t("studio.noProjectsYetText")}</p>
          <div className="mt-6 flex justify-center"><PrimaryButton icon={Plus} onClick={onCreate}>{t("studio.createProjectBtn")}</PrimaryButton></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Niveaux d'accès au projet : un seul chef (le créateur), des éditeurs, des collaborateurs. */
type CollabLevel = "chef" | "editeur" | "collaborateur";
type Collaborator = {
  id: string;
  name: string;
  role: string;
  level: CollabLevel;
  isCurrentUser?: boolean;
  avatarUrl?: string;
};

const LEVEL_LABEL_KEY: Record<CollabLevel, TranslationKey> = {
  chef: "studio.levelChef",
  editeur: "studio.levelEditeur",
  collaborateur: "studio.levelCollaborateur",
};

const defaultCollaborators = (): Collaborator[] => [
  { id: "co-owner", name: "Vous", role: "Scénariste", level: "chef", isCurrentUser: true },
];

function projectCollaborators(p: Project): Collaborator[] {
  return p.collaborators && p.collaborators.length > 0 ? p.collaborators : defaultCollaborators();
}

/** Niveau de l'utilisateur courant (« Vous ») dans le projet. */
function myLevel(p: Project): CollabLevel {
  return projectCollaborators(p).find((c) => c.isCurrentUser || c.name === "Vous")?.level ?? "collaborateur";
}

function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= full ? "text-[var(--warning)]" : "text-[var(--text-disabled)]"}`}
          fill={i <= full ? "var(--warning)" : "none"}
        />
      ))}
      <span className="ml-1.5 text-[12px] font-semibold text-[var(--text-muted)]">{value.toFixed(1)}</span>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <div className="group flex flex-col overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--elevated)] p-4 shadow-[var(--shadow-card)] transition-all hover:border-[var(--neon-border)] hover:shadow-[var(--shadow-neon)]">
      {project.coverDataUrl ? (
        <img src={project.coverDataUrl} alt={`Couverture de ${project.title}`} className="aspect-[3/4] w-full rounded-[14px] border border-[var(--border-default)] object-cover" />
      ) : (
        <CoverPlaceholder title={project.title} className="aspect-[3/4] w-full" />
      )}
      <h3 className="mt-4 truncate text-[15px] font-bold">{project.title}</h3>
      <div className="mt-2"><StarRating value={project.rating ?? 0} /></div>
      <div className="mt-4">
        <PrimaryButton onClick={onOpen} className="!h-10 w-full justify-center !px-3">{t("studio.open")}</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- STATE 2: Project Workspace ---------- */

type ProjectTab = "Information" | "Chapters" | "Notes" | "Calendar" | "Recrutement" | "Parrainage" | "Collaborateurs" | "Settings";

function ProjectWorkspace({
  project,
  onBack,
  onOpenChapter,
  onWorkflow,
  updateProject,
  onDeleteProject,
  onLeaveProject,
}: {
  project: Project;
  onBack: () => void;
  onOpenChapter: (id: string) => void;
  onWorkflow: (message: string) => void;
  updateProject: (updater: (p: Project) => Project) => void;
  onDeleteProject: () => void;
  onLeaveProject: () => void;
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<ProjectTab>("Chapters");
  const isMobile = useIsMobile();
  const [modal, setModal] = useState<"chapter" | "note" | "parrainage" | "recruit" | null>(null);
  const [noteDate, setNoteDate] = useState<string | undefined>(undefined);
  const tabsRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const level = myLevel(project);
  const deny = (key: TranslationKey) => `${t("studio.denyPrefix")} ${t(key)}`;
  const openManagedModal = (kind: "chapter" | "note" | "parrainage" | "recruit") => {
    if (level === "collaborateur") {
      onWorkflow(deny("studio.denyImagesOnly"));
      return;
    }
    setModal(kind);
  };
  const openNote = (date?: string) => {
    if (level === "collaborateur") {
      onWorkflow(deny("studio.denyCreateNote"));
      return;
    }
    setNoteDate(date);
    setModal("note");
  };
  const onCoverFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (level === "collaborateur") {
      onWorkflow(deny("studio.denyCannotEditCover"));
      return;
    }
    void readImageFile(file).then((coverDataUrl) => {
      updateProject((p) => ({ ...p, coverDataUrl, updated: "À l'instant" }));
      onWorkflow(t("studio.coverUpdatedMsg"));
    }).catch(() => onWorkflow(t("studio.coverImportFailedMsg")));
  };
  const openCalendar = () => {
    setTab("Calendar");
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  useEffect(() => {
    setTab((current) => {
      if (isMobile && current === "Chapters") return "Information";
      if (!isMobile && current === "Information") return "Chapters";
      return current;
    });
  }, [isMobile]);

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden md:block">
        <PageHeader
          back={{ label: t("studio.backToProjects"), onClick: onBack }}
          eyebrow={<span className="tiny-meta text-[var(--neon)]">{t("studio.projectWorkspace")}</span>}
          title={project.title}
          description={`${project.status} · ${project.chaptersCount} ${locale === "fr" ? "chapitres" : "chapters"} · ${project.validatedPages}/${project.totalPages} ${t("studio.pagesWord")} ${t("studio.validatedWord")}`}
          actions={<PrimaryButton icon={Plus} onClick={() => openManagedModal("chapter")}>{t("studio.addChapter")}</PrimaryButton>}
        />
      </div>

      <div className="md:hidden">
        <button type="button" onClick={onBack} className="btn-ghost -ml-2 mb-2 h-10">
          <ArrowLeft className="h-4 w-4" /> {t("studio.backToProjects")}
        </button>
        <section className="overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[var(--panel)] shadow-[var(--shadow-panel)]">
          <h1 className="px-4 py-3 font-display text-[22px] font-extrabold leading-7">{project.title}</h1>
          {project.coverDataUrl ? (
            <img src={project.coverDataUrl} alt={`Couverture de ${project.title}`} className="aspect-[3/4] w-full object-cover" />
          ) : (
            <CoverPlaceholder title={project.title} className="aspect-[3/4] w-full" />
          )}
        </section>
      </div>

      {/* Summary panel */}
      <div className="hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-6 shadow-[var(--shadow-panel)] md:block">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr_280px]">
          {/* Left: cover */}
          <div className="flex flex-col gap-3">
            {project.coverDataUrl ? (
              <img
                src={project.coverDataUrl}
                alt={`Couverture de ${project.title}`}
                className="aspect-[3/4] w-full max-w-[200px] rounded-[14px] border border-[var(--border-default)] object-cover"
              />
            ) : (
              <CoverPlaceholder title={project.title} className="aspect-[3/4] w-full max-w-[200px]" />
            )}
            <SecondaryButton icon={Upload} className="!h-10 !px-3" onClick={() => coverInputRef.current?.click()}>{t("studio.replaceCover")}</SecondaryButton>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { onCoverFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}
            />
            <StatusChip label={project.status} tone={toneForProjectStatus(project.status)} />
          </div>

          {/* Center: info */}
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.projectName")}</div>
              <div className="font-display text-[20px] font-bold leading-7">{project.title}</div>
            </div>
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.synopsis")}</div>
              <p className="text-[14px] leading-[22px] text-[var(--text-secondary)]">{project.synopsis}</p>
            </div>
            <div>
              <div className="tiny-meta mb-2 text-[var(--text-muted)]">{t("studio.genres")}</div>
              <div className="flex flex-wrap gap-2">
                {project.genres.map(g => <Chip key={g} label={g} active />)}
              </div>
            </div>
            {(project.subgenres && project.subgenres.length > 0) && (
              <div>
                <div className="tiny-meta mb-2 text-[var(--text-muted)]">{t("studio.subgenres")}</div>
                <div className="flex flex-wrap gap-2">
                  {project.subgenres.map(g => <Chip key={g} label={g} />)}
                </div>
              </div>
            )}
          </div>

          {/* Right: stats + quick actions */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label={t("studio.chapters")} value={project.chaptersCount} />
              <StatBox label={t("studio.sponsorships")} value={project.sponsorships.length} />
              <StatBox label={t("studio.collaborators")} value={projectCollaborators(project).length} />
              <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--elevated)] p-3">
                <div className="flex items-center gap-1 font-display text-[20px] font-bold leading-7 text-[var(--warning)]">
                  <Star className="h-4 w-4" fill="var(--warning)" />
                  {(project.rating ?? 0).toFixed(1)}
                </div>
                <div className="tiny-meta text-[var(--text-muted)]">{t("studio.rating")}</div>
              </div>
            </div>
            <div className="mt-1 grid gap-2">
              <SecondaryButton icon={Plus} className="!h-10 justify-start !px-3" onClick={() => openManagedModal("chapter")}>{t("studio.addChapter")}</SecondaryButton>
              <SecondaryButton icon={StickyNote} className="!h-10 justify-start !px-3" onClick={() => openNote()}>{t("studio.addNote")}</SecondaryButton>
              <SecondaryButton icon={Megaphone} className="!h-10 justify-start !px-3" onClick={() => openManagedModal("parrainage")}>{t("studio.addSponsorship")}</SecondaryButton>
              <SecondaryButton icon={CalendarIcon} className="!h-10 justify-start !px-3" onClick={openCalendar}>{t("studio.openCalendar")}</SecondaryButton>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div ref={tabsRef} className="flex flex-col gap-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={isMobile ? ["Information", "Chapters", "Notes", "Calendar", "Recrutement", "Parrainage", "Collaborateurs", "Settings"] : ["Chapters", "Notes", "Calendar", "Recrutement", "Parrainage", "Collaborateurs", "Settings"]}
          icons={{ Information: Info, Recrutement: Megaphone, Parrainage: Handshake, Collaborateurs: Users }}
          labels={{
            Information: t("studio.tabInformation"),
            Chapters: t("studio.tabChapters"),
            Notes: t("studio.tabNotes"),
            Calendar: t("studio.tabCalendar"),
            Recrutement: t("studio.tabRecruitment"),
            Parrainage: t("studio.tabSponsorship"),
            Collaborateurs: t("studio.tabCollaborators"),
            Settings: t("studio.tabSettings"),
          }}
        />

        {tab === "Information" && (
          <section className="rounded-[18px] border border-[var(--border-default)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)] md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusChip label={project.status} tone={toneForProjectStatus(project.status)} />
              <StarRating value={project.rating ?? 0} />
            </div>
            <div className="mt-5">
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.synopsis")}</div>
              <p className="text-[14px] leading-[22px] text-[var(--text-secondary)]">{project.synopsis}</p>
            </div>
            <div className="mt-5">
              <div className="tiny-meta mb-2 text-[var(--text-muted)]">{t("studio.genres")}</div>
              <div className="flex flex-wrap gap-2">
                {project.genres.map(genre => <Chip key={genre} label={genre} active />)}
                {(project.subgenres ?? []).map(genre => <Chip key={genre} label={genre} />)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <StatBox label={t("studio.chapters")} value={project.chaptersCount} />
              <StatBox label={t("studio.validatedPages")} value={project.validatedPages} />
              <StatBox label={t("studio.sponsorships")} value={project.sponsorships.length} />
              <StatBox label={t("studio.collaborators")} value={projectCollaborators(project).length} />
            </div>
            <div className="mt-5 grid gap-2">
              <SecondaryButton icon={Upload} className="!h-10 justify-start !px-3" onClick={() => coverInputRef.current?.click()}>{t("studio.replaceCover")}</SecondaryButton>
              <SecondaryButton icon={Plus} className="!h-10 justify-start !px-3" onClick={() => openManagedModal("chapter")}>{t("studio.addChapter")}</SecondaryButton>
              <SecondaryButton icon={StickyNote} className="!h-10 justify-start !px-3" onClick={() => openNote()}>{t("studio.addNote")}</SecondaryButton>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => { onCoverFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
            />
          </section>
        )}
        {tab === "Chapters" && <ChaptersTab project={project} onOpenChapter={onOpenChapter} onAdd={() => openManagedModal("chapter")} updateProject={updateProject} onWorkflow={onWorkflow} />}
        {tab === "Notes" && <NotesTab project={project} onAdd={() => openNote()} updateProject={updateProject} onWorkflow={onWorkflow} />}
        {tab === "Calendar" && <CalendarTab project={project} onAddNote={openNote} />}
        {tab === "Recrutement" && <RecrutementTab project={project} onAddRecruit={() => openManagedModal("recruit")} updateProject={updateProject} onWorkflow={onWorkflow} />}
        {tab === "Parrainage" && <ParrainageTab project={project} onAddParrainage={() => openManagedModal("parrainage")} updateProject={updateProject} onWorkflow={onWorkflow} />}
        {tab === "Collaborateurs" && <CollaborateursTab project={project} onWorkflow={onWorkflow} updateProject={updateProject} onLeaveProject={onLeaveProject} />}
        {tab === "Settings" && <SettingsTab project={project} updateProject={updateProject} onDeleteProject={onDeleteProject} onWorkflow={onWorkflow} onLeaveProject={onLeaveProject} />}
      </div>

      {modal === "chapter" && (
        <AddChapterModal
          onClose={() => setModal(null)}
          onAdd={(chapter) => {
            updateProject((p) => ({
              ...p,
              chapters: [...p.chapters, { ...chapter, number: p.chapters.length ? Math.max(...p.chapters.map((item) => item.number)) + 1 : 1 }],
              chaptersCount: p.chapters.length + 1,
              totalPages: p.totalPages + chapter.pages.length,
              updated: "À l'instant",
            }));
            setModal(null);
            onWorkflow(`${t("studio.chapterTitleField")} « ${chapter.title} ${t("studio.chapterAddedSuffix")}`);
          }}
        />
      )}
      {modal === "note" && (
        <AddNoteModal
          onClose={() => setModal(null)}
          defaultDate={noteDate}
          onAdd={(note) => {
            updateProject((p) => ({ ...p, notes: [note, ...p.notes], updated: "À l'instant" }));
            setModal(null);
            onWorkflow(t("studio.noteAddedMsg"));
          }}
        />
      )}
      {modal === "parrainage" && (
        <AddParrainageModal
          onClose={() => setModal(null)}
          onAdd={(sponsorship) => {
            void (async () => {
              try {
                const publicOption = await addSponsorOption({
                  mode: "project",
                  format: sponsorship.title,
                  platforms: sponsorship.platform.split(", ").filter(Boolean),
                  videoType: sponsorship.videoType,
                  duration: sponsorship.duration,
                  paymentMode: sponsorship.paymentMode,
                  price: sponsorship.price,
                  quantity: sponsorship.quantity,
                  description: sponsorship.description,
                  ownerName: project.title,
                  projectId: project.id,
                  projectCoverUrl: project.coverDataUrl ?? null,
                });
                updateProject((p) => ({
                  ...p,
                  sponsorships: [{ ...sponsorship, publicId: publicOption.id }, ...p.sponsorships],
                  updated: "À l'instant",
                }));
                setModal(null);
                onWorkflow(t("studio.sponsorshipPublishedMsg"));
              } catch (error) {
                onWorkflow(error instanceof Error ? error.message : t("studio.announcementPublishFailedMsg"));
              }
            })();
          }}
        />
      )}
      {modal === "recruit" && (
        <AddRecruitModal
          onClose={() => setModal(null)}
          onAdd={(recruit) => {
            void (async () => {
              try {
                const publicAnnouncement = await addAnnouncement({
                  mode: "project",
                  title: recruit.title,
                  hook: recruit.hook,
                  description: recruit.description,
                  language: recruit.language,
                  status_sought: recruit.role,
                  genres: project.genres,
                  subgenres: project.subgenres ?? [],
                  project_title: project.title,
                  remuneration: recruit.remunerated,
                  engagement: recruit.commitment === "Ponctuel" ? "Ponctuel" : "Long terme",
                });
                updateProject((p) => ({
                  ...p,
                  recruits: [{ ...recruit, publicId: publicAnnouncement.id }, ...(p.recruits ?? [])],
                  updated: "À l'instant",
                }));
                setModal(null);
                onWorkflow(t("studio.recruitAnnouncementPublishedMsg"));
              } catch (error) {
                onWorkflow(error instanceof Error ? error.message : t("studio.announcementPublishFailedMsg"));
              }
            })();
          }}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-[16px] border p-3 ${accent ? "border-[var(--neon-border)] bg-[var(--neon-soft)]" : "border-[var(--border-default)] bg-[var(--elevated)]"}`}>
      <div className={`font-display text-[20px] font-bold leading-7 ${accent ? "text-[var(--neon)]" : "text-[var(--text-primary)]"}`}>{value}</div>
      <div className="tiny-meta text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function Tabs<T extends string>({ value, onChange, items, icons, labels }: { value: T; onChange: (v: T) => void; items: T[]; icons?: Record<string, React.ComponentType<{ className?: string }>>; labels?: Record<string, string> }) {
  return (
    <div className="scrollbar-thin flex gap-1 overflow-x-auto rounded-[16px] border border-[var(--border-default)] bg-[var(--panel)] p-1.5">
      {items.map(item => {
        const active = item === value;
        const Icon = icons?.[item];
        return (
          <button key={item} onClick={() => onChange(item)} className={`inline-flex items-center gap-2 h-[38px] shrink-0 rounded-[12px] px-4 text-[13px] font-bold transition-colors ${active ? "bg-[var(--neon-soft)] text-[var(--neon)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            {Icon && <Icon className="h-4 w-4" />}
            {labels?.[item] ?? item}
          </button>
        );
      })}
    </div>
  );
}

/* ----- Chapters tab ----- */

function ChaptersTab({
  project,
  onOpenChapter,
  onAdd,
  updateProject,
  onWorkflow,
}: {
  project: Project;
  onOpenChapter: (id: string) => void;
  onAdd: () => void;
  updateProject?: (updater: (p: Project) => Project) => void;
  onWorkflow?: (message: string) => void;
}) {
  const { t } = useI18n();
  const [editChapter, setEditChapter] = useState<Chapter | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const canManage = myLevel(project) !== "collaborateur";
  const denyManage = () => onWorkflow?.(`${t("studio.denyPrefix")} ${t("studio.denyImagesOnly")}`);
  const visibleChapters = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return normalized
      ? project.chapters.filter((chapter) =>
          `${chapter.number} ${chapter.title} ${chapter.objective}`.toLocaleLowerCase("fr").includes(normalized),
        )
      : project.chapters;
  }, [project.chapters, query]);

  const duplicateChapter = (ch: Chapter) => {
    if (!canManage) return denyManage();
    if (!updateProject) return;
    const stamp = Date.now();
    const copy: Chapter = {
      ...ch,
      id: `ch-${stamp}`,
      number: project.chapters.length ? Math.max(...project.chapters.map((item) => item.number)) + 1 : 1,
      title: `${ch.title} (copie)`,
      status: "Draft",
      updated: "À l'instant",
      pages: ch.pages.map((p, i) => ({
        ...p,
        id: `p-${stamp}-${i}`,
        candidates: p.candidates.map((c, j) => ({
          ...c,
          id: `c-${stamp}-${i}-${j}`,
          status: c.image ? "Imported" : "Empty",
        })),
        validatedCandidateId: null,
      })),
    };
    updateProject((prev) => ({
      ...prev,
      chapters: [...prev.chapters, copy],
      chaptersCount: prev.chapters.length + 1,
      totalPages: prev.totalPages + copy.pages.length,
      updated: "À l'instant",
    }));
    onWorkflow?.(`${t("studio.chapterTitleField")} « ${ch.title} ${t("studio.chapterDuplicatedSuffix")}`);
  };

  const deleteChapter = (ch: Chapter) => {
    if (!canManage) return denyManage();
    if (!updateProject) return;
    updateProject((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((c) => c.id !== ch.id),
      chaptersCount: Math.max(0, prev.chapters.length - 1),
      totalPages: Math.max(0, prev.totalPages - ch.pages.length),
      updated: "À l'instant",
    }));
    setConfirmDeleteId(null);
    onWorkflow?.(`${t("studio.chapterTitleField")} « ${ch.title} ${t("studio.chapterDeletedSuffix")}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-[18px] font-bold">{t("studio.chaptersHeading")}</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <TextInput icon={Search} value={query} onChange={setQuery} placeholder={t("studio.findChapter")} className="w-full sm:w-64" />
          <PrimaryButton icon={Plus} onClick={onAdd}>{t("studio.addChapter")}</PrimaryButton>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {project.chapters.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><Layers className="h-5 w-5 text-[var(--neon)]" /></div>
            <h3 className="mt-4 font-display text-[18px] font-bold">{t("studio.noChaptersYetTitle")}</h3>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t("studio.noChaptersYetText")}</p>
            <div className="mt-4 flex justify-center"><PrimaryButton icon={Plus} onClick={onAdd}>{t("studio.addChapter")}</PrimaryButton></div>
          </div>
        )}
        {visibleChapters.map(ch => {
          const validated = ch.pages.filter(p => p.validatedCandidateId).length;
          const pct = ch.pages.length ? (validated / ch.pages.length) * 100 : 0;
          return (
            <div key={ch.id} className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--neon-border)]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] border border-[var(--border-strong)] bg-[var(--elevated)]">
                  <div className="font-display text-[24px] font-bold text-[var(--text-primary)]">{String(ch.number).padStart(2, "0")}</div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold">{ch.title}</h3>
                    <StatusChip label={ch.status} tone={toneForChapterStatus(ch.status)} />
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{ch.objective}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 tiny-meta text-[var(--text-muted)]">
                    <span>{ch.pages.length} {t("studio.pagesWord")}</span><span>•</span><span className="text-[var(--neon)]">{validated} {t("studio.validatedWord")}</span><span>•</span><span>{t("studio.editedPrefix")} {ch.updated}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:flex-col md:items-stretch">
                  <PrimaryButton onClick={() => onOpenChapter(ch.id)} className="!h-10 !px-4">{t("studio.open")}</PrimaryButton>
                  <div className="flex items-center gap-1.5">
                    <IconButton ariaLabel={t("studio.edit")} onClick={() => canManage ? setEditChapter(ch) : denyManage()}><Edit3 className="h-4 w-4" /></IconButton>
                    <IconButton ariaLabel={t("studio.duplicate")} onClick={() => duplicateChapter(ch)}><Copy className="h-4 w-4" /></IconButton>
                    {confirmDeleteId === ch.id ? (
                      <button
                        onClick={() => deleteChapter(ch)}
                        className="rounded-[12px] border border-[rgba(255,95,126,0.45)] bg-[rgba(255,95,126,0.12)] px-2.5 py-2 text-[12px] font-bold text-[var(--danger)]"
                      >
                        {t("studio.confirm")}
                      </button>
                    ) : (
                      <IconButton ariaLabel={t("studio.delete")} onClick={() => setConfirmDeleteId(ch.id)}><Trash2 className="h-4 w-4" /></IconButton>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {project.chapters.length > 0 && visibleChapters.length === 0 && (
          <div className="rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center text-[14px] text-[var(--text-muted)]">
            {t("studio.noSearchResultsChapters")}
          </div>
        )}
      </div>
      {editChapter && updateProject && (
        <EditChapterModal
          chapter={editChapter}
          onClose={() => setEditChapter(null)}
          onSave={(patch) => {
            updateProject((prev) => ({
              ...prev,
              chapters: prev.chapters.map((c) => (c.id === editChapter.id ? { ...c, ...patch, updated: "À l'instant" } : c)),
              updated: "À l'instant",
            }));
            setEditChapter(null);
            onWorkflow?.("Chapitre modifié.");
          }}
        />
      )}
    </div>
  );
}

function EditChapterModal({
  chapter,
  onClose,
  onSave,
}: {
  chapter: Chapter;
  onClose: () => void;
  onSave: (patch: Partial<Chapter>) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(chapter.title);
  const [objective, setObjective] = useState(chapter.objective);
  const [status, setStatus] = useState<string[]>([chapter.status]);
  return (
    <StudioModal
      title={t("studio.editChapterTitle")}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton>
          <PrimaryButton icon={Save} onClick={() => title.trim() && onSave({ title: title.trim(), objective: objective.trim(), status: (status[0] as ChapterStatus) || chapter.status })}>
            {t("studio.save")}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ModalField label={t("studio.chapterTitleLabel")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.title")} /></ModalField>
        <ModalField label={t("studio.objective")}><textarea value={objective} onChange={(e) => setObjective(e.target.value)} className={modalTextarea} /></ModalField>
        <ChoiceRow label={t("studio.status")} defaultValue={chapter.status} options={["Draft", "In progress", "Ready for review", "Published"]} onChange={setStatus} />
      </div>
    </StudioModal>
  );
}

/* ----- Notes tab ----- */

function EditNoteModal({ note, onClose, onSave }: { note: Note; onClose: () => void; onSave: (patch: Partial<Note>) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [date, setDate] = useState(note.date ?? "");
  const [priority, setPriority] = useState<string[]>([note.priority]);

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      preview: (content.trim() || title.trim()).slice(0, 120),
      content: content.trim(),
      date: date.trim() || undefined,
      priority: (priority[0] as Note["priority"]) || "Medium",
    });
  };

  return (
    <StudioModal
      title={t("studio.editNoteTitle")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Save} onClick={submit}>{t("studio.save")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <ModalField label={t("studio.title")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.noteTitlePlaceholder")} /></ModalField>
        <ModalField label={t("studio.content")}><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("studio.noteContentPlaceholder")} className={modalTextarea} /></ModalField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label={t("studio.linkedDate")}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition-shadow focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] [color-scheme:dark]"
            />
          </ModalField>
          <ChoiceRow label={t("studio.priority")} defaultValue={note.priority} options={["Low", "Medium", "High"]} onChange={setPriority} />
        </div>
      </div>
    </StudioModal>
  );
}

function NotesTab({
  project,
  onAdd,
  updateProject,
  onWorkflow,
}: {
  project: Project;
  onAdd: () => void;
  updateProject?: (updater: (p: Project) => Project) => void;
  onWorkflow?: (message: string) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(project.notes[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");
  const note = project.notes.find(n => n.id === selected) ?? null;
  const canManage = myLevel(project) !== "collaborateur";
  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return normalized
      ? project.notes.filter((item) => `${item.title} ${item.preview} ${item.content}`.toLocaleLowerCase("fr").includes(normalized))
      : project.notes;
  }, [project.notes, query]);
  const denyManage = () => onWorkflow?.(`${t("studio.denyPrefix")} ${t("studio.denyEditNotes")}`);

  useEffect(() => {
    if (selected && project.notes.some((item) => item.id === selected)) return;
    setSelected(project.notes[0]?.id ?? null);
  }, [project.notes, selected]);

  const saveNote = (patch: Partial<Note>) => {
    if (!canManage) return denyManage();
    if (!note) return;
    updateProject?.((p) => ({ ...p, notes: p.notes.map((n) => (n.id === note.id ? { ...n, ...patch } : n)), updated: "À l'instant" }));
    onWorkflow?.(t("studio.noteUpdatedMsg"));
    setEditing(false);
  };

  const deleteNote = () => {
    if (!canManage) return denyManage();
    if (!note) return;
    updateProject?.((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== note.id), updated: "À l'instant" }));
    onWorkflow?.(t("studio.noteDeletedMsg"));
    setSelected(null);
    setConfirmDelete(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold">{t("studio.tabNotes")}</h2>
          <PrimaryButton icon={Plus} className="!h-9 !px-3" onClick={onAdd}>{t("studio.new")}</PrimaryButton>
        </div>
        <TextInput icon={Search} value={query} onChange={setQuery} placeholder={t("studio.searchNotes")} className="mb-3" />
        <div className="flex flex-col gap-2">
          {visibleNotes.map(n => (
            <button key={n.id} onClick={() => { setSelected(n.id); setEditing(false); setConfirmDelete(false); }} className={`rounded-[14px] border p-3 text-left transition-colors ${selected === n.id ? "border-[var(--neon-border)] bg-[var(--neon-soft)]" : "border-[var(--border-default)] bg-[var(--elevated)] hover:border-[var(--border-strong)]"}`}>
              <div className="truncate text-[14px] font-bold">{n.title}</div>
              <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-secondary)]">{n.preview}</p>
              <div className="mt-2 flex items-center gap-3 tiny-meta text-[var(--text-muted)]">
                {n.date ? <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{n.date}</span> : <span>{t("studio.dateToDefine")}</span>}
                <span>•</span>
                <span className={n.priority === "High" ? "text-[var(--warning)]" : ""}>{n.priority}</span>
              </div>
            </button>
          ))}
          {project.notes.length > 0 && visibleNotes.length === 0 && (
            <p className="px-2 py-4 text-center text-[13px] text-[var(--text-muted)]">{t("studio.noSearchResultsNotes")}</p>
          )}
        </div>
      </div>
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-6 shadow-[var(--shadow-panel)]">
        {note ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="tiny-meta text-[var(--text-muted)]">{t("studio.tabNotes")}</div>
                <h3 className="mt-1 font-display text-[20px] font-bold">{note.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <SecondaryButton icon={Edit3} className="!h-10 !px-3" onClick={() => canManage ? setEditing(true) : denyManage()}>{t("studio.edit")}</SecondaryButton>
                {confirmDelete ? (
                  <>
                    <DangerButton icon={Trash2} onClick={deleteNote}>{t("studio.confirm")}</DangerButton>
                    <GhostButton onClick={() => setConfirmDelete(false)}>{t("studio.cancel")}</GhostButton>
                  </>
                ) : (
                  <DangerButton icon={Trash2} onClick={() => setConfirmDelete(true)}>{t("studio.delete")}</DangerButton>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetaField label={t("studio.linkedDate")} value={note.date ?? t("studio.dateToDefine")} />
              <MetaField label={t("studio.priority")} value={note.priority} />
            </div>
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.content")}</div>
              <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] leading-[22px] text-[var(--text-secondary)]">
                {note.content || note.preview || t("studio.noContent")}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-[14px] text-[var(--text-muted)]">{t("studio.selectNotePrompt")}</div>
        )}
      </div>
      {editing && note && (
        <EditNoteModal note={note} onClose={() => setEditing(false)} onSave={saveNote} />
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--elevated)] p-3">
      <div className="tiny-meta text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-[14px] font-bold">{value}</div>
    </div>
  );
}

/* ----- Calendar tab ----- */

function CalendarTab({ project, onAddNote }: { project: Project; onAddNote: (date: string) => void }) {
  const { t, locale } = useI18n();
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const shown = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const monthName = shown.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { month: "long", year: "numeric" });
  const weekdayLabels = locale === "fr"
    ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const events = project.notes.filter(n => n.date);
  const notesForDay = (day: number) =>
    events.filter(n => n.date === dateStr(day));

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedNote = project.notes.find(n => n.id === selectedNoteId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[18px] font-bold capitalize">{monthName}</h2>
            <IconButton ariaLabel={t("studio.prevMonth")} onClick={() => setMonthOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></IconButton>
            <IconButton ariaLabel={t("studio.nextMonth")} onClick={() => setMonthOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></IconButton>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("studio.today")}</button>
            )}
          </div>
          <span className="tiny-meta text-[var(--text-muted)]">{t("studio.calendarHint")}</span>
        </div>
        <div className="grid grid-cols-7 gap-1 tiny-meta text-[var(--text-muted)]">
          {weekdayLabels.map(d => <div key={d} className="p-2">{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="min-h-[92px] rounded-[12px] border border-transparent" />;
            const dayNotes = notesForDay(day);
            return (
              <div
                key={day}
                className="group min-h-[92px] rounded-[12px] border border-[var(--border-default)] bg-[var(--elevated)] p-2 text-left transition-colors hover:border-[var(--neon-border)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">{day}</span>
                  <button
                    type="button"
                    aria-label={`${t("studio.addNoteOnPrefix")} ${dateStr(day)}`}
                    onClick={() => onAddNote(dateStr(day))}
                    className="rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--neon)] group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {dayNotes.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNoteId(n.id)}
                    className={`mt-1.5 block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-bold transition-colors ${
                      selectedNoteId === n.id
                        ? "border-[var(--neon)] bg-[var(--neon-soft)] text-[var(--neon)]"
                        : "border-[var(--neon-border)] bg-[var(--neon-soft)] text-[var(--neon)] hover:border-[var(--neon)]"
                    }`}
                    title={n.title}
                  >
                    {n.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
        {selectedNote ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold">Note</h2>
              <button
                onClick={() => setSelectedNoteId(null)}
                className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ← {t("studio.upcoming")}
              </button>
            </div>
            <div className="rounded-[14px] border border-[var(--neon-border)] bg-[var(--elevated)] p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-bold text-[var(--text-primary)]">{selectedNote.title}</span>
                <StatusChip label={selectedNote.priority} tone={selectedNote.priority === "High" ? "warn" : "info"} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 tiny-meta text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{selectedNote.date ?? t("studio.noDate")}</span>
                <span>{selectedNote.category}</span>
                <span>{selectedNote.status}</span>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">
                {selectedNote.content || selectedNote.preview || t("studio.noContent")}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-[18px] font-bold">{t("studio.upcoming")}</h2>
            {events.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedNoteId(ev.id)}
                className="rounded-[14px] border border-[var(--border-default)] bg-[var(--elevated)] p-3 text-left transition-colors hover:border-[var(--neon-border)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-bold">{ev.title}</span>
                  <StatusChip label={ev.priority} tone={ev.priority === "High" ? "warn" : "info"} />
                </div>
                <div className="mt-1.5 flex items-center gap-3 tiny-meta text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{ev.date}</span>
                </div>
              </button>
            ))}
            {events.length === 0 && <p className="text-[14px] text-[var(--text-muted)]">{t("studio.noDeadlinesYet")}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ----- Sponsorship tab ----- */

function AnnonceCard({
  title, status, statusTone, description, metas, remunerated = false, onView, onManage,
}: {
  title: string;
  status: string;
  statusTone: "neutral" | "neon" | "warn" | "danger" | "info";
  description: string;
  metas: { label: string; value: string }[];
  remunerated?: boolean;
  onView?: () => void;
  onManage?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col rounded-[22px] border border-[var(--border-default)] bg-[var(--elevated)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold leading-[22px]">{title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {remunerated && (
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(57,255,136,0.45)] bg-[rgba(57,255,136,0.12)] font-display text-[14px] font-black text-[var(--neon)]">
              €
            </span>
          )}
          <StatusChip label={status} tone={statusTone} />
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--text-secondary)]">{description}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {metas.map(m => (
          <div key={m.label}>
            <div className="tiny-meta text-[var(--text-muted)]">{m.label}</div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SecondaryButton className="!h-10 !px-3" onClick={onView}>{t("profile.viewDetails")}</SecondaryButton>
        <PrimaryButton icon={Edit3} className="!h-10 !px-3" onClick={onManage}>{t("profile.manage")}</PrimaryButton>
      </div>
    </div>
  );
}

function EditRecruitModal({ recruit, onClose, onSave }: { recruit: RecruitAnnouncement; onClose: () => void; onSave: (patch: Partial<RecruitAnnouncement>) => void }) {
  const { t } = useI18n();
  const [remuneration, setRemuneration] = useState(recruit.remunerated);
  const [title, setTitle] = useState(recruit.title);
  const [hook, setHook] = useState(recruit.hook);
  const [description, setDescription] = useState(recruit.description);
  const [language, setLanguage] = useState<string[]>([recruit.language]);
  const [role, setRole] = useState<string[]>([recruit.role]);
  const [engagement, setEngagement] = useState<string[]>([recruit.commitment]);
  const [status, setStatus] = useState<string[]>([recruit.status]);

  const submit = () => {
    onSave({
      title: title.trim() || recruit.title,
      hook: hook.trim(),
      role: role[0] || recruit.role,
      language: language[0] || recruit.language,
      description: description.trim() || recruit.description,
      commitment: engagement[0] || recruit.commitment,
      compensation: remuneration ? "Rémunéré" : "Sans rémunération",
      remunerated: remuneration,
      status: (status[0] as RecruitAnnouncement["status"]) || recruit.status,
    });
  };

  return (
    <StudioModal
      title={t("studio.editRecruitTitle")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Save} onClick={submit}>{t("studio.save")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-6">
        <ChoiceRow label={t("studio.language")} defaultValue={recruit.language} options={["FR", "ENG", "ES", "IT", "JP"]} onChange={setLanguage} />
        <ModalField label={t("studio.title")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.title")} /></ModalField>
        <ModalField label={t("studio.hook")}><TextInput value={hook} onChange={setHook} placeholder={t("studio.hook")} /></ModalField>
        <ModalField label={t("studio.description")}><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={modalTextarea} /></ModalField>
        <ChoiceRow label={t("studio.roleSought")} defaultValue={recruit.role} options={COLLAB_ROLES} onChange={setRole} />
        <ChoiceRow label={t("studio.announcementStatus")} defaultValue={recruit.status} options={["Ouverte", "Brouillon"]} onChange={setStatus} />
        <button
          type="button"
          role="switch"
          aria-checked={remuneration}
          onClick={() => setRemuneration((value) => !value)}
          className="flex items-center justify-between rounded-[14px] border px-4 py-3 text-left"
          style={{
            borderColor: remuneration ? "rgba(57,255,136,0.45)" : "var(--border-default)",
            background: remuneration ? "rgba(57,255,136,0.12)" : "var(--input-bg)",
          }}
        >
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{t("studio.remuneration")}</span>
          <span className="relative h-6 w-11 rounded-full border border-[var(--border-default)] bg-[var(--elevated)]">
            <span
              className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
              style={{ left: remuneration ? 22 : 2, background: remuneration ? "var(--neon)" : "var(--text-secondary)" }}
            />
          </span>
        </button>
        <ChoiceRow label={t("studio.engagement")} defaultValue={recruit.commitment} options={["Long terme", "Ponctuel"]} onChange={setEngagement} />
      </div>
    </StudioModal>
  );
}

/* ----- Recrutement tab ----- */

function RecrutementTab({
  project,
  onAddRecruit,
  updateProject,
  onWorkflow,
}: {
  project: Project;
  onAddRecruit: () => void;
  updateProject?: (updater: (p: Project) => Project) => void;
  onWorkflow?: (message: string) => void;
}) {
  const { t } = useI18n();
  const recruit = project.recruits ?? [];
  const [detail, setDetail] = useState<RecruitAnnouncement | null>(null);
  const [editing, setEditing] = useState<RecruitAnnouncement | null>(null);
  const canManage = myLevel(project) !== "collaborateur";
  const denyManage = () => onWorkflow?.(`${t("studio.denyPrefix")} ${t("studio.denyManageAnnouncements")}`);
  const saveRecruit = async (id: string, patch: Partial<RecruitAnnouncement>) => {
    if (!canManage) return denyManage();
    const current = recruit.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    try {
      if (current.publicId) {
        await updateAnnouncement(current.publicId, {
          title: next.title,
          hook: next.hook,
          description: next.description,
          language: next.language,
          status_sought: next.role,
          remuneration: next.remunerated,
          engagement: next.commitment === "Ponctuel" ? "Ponctuel" : "Long terme",
        });
      }
    updateProject?.((p) => ({
      ...p,
      recruits: (p.recruits ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      updated: "À l'instant",
    }));
      setEditing(null);
      onWorkflow?.(t("studio.recruitUpdatedMsg"));
    } catch (error) {
      onWorkflow?.(error instanceof Error ? error.message : t("studio.recruitUpdateFailedMsg"));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-bold">{t("studio.recruitmentAnnouncements")}</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{t("studio.recruitmentDesc")}</p>
        </div>
        <PrimaryButton icon={Plus} onClick={onAddRecruit}>{t("studio.newRecruitAnnouncement")}</PrimaryButton>
      </div>
      {recruit.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><UserPlus className="h-5 w-5 text-[var(--neon)]" /></div>
          <h3 className="mt-4 font-display text-[18px] font-bold">{t("studio.noRecruitAnnouncementsTitle")}</h3>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t("studio.noRecruitAnnouncementsText")}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {recruit.map(r => (
          <AnnonceCard
            key={r.id}
            title={r.title}
            status={r.status}
            statusTone={r.status === "Ouverte" ? "neon" : "neutral"}
            description={r.description}
            metas={[
              { label: t("profile.role"), value: r.role },
              { label: t("studio.engagement"), value: r.commitment },
              { label: t("studio.remuneration"), value: r.compensation },
            ]}
            remunerated={r.remunerated}
            onView={() => setDetail(r)}
            onManage={() => canManage ? setEditing(r) : denyManage()}
          />
        ))}
      </div>
      {detail && (
        <RecruitDetailsModal
          item={projectAnnouncementFromRecruit(detail, {
            projectName: project.title,
            genre: project.genres[0],
            subgenres: project.subgenres,
            cover: project.coverDataUrl,
          })}
          hideApply
          onClose={() => setDetail(null)}
        />
      )}
      {editing && (
        <EditRecruitModal
          recruit={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { void saveRecruit(editing.id, patch); }}
        />
      )}
    </div>
  );
}

/* ----- Parrainage tab ----- */

function EditParrainageModal({ sponsorship, onClose, onSave }: { sponsorship: Sponsorship; onClose: () => void; onSave: (patch: Partial<Sponsorship>) => void }) {
  const { t } = useI18n();
  return (
    <ServiceFormModal
      open
      onClose={onClose}
      mode="project"
      title={t("studio.editSponsorshipModalTitle")}
      submitLabel={t("studio.save")}
      statusOptions={["Open", "Paused", "Draft", "Closed", "Archived"]}
      initial={{
        format: sponsorship.title,
        platforms: sponsorship.platform.split(", ").filter(Boolean),
        videoType: sponsorship.videoType,
        duration: sponsorship.duration,
        paymentMode: sponsorship.paymentMode,
        price: sponsorship.price,
        quantity: sponsorship.quantity,
        description: sponsorship.description,
        subscribersMin: sponsorship.subscribers || undefined,
        subscribersMax: sponsorship.subscribersMax,
        status: sponsorship.status,
      }}
      onSubmit={(values) => {
        onSave({
          title: values.format,
          description: values.description,
          platform: values.platforms.join(", ") || "Toutes plateformes",
          videoType: values.videoType,
          duration: values.duration,
          subscribers: values.subscribersMin ?? 0,
          subscribersMax: values.subscribersMax,
          price: values.price,
          paymentMode: values.paymentMode,
          quantity: values.quantity,
          status: (values.status as Sponsorship["status"]) ?? sponsorship.status,
        });
      }}
    />
  );
}

function ParrainageTab({
  project,
  onAddParrainage,
  updateProject,
  onWorkflow,
}: {
  project: Project;
  onAddParrainage: () => void;
  updateProject?: (updater: (p: Project) => Project) => void;
  onWorkflow?: (message: string) => void;
}) {
  const { t } = useI18n();
  const linkedSponsorships = useLinkedSponsorships().filter((item) => item.projectId === project.id);
  const [detail, setDetail] = useState<Sponsorship | null>(null);
  const [editing, setEditing] = useState<Sponsorship | null>(null);
  const canManage = myLevel(project) !== "collaborateur";
  const denyManage = () => onWorkflow?.(`${t("studio.denyPrefix")} ${t("studio.denyManageSponsorships")}`);
  const saveSponsorship = async (id: string, patch: Partial<Sponsorship>) => {
    if (!canManage) return denyManage();
    const current = project.sponsorships.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    try {
      if (current.publicId) {
        await updateSponsorOption(current.publicId, {
          format: next.title,
          platforms: next.platform.split(", ").filter(Boolean),
          videoType: next.videoType,
          duration: next.duration,
          paymentMode: next.paymentMode,
          price: next.price,
          quantity: next.quantity,
          description: next.description,
          subscribersMin: next.subscribers || undefined,
          subscribersMax: next.subscribersMax,
        });
      }
    updateProject?.((p) => ({
      ...p,
      sponsorships: p.sponsorships.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      updated: "À l'instant",
    }));
      setEditing(null);
      onWorkflow?.(t("studio.sponsorshipUpdatedMsg"));
    } catch (error) {
      onWorkflow?.(error instanceof Error ? error.message : t("studio.sponsorshipUpdateFailedMsg"));
    }
  };
  return (
    <div className="flex flex-col gap-8">
      {/* Annonces de parrainage — promotion du manga */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-bold">{t("studio.sponsorshipAnnouncements")}</h2>
            <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{t("studio.sponsorshipDesc")}</p>
          </div>
          <PrimaryButton icon={Megaphone} onClick={onAddParrainage}>{t("studio.newSponsorshipAnnouncement")}</PrimaryButton>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {project.sponsorships.map(s => (
            <div key={s.id} className="flex flex-col rounded-[22px] border border-[var(--border-default)] bg-[var(--elevated)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold leading-[22px]">{s.title}</h3>
                <StatusChip label={s.status} tone={s.status === "Open" ? "neon" : s.status === "Draft" ? "neutral" : "info"} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 tiny-meta text-[var(--text-muted)]">
                <span>{s.platform}</span><span>•</span><span>{s.videoType}</span><span>•</span><span>{s.duration}</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="font-display text-[20px] font-bold text-[var(--neon)]">{s.price} €</div>
                <div className="tiny-meta text-[var(--text-muted)]">{t("studio.qty")} {s.quantity} · {s.paymentMode}</div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <SecondaryButton className="!h-10 !px-3" onClick={() => setDetail(s)}>{t("profile.viewDetails")}</SecondaryButton>
                <PrimaryButton icon={Edit3} className="!h-10 !px-3" onClick={() => canManage ? setEditing(s) : denyManage()}>{t("profile.manage")}</PrimaryButton>
              </div>
            </div>
          ))}
          {project.sponsorships.length === 0 && (
            <div className="col-span-full rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><Megaphone className="h-5 w-5 text-[var(--neon)]" /></div>
              <h3 className="mt-4 font-display text-[18px] font-bold">{t("studio.noSponsorshipAnnouncementsTitle")}</h3>
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{t("studio.noSponsorshipAnnouncementsText")}</p>
            </div>
          )}
        </div>
      </section>

      {/* Parrainages du projet — réalisés / en cours */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[18px] font-bold">{t("studio.projectSponsorships")}</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{t("studio.projectSponsorshipsDesc")}</p>
        </div>
        {linkedSponsorships.length === 0 ? (
          <p className="text-[14px] text-[var(--text-muted)]">{t("studio.noSponsorshipsYet")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {linkedSponsorships.map((item) => {
              const status = SPONSORSHIP_STATUS_META[item.status];
              return (
                <div key={item.id} className="rounded-[18px] border border-[var(--border-default)] bg-[var(--elevated)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[16px] font-bold">{item.name}</h3>
                      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{item.creator}</p>
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: status.color, background: status.bg, border: `1px solid ${status.ring}` }}>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <strong className="text-[15px] text-[var(--neon)]">{formatSponsorshipMoney(item.totalPrice, item.currency)}</strong>
                    <Link to="/sponsorship-hub/$id" params={{ id: item.id }} className="rounded-[12px] border border-[var(--border-default)] px-3 py-2 text-[12px] font-bold text-[var(--text-primary)] hover:border-[var(--neon-border)]">
                      {t("studio.open")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {detail && (
        <DetailDialog
          announcement={announcementFromStudioSponsorship(detail, project.title, project.coverDataUrl ?? null)}
          hideActions
          onOpenChange={(o) => { if (!o) setDetail(null); }}
          onContact={() => {}}
        />
      )}
      {editing && (
        <EditParrainageModal
          sponsorship={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { void saveSponsorship(editing.id, patch); }}
        />
      )}
    </div>
  );
}

/* ----- Collaborateurs tab ----- */

/**
 * Un membre qui quitte son projet : s'il était chef, l'éditeur le plus ancien devient chef
 * (à défaut, le collaborateur le plus ancien) ; le projet reste vide si personne d'autre.
 */
function leaveProjectAction(
  _updateProject: (updater: (p: Project) => Project) => void,
  _onWorkflow: ((message: string) => void) | undefined,
  onLeft: (() => void) | undefined,
) {
  onLeft?.();
}

function CollaborateursTab({
  project,
  onWorkflow,
  updateProject,
  onLeaveProject,
}: {
  project: Project;
  onWorkflow?: (message: string) => void;
  updateProject?: (updater: (p: Project) => Project) => void;
  onLeaveProject?: () => void;
}) {
  const { t } = useI18n();
  const collabs = projectCollaborators(project);
  const me = myLevel(project);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const initials = (name: string) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const deny = (key: TranslationKey) => onWorkflow?.(`${t("studio.denyPrefix")} ${t(key)}`);

  const setCollabs = (updater: (list: Collaborator[]) => Collaborator[]) => {
    updateProject?.((p) => ({ ...p, collaborators: updater(projectCollaborators(p)), updated: "À l'instant" }));
  };

  const leave = () => {
    setMenuFor(null);
    if (!updateProject) return;
    leaveProjectAction(updateProject, onWorkflow, onLeaveProject);
  };

  /** Règles : chef → tout ; éditeur → promouvoir/exclure les collaborateurs seulement ; collaborateur → rien.
   *  Sur soi-même, la seule action possible est « Quitter le projet ». */
  const promote = async (target: Collaborator) => {
    setMenuFor(null);
    if (target.isCurrentUser) return deny("studio.denySelfAction");
    if (me === "collaborateur") return deny("studio.denyCannotPromote");
    if (target.level === "collaborateur") {
      try {
        await updateStudioProjectMember(project.id, target.id, "editeur");
        setCollabs((list) => list.map((c) => (c.id === target.id ? { ...c, level: "editeur" } : c)));
        onWorkflow?.(`${target.name} ${t("studio.nowEditorSuffix")}`);
      } catch (error) {
        onWorkflow?.(error instanceof Error ? error.message : t("profile.roleChangeFailed"));
      }
      return;
    }
    if (target.level === "editeur") {
      if (me !== "chef") return deny("studio.denyOnlyLeadPromoteEditor");
      // L'éditeur devient chef, l'ancien chef devient éditeur (un seul chef par projet).
      try {
        await transferStudioProjectOwnership(project.id, target.id);
        setCollabs((list) =>
          list.map((c) =>
            c.id === target.id ? { ...c, level: "chef" } : c.level === "chef" ? { ...c, level: "editeur" } : c,
          ),
        );
        onWorkflow?.(`${target.name} ${t("studio.nowLeadSuffix")}`);
      } catch (error) {
        onWorkflow?.(error instanceof Error ? error.message : t("studio.transferFailedMsg"));
      }
      return;
    }
    deny("studio.denyLeadCannotBePromoted");
  };

  const demote = async (target: Collaborator) => {
    setMenuFor(null);
    if (target.isCurrentUser) return deny("studio.denySelfAction");
    if (me !== "chef") return deny("studio.denyOnlyLeadDemote");
    if (target.level === "editeur") {
      try {
        await updateStudioProjectMember(project.id, target.id, "collaborateur");
        setCollabs((list) => list.map((c) => (c.id === target.id ? { ...c, level: "collaborateur" } : c)));
        onWorkflow?.(`${target.name} ${t("studio.nowCollaboratorSuffix")}`);
      } catch (error) {
        onWorkflow?.(error instanceof Error ? error.message : t("profile.roleChangeFailed"));
      }
      return;
    }
    deny("studio.denyCannotBeDemoted");
  };

  const exclude = async (target: Collaborator) => {
    setMenuFor(null);
    if (target.isCurrentUser) return deny("studio.denySelfAction");
    if (target.level === "chef") return deny("studio.denyLeadCannotBeExcluded");
    if (me === "collaborateur") return deny("studio.denyCannotExclude");
    if (me === "editeur" && target.level === "editeur") return deny("studio.denyEditorCannotExcludeEditor");
    try {
      await removeStudioProjectMember(project.id, target.id);
      setCollabs((list) => list.filter((c) => c.id !== target.id));
      onWorkflow?.(`${target.name} ${t("studio.excludedMemberSuffix")}`);
    } catch (error) {
      onWorkflow?.(error instanceof Error ? error.message : t("studio.memberRemoveFailedMsg"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-bold">{t("studio.tabCollaborators")}</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">
            {collabs.length} {t("studio.peopleOnProject")} · {t("studio.yourStatus")} : {t(LEVEL_LABEL_KEY[me])}
          </p>
        </div>
        <PrimaryButton icon={UserPlus} onClick={() => me === "collaborateur" ? deny("studio.denyCannotInvite") : setInviteOpen(true)}>{t("studio.inviteCollaborator")}</PrimaryButton>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collabs.map(c => (
          <div key={c.id} className="relative flex items-center gap-3 rounded-[18px] border border-[var(--border-default)] bg-[var(--elevated)] p-4 shadow-[var(--shadow-card)]">
            <Link
              to="/profile/$profileId"
              params={{ profileId: c.isCurrentUser ? "moi" : c.id }}
              className="flex min-w-0 flex-1 items-center gap-3"
              title={`${t("ideas.viewProfileOf")} ${c.name}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-gradient-to-br from-[#1a2960] to-[#0a1030] font-display text-[14px] font-bold">
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  initials(c.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{c.name}</div>
                <div className="truncate tiny-meta text-[var(--text-muted)]">{c.role}</div>
              </div>
            </Link>
            <StatusChip label={t(LEVEL_LABEL_KEY[c.level])} tone={c.level === "chef" ? "neon" : c.level === "editeur" ? "info" : "neutral"} />
            <IconButton ariaLabel={`${t("studio.actionsOnPrefix")} ${c.name}`} onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}>
              <MoreHorizontal className="h-4 w-4" />
            </IconButton>
            {menuFor === c.id && (
              <div
                className="absolute right-3 top-14 z-20 w-48 overflow-hidden rounded-[14px] border border-[var(--border-strong)] bg-[var(--panel)] py-1 shadow-[0_18px_44px_rgba(0,0,0,0.45)]"
              >
                {c.isCurrentUser ? (
                  <button className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--danger)] hover:bg-white/[0.05]" onClick={leave}>
                    {t("studio.leaveProject")}
                  </button>
                ) : (
                  <>
                    <button className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--text-primary)] hover:bg-white/[0.05]" onClick={() => void promote(c)}>
                      {t("studio.promote")}
                    </button>
                    <button className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--text-primary)] hover:bg-white/[0.05]" onClick={() => void demote(c)}>
                      {t("studio.demote")}
                    </button>
                    <button className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--danger)] hover:bg-white/[0.05]" onClick={() => void exclude(c)}>
                      {t("studio.exclude")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {inviteOpen && (
        <InviteCollaboratorModal
          projectId={project.id}
          existingRecipients={collabs.map((collaborator) => collaborator.name)}
          onClose={() => setInviteOpen(false)}
          onDone={(message) => {
            setInviteOpen(false);
            onWorkflow?.(message);
          }}
        />
      )}
    </div>
  );
}

function InviteCollaboratorModal({
  projectId,
  existingRecipients,
  onClose,
  onDone,
}: {
  projectId: string;
  existingRecipients: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useI18n();
  const [recipient, setRecipient] = useState("");
  const [role, setRole] = useState<string[]>(["Dessinateur"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!recipient.trim()) {
      setError(t("studio.emailOrPseudoRequired"));
      return;
    }
    if (existingRecipients.some((name) => name.toLocaleLowerCase("fr") === recipient.trim().toLocaleLowerCase("fr"))) {
      setError(t("studio.alreadyMember"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await sendProjectInvitationDb({
        projectId,
        recipient: recipient.trim(),
        role: role[0] || "Dessinateur",
        message: message.trim() || undefined,
      });
      onDone(`${t("studio.invitationSentTo")} ${recipient.trim()}. ${t("studio.invitationSentSuffix")}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("showcase.invitationFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudioModal
      title={t("studio.inviteCollaborator")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={UserPlus} onClick={() => { if (!saving) void submit(); }}>{saving ? t("profile.sending") : t("studio.sendInvitationBtn")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-5">
        <ModalField label={t("studio.emailOrUsername")}><TextInput value={recipient} onChange={setRecipient} placeholder={t("studio.emailOrUsernamePlaceholder")} /></ModalField>
        <ChoiceRow label={t("profile.role")} defaultValue="Dessinateur" options={COLLAB_ROLES} onChange={setRole} />
        <ModalField label={t("msg.message")}><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("studio.inviteMessagePlaceholder")} className={modalTextarea} /></ModalField>
        {error && <p className="text-[13px] font-semibold text-[var(--danger)]">{error}</p>}
      </div>
    </StudioModal>
  );
}

/* ----- Settings tab ----- */

/* ---------- Add modals ---------- */

function StudioModal({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-strong)] bg-[var(--panel)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-h-[85vh] sm:rounded-[24px] ${wide ? "max-w-[980px]" : "max-w-[640px]"}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
          <h3 className="font-display text-[18px] font-bold">{title}</h3>
          <IconButton ariaLabel={t("studio.close")} onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--elevated)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// One option row: title + all options shown at once as selectable chips (no dropdown).
function ChoiceRow({ label, options, multi = false, defaultValue, defaultValues, onChange }: { label: string; options: string[]; multi?: boolean; defaultValue?: string; defaultValues?: string[]; onChange?: (selected: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(defaultValues ?? (defaultValue ? [defaultValue] : []));
  const toggle = (o: string) =>
    setSel(prev => {
      const next = multi ? (prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]) : prev[0] === o ? [] : [o];
      onChange?.(next);
      return next;
    });
  return (
    <div>
      <div className="tiny-meta mb-2 text-[var(--text-muted)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => <Chip key={o} label={o} active={sel.includes(o)} onClick={() => toggle(o)} />)}
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  );
}

const modalTextarea = "min-h-[96px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]";

function AddChapterModal({ onClose, onAdd }: { onClose: () => void; onAdd: (chapter: Chapter) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [pageCount, setPageCount] = useState("12");
  const [error, setError] = useState("");

  const submit = () => {
    if (!title.trim()) {
      setError(t("studio.chapterTitleRequired"));
      return;
    }
    const count = Math.max(1, Math.min(60, Number(pageCount) || 12));
    onAdd({
      id: `ch-${Date.now()}`,
      number: 0, // renuméroté à l'affichage via l'index
      title: title.trim(),
      status: "Draft",
      objective: objective.trim() || t("studio.objectiveToDefine"),
      pages: makeEmptyPages(count),
      updated: "À l'instant",
    });
  };

  return (
    <StudioModal
      title={t("studio.addChapterTitle")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Plus} onClick={submit}>{t("studio.addChapterBtn")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <ModalField label={t("studio.chapterTitleLabel")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.chapterTitleLabel")} /></ModalField>
        <ModalField label={t("studio.objective")}><textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={t("studio.objective")} className={modalTextarea} /></ModalField>
        <ModalField label={t("studio.pageCount")}><TextInput value={pageCount} onChange={setPageCount} placeholder="12" /></ModalField>
        {error && <p className="text-[13px] font-semibold text-[var(--danger)]">{error}</p>}
      </div>
    </StudioModal>
  );
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (project: Project) => void }) {
  const { t, locale } = useI18n();
  // La langue du projet démarre sur la langue du site choisie par l'utilisateur.
  const defaultLang = locale === "fr" ? "FR" : "ENG";
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [language, setLanguage] = useState<string[]>([defaultLang]);
  const [genres, setGenres] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [productionNote, setProductionNote] = useState("");
  const [coverDataUrl, setCoverDataUrl] = useState<string | undefined>(undefined);
  const [coverError, setCoverError] = useState("");
  const [formError, setFormError] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const chooseCover = (file: File | undefined) => {
    if (!file) return;
    setCoverError("");
    void readImageFile(file)
      .then(setCoverDataUrl)
      .catch(() => setCoverError(t("studio.coverImportFailedShort")));
  };

  const submit = () => {
    if (!title.trim()) {
      setFormError(t("studio.projectTitleRequired"));
      return;
    }
    const project: Project = {
      id: `prj-${crypto.randomUUID()}`,
      title: title.trim(),
      synopsis: synopsis.trim() || t("profile.synopsisTodo"),
      status: "Draft",
      chaptersCount: 0,
      validatedPages: 0,
      totalPages: 0,
      updated: "À l'instant",
      genres,
      subgenres,
      language: language[0] ?? defaultLang,
      chapters: [],
      notes: productionNote.trim()
        ? [{
            id: `n-${Date.now()}`,
            title: "Note de production",
            preview: productionNote.trim().slice(0, 120),
            content: productionNote.trim(),
            category: "Task",
            priority: "Medium",
            status: "Open",
          }]
        : [],
      sponsorships: [],
      recruits: [],
      collaborators: defaultCollaborators(),
      coverDataUrl,
    };
    onCreate(project);
  };

  return (
    <StudioModal
      title={t("studio.createProjectTitle")}
      wide
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Plus} onClick={submit}>{t("profile.createProjectButton")}</PrimaryButton></>}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--input-bg)] transition-colors hover:border-[var(--neon-border)]"
          >
            {coverDataUrl ? (
              <img src={coverDataUrl} alt={t("studio.coverPreviewAlt")} className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-[var(--text-secondary)]"><Upload className="h-6 w-6" /><span className="text-[14px] font-bold">{t("studio.uploadCoverAria")}</span></span>
            )}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { chooseCover(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
          {coverError && <p className="mt-2 text-[13px] font-semibold text-[var(--danger)]">{coverError}</p>}
        </div>
        <div className="flex flex-col gap-5">
          <ModalField label={t("profile.projectName")}><TextInput value={title} onChange={setTitle} placeholder={t("profile.projectName")} /></ModalField>
          <ModalField label={t("studio.synopsis")}><textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder={t("profile.synopsis")} className={modalTextarea} /></ModalField>
          <ChoiceRow label={t("studio.projectLanguage")} defaultValue={defaultLang} options={["FR", "ENG", "ES", "IT", "JP"]} onChange={setLanguage} />
          <ChoiceRow multi label={t("profile.genreLabel")} options={["Shonen", "Seinen", "Shojo", "Josei"]} onChange={setGenres} />
          <ChoiceRow
            multi
            label={t("studio.subgenres")}
            options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
            onChange={setSubgenres}
          />
          <ModalField label={t("studio.productionNote")}><textarea value={productionNote} onChange={(e) => setProductionNote(e.target.value)} placeholder={t("studio.productionNotePlaceholder")} className={modalTextarea} /></ModalField>
          {formError && <p className="text-[13px] font-semibold text-[var(--danger)]">{formError}</p>}
        </div>
      </div>
    </StudioModal>
  );
}

function AddNoteModal({ onClose, defaultDate, onAdd }: { onClose: () => void; defaultDate?: string; onAdd: (note: Note) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [priority, setPriority] = useState<string[]>(["Medium"]);
  const [error, setError] = useState("");

  const submit = () => {
    if (!title.trim()) {
      setError(t("studio.noteTitleRequired"));
      return;
    }
    onAdd({
      id: `n-${Date.now()}`,
      title: title.trim(),
      preview: (content.trim() || title.trim()).slice(0, 120),
      content: content.trim(),
      category: "Other",
      date: date.trim() || undefined,
      priority: (priority[0] as Note["priority"]) || "Medium",
      status: "Open",
    });
  };

  return (
    <StudioModal
      title={t("studio.addNoteTitle")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Plus} onClick={submit}>{t("studio.addNoteBtn")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <ModalField label={t("studio.title")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.noteTitlePlaceholder")} /></ModalField>
        <ModalField label={t("studio.content")}><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("studio.noteContentPlaceholder")} className={modalTextarea} /></ModalField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label={t("studio.linkedDate")}>
            {/* Mini calendrier natif + saisie chiffrée, stylé selon le design du site. */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition-shadow focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] [color-scheme:dark]"
            />
          </ModalField>
          <ChoiceRow label={t("studio.priority")} defaultValue="Medium" options={["Low", "Medium", "High"]} onChange={setPriority} />
        </div>
        {error && <p className="text-[13px] font-semibold text-[var(--danger)]">{error}</p>}
      </div>
    </StudioModal>
  );
}

function AddParrainageModal({ onClose, onAdd }: { onClose: () => void; onAdd: (sponsorship: Sponsorship) => void }) {
  const { t } = useI18n();
  // Popup service unifié (le même que sur la page profil).
  return (
    <ServiceFormModal
      open
      onClose={onClose}
      mode="project"
      title={t("studio.newSponsorshipModalTitle")}
      onSubmit={(values) => {
        onAdd({
          id: `s-${Date.now()}`,
          title: values.format,
          status: "Open",
          description: values.description,
          created: "À l'instant",
          platform: values.platforms.join(", ") || "Toutes plateformes",
          videoType: values.videoType,
          duration: values.duration,
          subscribers: values.subscribersMin ?? 0,
          subscribersMax: values.subscribersMax,
          quantity: values.quantity,
          price: values.price,
          paymentMode: values.paymentMode,
        });
      }}
    />
  );
}

function AddRecruitModal({ onClose, onAdd }: { onClose: () => void; onAdd: (recruit: RecruitAnnouncement) => void }) {
  const { t } = useI18n();
  const [remuneration, setRemuneration] = useState(false);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<string[]>(["FR"]);
  const [role, setRole] = useState<string[]>(["Scénariste"]);
  const [engagement, setEngagement] = useState<string[]>(["Long terme"]);

  const submit = () => {
    onAdd({
      id: `r-${Date.now()}`,
      title: title.trim() || `Recherche ${role[0] || "Scénariste"}`,
      hook: hook.trim(),
      language: language[0] || "FR",
      role: role[0] || "Scénariste",
      status: "Ouverte",
      description: description.trim() || hook.trim() || title.trim() || "Annonce de recrutement.",
      commitment: engagement[0] || "Long terme",
      compensation: remuneration ? "Rémunéré" : "Sans rémunération",
      remunerated: remuneration,
      created: "À l'instant",
    });
  };

  return (
    <StudioModal
      title={t("studio.newRecruitModalTitle")}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>{t("studio.cancel")}</GhostButton><PrimaryButton icon={Plus} onClick={submit}>{t("studio.confirm")}</PrimaryButton></>}
    >
      <div className="flex flex-col gap-6">
        <ChoiceRow label={t("studio.language")} defaultValue="FR" options={["FR", "ENG", "ES", "IT", "JP"]} onChange={setLanguage} />
        <ModalField label={t("studio.title")}><TextInput value={title} onChange={setTitle} placeholder={t("studio.title")} /></ModalField>
        <ModalField label={t("studio.hook")}><TextInput value={hook} onChange={setHook} placeholder={t("studio.hook")} /></ModalField>
        <ModalField label={t("studio.description")}><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("studio.description")} className={modalTextarea} /></ModalField>
        <ChoiceRow label={t("studio.roleSought")} defaultValue="Scénariste" options={COLLAB_ROLES} onChange={setRole} />
        <button
          type="button"
          role="switch"
          aria-checked={remuneration}
          onClick={() => setRemuneration((value) => !value)}
          className="flex items-center justify-between rounded-[14px] border px-4 py-3 text-left"
          style={{
            borderColor: remuneration ? "rgba(57,255,136,0.45)" : "var(--border-default)",
            background: remuneration ? "rgba(57,255,136,0.12)" : "var(--input-bg)",
          }}
        >
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{t("studio.remuneration")}</span>
          <span className="relative h-6 w-11 rounded-full border border-[var(--border-default)] bg-[var(--elevated)]">
            <span
              className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
              style={{ left: remuneration ? 22 : 2, background: remuneration ? "var(--neon)" : "var(--text-secondary)" }}
            />
          </span>
        </button>
        <ChoiceRow label={t("studio.engagement")} defaultValue="Long terme" options={["Long terme", "Ponctuel"]} onChange={setEngagement} />
      </div>
    </StudioModal>
  );
}

function SettingsTab({
  project,
  updateProject,
  onDeleteProject,
  onWorkflow,
  onLeaveProject,
}: {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
  onDeleteProject: () => void;
  onWorkflow: (message: string) => void;
  onLeaveProject?: () => void;
}) {
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [synopsis, setSynopsis] = useState(project.synopsis);
  const [genres, setGenres] = useState<string[]>(project.genres);
  const [subgenres, setSubgenres] = useState<string[]>(project.subgenres ?? []);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const catalogVisible = project.catalogVisible ?? false;
  const level = myLevel(project);
  const canEdit = level !== "collaborateur";
  const denyEdit = () => onWorkflow(`${t("studio.denyPrefix")} ${t("studio.denyImagesOnly")}`);

  const saveEdits = () => {
    if (!canEdit) return denyEdit();
    if (!title.trim()) return;
    updateProject((p) => ({ ...p, title: title.trim(), synopsis: synopsis.trim(), genres, subgenres, updated: "À l'instant" }));
    setEditing(false);
    onWorkflow(t("studio.settingsSavedMsg"));
  };

  const onCoverChosen = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (!canEdit) return denyEdit();
    void readImageFile(file).then((coverDataUrl) => {
      updateProject((p) => ({ ...p, coverDataUrl, updated: "À l'instant" }));
      onWorkflow(t("studio.coverUpdatedMsg"));
    }).catch(() => onWorkflow(t("studio.coverImportFailedMsg")));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[18px] font-bold">{t("studio.project")}</h3>
            {editing ? (
              <div className="flex items-center gap-2">
                <GhostButton onClick={() => { setEditing(false); setTitle(project.title); setSynopsis(project.synopsis); setGenres(project.genres); setSubgenres(project.subgenres ?? []); }}>{t("studio.cancel")}</GhostButton>
                <PrimaryButton icon={Save} className="!h-10 !px-3" onClick={saveEdits}>{t("studio.save")}</PrimaryButton>
              </div>
            ) : (
              <SecondaryButton icon={Edit3} className="!h-10 !px-3" onClick={() => canEdit ? setEditing(true) : denyEdit()}>{t("studio.edit")}</SecondaryButton>
            )}
          </div>
          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.title")}</div>
                <TextInput value={title} onChange={setTitle} placeholder={t("profile.projectName")} />
              </div>
              <div>
                <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">{t("studio.synopsis")}</div>
                <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className={modalTextarea} />
              </div>
              <ChoiceRow multi label={t("profile.genreLabel")} options={["Shonen", "Seinen", "Shojo", "Josei"]} defaultValues={genres} onChange={setGenres} />
              <ChoiceRow
                multi
                label={t("studio.subgenres")}
                options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
                defaultValues={subgenres}
                onChange={setSubgenres}
              />
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border-default)]">
              {[
                { label: t("studio.title"), value: project.title },
                { label: t("studio.status"), value: project.status },
                { label: t("studio.genres"), value: project.genres.join(", ") || "—" },
                { label: t("studio.subgenres"), value: (project.subgenres ?? []).join(", ") || "—" },
                { label: t("studio.chapters"), value: String(project.chapters.length) },
              ].map(i => (
                <div key={i.label} className="flex items-center justify-between py-3">
                  <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{i.label}</span>
                  <span className="text-[14px] font-bold">{i.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
          <h3 className="font-display text-[18px] font-bold">{t("studio.coverHeading")}</h3>
          <div className="mt-3 flex items-center gap-4">
            {project.coverDataUrl ? (
              <img src={project.coverDataUrl} alt={t("studio.coverHeading")} className="aspect-[3/4] w-24 rounded-[12px] border border-[var(--border-default)] object-cover" />
            ) : (
              <CoverPlaceholder title={project.title} className="aspect-[3/4] w-24" />
            )}
            <div className="flex flex-col gap-2">
              <SecondaryButton icon={Upload} className="!h-10 !px-3" onClick={() => coverInputRef.current?.click()}>
                {project.coverDataUrl ? t("studio.replaceCover") : t("studio.uploadCoverBtn")}
              </SecondaryButton>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { onCoverChosen(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
          <h3 className="font-display text-[18px] font-bold">{t("studio.projectStatusHeading")}</h3>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {hasPublishedChapter(project)
              ? t("studio.catalogVisibilityDesc1")
              : t("studio.catalogVisibilityDesc2")}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={catalogVisible}
            disabled={!hasPublishedChapter(project) || project.status === "Finished"}
            onClick={() => {
              if (myLevel(project) !== "chef") {
                onWorkflow(`${t("studio.denyPrefix")} ${t("studio.denyOnlyLeadVisibility")}`);
                return;
              }
              updateProject((p) => ({ ...p, catalogVisible: !catalogVisible, updated: "À l'instant" }));
              onWorkflow(catalogVisible ? `${t("studio.hiddenFromCatalog")} (Paused).` : `${t("studio.visibleInCatalog")} (In progress).`);
            }}
            className="mt-4 flex w-full items-center justify-between rounded-[14px] border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: catalogVisible ? "rgba(57,255,136,0.45)" : "var(--border-default)",
              background: catalogVisible ? "rgba(57,255,136,0.12)" : "var(--input-bg)",
            }}
          >
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              {catalogVisible ? t("studio.visibleInCatalog") : t("studio.hiddenFromCatalog")}
            </span>
            <span className="relative h-6 w-11 rounded-full border border-[var(--border-default)] bg-[var(--elevated)]">
              <span
                className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
                style={{ left: catalogVisible ? 22 : 2, background: catalogVisible ? "var(--neon)" : "var(--text-secondary)" }}
              />
            </span>
          </button>

          {hasPublishedChapter(project) && (
            <div className="mt-3 flex items-center justify-between rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3">
              <div>
                <div className="text-[13px] font-bold text-[var(--text-primary)]">
                  {project.status === "Finished" ? t("studio.finishedTitle") : t("studio.markAsFinished")}
                </div>
                <div className="tiny-meta mt-0.5 text-[var(--text-muted)]">
                  {project.status === "Finished"
                    ? t("studio.finishedDesc1")
                    : t("studio.finishedDesc2")}
                </div>
              </div>
              {project.status === "Finished" ? (
                <SecondaryButton
                  className="!h-9 !px-3"
                  onClick={() => {
                    if (level !== "chef") {
                      onWorkflow(`${t("studio.denyPrefix")} ${t("studio.denyOnlyLeadResume")}`);
                      return;
                    }
                    updateProject((p) => ({ ...p, status: p.catalogVisible ? "In progress" : "Paused", updated: "À l'instant" }));
                    onWorkflow(t("studio.resume"));
                  }}
                >
                  {t("studio.resume")}
                </SecondaryButton>
              ) : (
                <PrimaryButton
                  className="!h-9 !px-3"
                  onClick={() => {
                    if (level !== "chef") {
                      onWorkflow(`${t("studio.denyPrefix")} ${t("studio.denyOnlyLeadFinish")}`);
                      return;
                    }
                    updateProject((p) => ({ ...p, status: "Finished", catalogVisible: true, updated: "À l'instant" }));
                    onWorkflow(t("studio.finishedTitle"));
                  }}
                >
                  {t("studio.finishedBtn")}
                </PrimaryButton>
              )}
            </div>
          )}
        </div>
        <div className="rounded-[22px] border border-[rgba(255,184,77,0.35)] bg-[rgba(255,184,77,0.05)] p-5">
          <h3 className="font-display text-[18px] font-bold text-[var(--warning)]">{t("studio.leaveProject")}</h3>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {confirmLeave
              ? myLevel(project) === "chef"
                ? t("studio.leaveConfirmChef")
                : t("studio.leaveConfirmOther")
              : t("studio.leaveDesc")}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {confirmLeave ? (
              <>
                <DangerButton icon={Undo2} onClick={() => leaveProjectAction(updateProject, onWorkflow, onLeaveProject)}>{t("studio.confirm")}</DangerButton>
                <GhostButton onClick={() => setConfirmLeave(false)}>{t("studio.cancel")}</GhostButton>
              </>
            ) : (
              <SecondaryButton icon={Undo2} onClick={() => setConfirmLeave(true)}>{t("studio.leaveProject")}</SecondaryButton>
            )}
          </div>
        </div>
        <div className="rounded-[22px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.05)] p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[var(--danger)]" /><h3 className="font-display text-[18px] font-bold text-[var(--danger)]">{t("studio.dangerZone")}</h3></div>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {confirmDelete
              ? t("studio.deleteConfirmText")
              : t("studio.deleteWarningText")}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {confirmDelete ? (
              <>
                <DangerButton icon={Trash2} onClick={onDeleteProject}>{t("studio.deletePermanently")}</DangerButton>
                <GhostButton onClick={() => setConfirmDelete(false)}>{t("studio.cancel")}</GhostButton>
              </>
            ) : (
              <DangerButton
                icon={Trash2}
                onClick={() => {
                  if (myLevel(project) !== "chef") {
                    onWorkflow(`${t("studio.denyPrefix")} ${t("studio.denyOnlyLeadDelete")}`);
                    return;
                  }
                  setConfirmDelete(true);
                }}
              >
                {t("studio.deleteProjectBtn")}
              </DangerButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- STATE 3: Chapter Workspace ---------- */

function ChapterWorkspace({
  project,
  chapter,
  onBack,
  onChapterChange,
  onSavePageNote,
  onWorkflow,
}: {
  project: Project;
  chapter: Chapter;
  onBack: () => void;
  onChapterChange: (updater: (c: Chapter) => Chapter) => void;
  onSavePageNote: (pageId: string, noteId: string | undefined, note: Omit<Note, "id" | "category" | "status">) => string;
  onWorkflow: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const [pageIndex, setPageIndex] = useState(0);
  const [pages, setPages] = useState<PageItem[]>(chapter.pages);
  const page = pages[pageIndex];
  const validatedCount = pages.filter(p => p.validatedCandidateId).length;
  const [selectedCand, setSelectedCand] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublishedState] = useState(chapter.status === "Published");
  const linkedNote = project.notes.find((note) => note.id === page?.noteRef);
  const [noteTitle, setNoteTitle] = useState(linkedNote?.title ?? "");
  const [noteContent, setNoteContent] = useState(linkedNote?.content ?? "");
  const [noteDate, setNoteDate] = useState(linkedNote?.date ?? "");
  const [notePriority, setNotePriority] = useState<Note["priority"]>(linkedNote?.priority ?? "Medium");
  const [mobileTab, setMobileTab] = useState<"page" | "notes">("page");

  // Persiste chaque modification de pages dans le projet (store IndexedDB).
  useEffect(() => {
    if (pages === chapter.pages) return;
    onChapterChange((c) => ({ ...c, pages, updated: "À l'instant" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  useEffect(() => {
    setSelectedCand(null);
    setNoteTitle(linkedNote?.title ?? "");
    setNoteContent(linkedNote?.content ?? "");
    setNoteDate(linkedNote?.date ?? "");
    setNotePriority(linkedNote?.priority ?? "Medium");
  }, [page?.id, linkedNote?.content, linkedNote?.date, linkedNote?.id, linkedNote?.priority, linkedNote?.title]);

  useEffect(() => {
    setPublishedState(chapter.status === "Published");
  }, [chapter.status]);

  useEffect(() => {
    setPages(chapter.pages);
    setPageIndex((current) => Math.min(current, Math.max(0, chapter.pages.length - 1)));
  }, [chapter.id, chapter.pages]);

  // Permissions par niveau : le collaborateur peut seulement AJOUTER des images.
  const level = myLevel(project);
  const [permNotice, setPermNotice] = useState<string | null>(null);
  const deny = (key: TranslationKey) => {
    setPermNotice(`${t("studio.denyPrefix")} ${t(key)}`);
    window.setTimeout(() => setPermNotice(null), 3200);
  };

  const setPublished = (value: boolean) => {
    if (level === "collaborateur") {
      deny("studio.denyCannotPublish");
      return;
    }
    if (value && pages.some((item) => !item.validatedCandidateId)) {
      deny("studio.denyAllPagesValidated");
      return;
    }
    setPublishedState(value);
    onChapterChange((c) => ({
      ...c,
      status: value ? "Published" : c.status === "Published" ? "In progress" : c.status,
      updated: "À l'instant",
    }));
  };

  const setPage = (updater: (p: PageItem) => PageItem) => {
    setPages(prev => prev.map((p, i) => i === pageIndex ? updater(p) : p));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCand = useRef<string | null>(null);

  const validateSelected = () => {
    if (!selectedCand) return;
    if (level === "collaborateur") {
      deny("studio.denyCannotValidateSelection");
      return;
    }
    const candidate = page.candidates.find((item) => item.id === selectedCand);
    if (!candidate?.image) {
      deny("studio.denySelectImageFirst");
      return;
    }
    setPage(p => ({
      ...p,
      validatedCandidateId: selectedCand,
      candidates: p.candidates.map(c => c.id === selectedCand ? { ...c, status: "Validated" } : (c.status === "Validated" ? { ...c, status: "Imported" } : c)),
    }));
    setSelectedCand(null);
  };

  const triggerImport = (candId: string) => {
    // Un collaborateur peut ajouter une image dans un emplacement vide, pas remplacer une image existante.
    if (level === "collaborateur") {
      const target = page.candidates.find((c) => c.id === candId);
      if (target?.image) {
        deny("studio.denyCannotReplace");
        return;
      }
    }
    pendingCand.current = candId;
    fileInputRef.current?.click();
  };

  const importInto = (candId: string) => triggerImport(candId);

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    const candId = pendingCand.current;
    event.target.value = "";
    pendingCand.current = null;
    if (files.length === 0 || !candId) return;
    void Promise.all(files.map(readImageFile)).then((images) => {
      setPage(p => ({
        ...p,
        candidates: [
          ...p.candidates.map(c => c.id === candId ? {
            ...c,
            status: (p.validatedCandidateId === candId ? "Validated" : "Imported") as CandidateStatus,
            image: images[0],
          } : c),
          ...images.slice(1).map((image) => ({ ...newCandidate(), status: "Imported" as CandidateStatus, image })),
        ],
      }));
      onWorkflow(`${images.length} image${images.length > 1 ? "s" : ""} ${t("studio.imagesImportedSuffix")}`);
    }).catch(() => deny("studio.denyImportFailed"));
  };

  const importFirstEmpty = () => {
    const existing = page.candidates.find(c => c.status === "Empty");
    if (existing) {
      triggerImport(existing.id);
      return;
    }
    const candidate = newCandidate();
    setPage((current) => ({ ...current, candidates: [...current.candidates, candidate] }));
    pendingCand.current = candidate.id;
    fileInputRef.current?.click();
  };

  const removeCand = (candId: string) => {
    if (level === "collaborateur") {
      deny("studio.denyCannotRemoveImage");
      return;
    }
    setPage(p => {
      const nextValidated = p.validatedCandidateId === candId ? null : p.validatedCandidateId;
      // Drop the tile entirely when several candidates exist; otherwise just clear it.
      if (p.candidates.length > 1) {
        return { ...p, validatedCandidateId: nextValidated, candidates: p.candidates.filter(c => c.id !== candId) };
      }
      return {
        ...p,
        validatedCandidateId: nextValidated,
        candidates: p.candidates.map(c => c.id === candId ? { ...c, status: "Empty", image: undefined } : c),
      };
    });
    if (selectedCand === candId) setSelectedCand(null);
  };

  const newCandidate = (): Candidate => ({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: "Empty" as CandidateStatus,
  });

  // New pages start with a single candidate.
  const makeCandidates = (): Candidate[] => [newCandidate()];

  const addCandidate = () => {
    setPage(p => ({ ...p, candidates: [...p.candidates, newCandidate()] }));
  };

  const addPage = () => {
    if (level === "collaborateur") return deny("studio.denyCannotAddPage");
    const nextIndex = pages.length;
    setPages(prev => {
      const num = prev.length ? Math.max(...prev.map(p => p.number)) + 1 : 1;
      return [...prev, { id: `p-new-${Date.now()}`, number: num, title: "", description: "", candidates: makeCandidates(), validatedCandidateId: null, updated: "Just now" }];
    });
    setPageIndex(nextIndex);
  };

  const duplicatePage = () => {
    if (level === "collaborateur") return deny("studio.denyCannotDuplicatePage");
    setPages(prev => {
      const src = prev[pageIndex];
      const num = Math.max(...prev.map(p => p.number)) + 1;
      const stamp = Date.now();
      const candidates = src.candidates.map((candidate, i) => ({ ...candidate, id: `${candidate.id}-dup-${stamp}-${i}` }));
      const validatedIndex = src.candidates.findIndex((candidate) => candidate.id === src.validatedCandidateId);
      const copy: PageItem = {
        ...src,
        id: `p-dup-${stamp}`,
        number: num,
        candidates,
        validatedCandidateId: validatedIndex >= 0 ? candidates[validatedIndex]?.id ?? null : null,
      };
      return [...prev.slice(0, pageIndex + 1), copy, ...prev.slice(pageIndex + 1)];
    });
    setPageIndex(i => i + 1);
  };

  const deletePage = () => {
    if (level === "collaborateur") return deny("studio.denyCannotDeletePage");
    if (pages.length <= 1) return;
    setPages(prev => prev.filter((_, i) => i !== pageIndex));
    setPageIndex(i => Math.max(0, Math.min(i, pages.length - 2)));
  };

  const pageStatus: { label: string; tone: "neutral" | "neon" | "warn" } = page.validatedCandidateId
    ? { label: t("studio.validated"), tone: "neon" }
    : page.candidates.some(c => c.status !== "Empty") ? { label: t("studio.needsSelection"), tone: "warn" } : { label: t("studio.noImage"), tone: "neutral" };
  const validatedCand = page.candidates.find(c => c.id === page.validatedCandidateId) ?? null;
  // The candidate shown large: the one currently selected, otherwise the validated one.
  const activeCand = (selectedCand ? page.candidates.find(c => c.id === selectedCand) : null) ?? validatedCand;

  const savePageNote = () => {
    if (level === "collaborateur") return deny("studio.denyEditNotes");
    if (!noteTitle.trim() && !noteContent.trim()) {
      deny("studio.denyNoteContentRequired");
      return;
    }
    const noteId = onSavePageNote(page.id, page.noteRef, {
      title: noteTitle.trim() || `${t("studio.notePagePrefix")} ${page.number}`,
      preview: (noteContent.trim() || noteTitle.trim()).slice(0, 120),
      content: noteContent.trim(),
      date: noteDate || undefined,
      priority: notePriority,
    });
    setPage((current) => ({ ...current, noteRef: noteId, updated: "À l'instant" }));
    onWorkflow(t("studio.pageNoteSavedMsg"));
  };

  return (
    <div className="flex flex-col gap-6">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChosen} />
      {permNotice && (
        <div className="rounded-[14px] border border-[rgba(255,184,77,0.4)] bg-[rgba(255,184,77,0.10)] px-4 py-3 text-[13px] font-bold text-[var(--warning)]">
          {permNotice}
        </div>
      )}
      <PageHeader
        back={{ label: `${t("studio.backToPrefix")} ${project.title}`, onClick: onBack }}
        eyebrow={<span className="tiny-meta text-[var(--neon)]">{t("studio.chapterWorkspace")}</span>}
        title={`${locale === "fr" ? "Chapitre" : "Chapter"} ${String(chapter.number).padStart(2, "0")} — ${chapter.title}`}
        description={chapter.objective}
        actions={
          <>
            <StatusChip label={published ? t("studio.publishedStatus") : t("studio.inProgressStatus")} tone={published ? "neon" : "warn"} />
            <SecondaryButton icon={Play} onClick={() => setPreviewOpen(true)}>{t("studio.previewChapter")}</SecondaryButton>
            <SecondaryButton icon={Upload} onClick={importFirstEmpty}>{t("studio.importImagesBtn")}</SecondaryButton>
            {published ? (
              <SecondaryButton icon={Undo2} onClick={() => setPublished(false)}>{t("studio.unpublish")}</SecondaryButton>
            ) : (
              <PrimaryButton icon={Rocket} onClick={() => setPublished(true)}>{t("studio.publish")}</PrimaryButton>
            )}
            <SecondaryButton icon={Save} onClick={() => onWorkflow(t("studio.autoSavedMsg"))}>{t("studio.saveChapter")}</SecondaryButton>
          </>
        }
      />

      {/* Chapter summary */}
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetaField label={t("studio.chapterTitleField")} value={chapter.title} />
          <MetaField label={t("studio.status")} value={chapter.status} />
          <MetaField label={t("studio.pages")} value={String(pages.length)} />
          <MetaField label={t("studio.validated")} value={`${validatedCount}/${pages.length}`} />
          <MetaField label={t("studio.lastEdited")} value={chapter.updated} />
        </div>
      </div>

      {/* Pagination */}
      <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <IconButton ariaLabel={t("studio.previousPage")} onClick={() => setPageIndex(i => Math.max(0, i - 1))}><ChevronLeft className="h-4 w-4" /></IconButton>
          <div className="scrollbar-thin flex flex-1 items-center gap-1.5 overflow-x-auto">
            {pages.map((p, i) => {
              const active = i === pageIndex;
              const done = !!p.validatedCandidateId;
              return (
                <button key={p.id} onClick={() => setPageIndex(i)} className={`inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-[10px] border px-2 text-[13px] font-bold transition-all ${active ? "border-[var(--neon-border)] bg-[var(--neon-soft)] text-[var(--neon)] shadow-[var(--shadow-neon)]" : "border-[var(--border-default)] bg-[var(--elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                  {p.number}
                  {done ? <Check className="h-3 w-3 text-[var(--neon)]" /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-disabled)]" />}
                </button>
              );
            })}
          </div>
          <IconButton ariaLabel={t("studio.nextPage")} onClick={() => setPageIndex(i => Math.min(pages.length - 1, i + 1))}><ChevronRight className="h-4 w-4" /></IconButton>
          <div className="ml-2 hidden items-center gap-1.5 md:flex">
            <SecondaryButton icon={Plus} className="!h-9 !px-3" onClick={addPage}>{t("studio.addPage")}</SecondaryButton>
            <IconButton ariaLabel={t("studio.duplicate")} onClick={duplicatePage}><Copy className="h-4 w-4" /></IconButton>
            <IconButton ariaLabel={t("studio.delete")} onClick={deletePage}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 md:hidden">
          <SecondaryButton icon={Plus} className="!h-9 !px-3" onClick={addPage}>{t("studio.pageDetails") === "Page details" ? "Add Page" : "Ajouter une page"}</SecondaryButton>
          <IconButton ariaLabel={t("studio.duplicate")} onClick={duplicatePage}><Copy className="h-4 w-4" /></IconButton>
          <IconButton ariaLabel={t("studio.delete")} onClick={deletePage}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      </div>

      <div className="md:hidden">
        <div className="cm-popup-tabs w-full" role="tablist" aria-label={t("studio.chapterWorkspace")}>
          <button type="button" role="tab" aria-selected={mobileTab === "page"} data-active={mobileTab === "page"} onClick={() => setMobileTab("page")} className="cm-popup-tab flex-1">
            Page
          </button>
          <button type="button" role="tab" aria-selected={mobileTab === "notes"} data-active={mobileTab === "notes"} onClick={() => setMobileTab("notes")} className="cm-popup-tab flex-1">
            {t("studio.tabNotes")}
          </button>
        </div>
      </div>

      {/* Main + inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className={`${mobileTab === "page" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
          {/* Selected page preview */}
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--stage)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="tiny-meta text-[var(--text-muted)]">{t("studio.selectedPageLabel")}</div>
                <h2 className="mt-1 font-display text-[20px] font-bold">Page {page.number}</h2>
              </div>
              <StatusChip label={pageStatus.label} tone={pageStatus.tone} />
            </div>
            <div
              className="mx-auto flex w-full items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-gradient-to-br from-[#0B1430] to-[#050B1D]"
              style={{ height: "min(72vh, 760px)" }}
            >
              {activeCand?.image ? (
                <img
                  src={activeCand.image}
                  alt={`Page ${page.number}`}
                  className="max-h-full max-w-full object-contain"
                  decoding="async"
                  fetchPriority="high"
                />
              ) : page.validatedCandidateId ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--neon-border)] bg-[var(--neon-soft)]"><Check className="h-6 w-6 text-[var(--neon)]" /></div>
                  <div className="font-display text-[18px] font-bold">{t("studio.validatedImageLabel")}</div>
                  <div className="tiny-meta text-[var(--text-muted)]">{t("studio.candidate")} {page.candidates.findIndex(c => c.id === page.validatedCandidateId) + 1}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--elevated)]"><FileImage className="h-6 w-6 text-[var(--text-muted)]" /></div>
                  <div className="text-[14px] font-bold text-[var(--text-primary)]">{t("studio.chooseCandidateHint")}</div>
                  <div className="text-[13px] text-[var(--text-secondary)]">{t("studio.importCandidatesHint")}</div>
                </div>
              )}
            </div>
          </div>

          {/* Candidates */}
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-[18px] font-bold">{t("studio.imageCandidates")}</h3>
              <div className="flex items-center gap-2">
                <SecondaryButton icon={Plus} className="!h-10 !px-3" onClick={addCandidate}>{t("studio.addCandidate")}</SecondaryButton>
                <PrimaryButton onClick={validateSelected} className={!selectedCand ? "opacity-50" : ""}>{t("studio.validateSelectedImage")}</PrimaryButton>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {page.candidates.map((c, idx) => {
                const validated = page.validatedCandidateId === c.id;
                const selected = selectedCand === c.id;
                const empty = c.status === "Empty";
                return (
                  <div key={c.id} className={`flex flex-col overflow-hidden rounded-[16px] border p-3 transition-all ${validated ? "border-[var(--neon-border)] shadow-[var(--shadow-neon)] bg-[var(--elevated)]" : selected ? "border-[var(--info)] bg-[var(--elevated)]" : empty ? "border-dashed border-[var(--border-strong)] bg-[var(--input-bg)]" : "border-[var(--border-default)] bg-[var(--elevated)]"}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="tiny-meta text-[var(--text-muted)]">{t("studio.candidate")} {idx + 1}</div>
                      {validated ? <StatusChip label={t("studio.validated")} tone="neon" />
                        : c.status === "Imported" ? <StatusChip label={t("studio.imported")} tone="info" />
                        : <StatusChip label={t("studio.empty")} tone="neutral" />}
                    </div>
                    <button
                      onClick={() => empty ? importInto(c.id) : setSelectedCand(c.id)}
                      className={`relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[12px] border transition-colors ${empty ? "border-dashed border-[var(--border-strong)] bg-[var(--input-bg)] hover:border-[var(--neon-border)]" : "border-[var(--border-default)] bg-gradient-to-br from-[#0E1736] to-[#050B1D]"}`}
                    >
                      {empty ? (
                        <div className="flex flex-col items-center gap-1.5 text-[var(--text-muted)]">
                          <Upload className="h-5 w-5" />
                          <span className="text-[13px] font-bold">{t("studio.importImage")}</span>
                        </div>
                      ) : c.image ? (
                        <>
                          <img
                            src={c.image}
                            alt={`${t("studio.candidate")} ${idx + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          {validated && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[var(--neon-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--neon)]"><Check className="h-3 w-3" /> {t("studio.final")}</span>}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <ImageIcon className="h-6 w-6 text-[var(--text-secondary)]" />
                          <span className="tiny-meta text-[var(--text-muted)]">{t("studio.imageCandidate")}</span>
                          {validated && <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--neon)]"><Check className="h-3.5 w-3.5" /> {t("studio.final")}</div>}
                        </div>
                      )}
                    </button>
                    <div className="mt-3 flex items-center gap-1.5">
                      {!empty && !validated && (
                        <button onClick={() => setSelectedCand(c.id)} className={`inline-flex h-9 flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition-colors ${selected ? "border-[var(--info)] bg-[rgba(117,167,255,0.10)] text-[var(--info)]" : "border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                          {selected ? t("studio.selected") : t("studio.select")}
                        </button>
                      )}
                      {empty && (
                        <button onClick={() => importInto(c.id)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--input-bg)] text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Upload className="h-3.5 w-3.5" />{t("studio.import")}</button>
                      )}
                      {!empty && (
                        <>
                          <IconButton ariaLabel={t("studio.replace")} onClick={() => triggerImport(c.id)}><RefreshCw className="h-4 w-4" /></IconButton>
                          <IconButton ariaLabel={t("studio.remove")} onClick={() => removeCand(c.id)}><Trash2 className="h-4 w-4" /></IconButton>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <aside className={`${mobileTab === "notes" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <h3 className="mb-3 font-display text-[18px] font-bold">{t("studio.pageDetails")}</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">{t("studio.pageNumber")}</label>
                <TextInput
                  value={String(page.number)}
                  onChange={(value) => {
                    if (level === "collaborateur") return;
                    const number = Number.parseInt(value, 10);
                    if (Number.isFinite(number) && number > 0) setPage((current) => ({ ...current, number, updated: "À l'instant" }));
                  }}
                />
              </div>
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">{t("studio.pageTitleOptional")}</label>
                <TextInput
                  value={page.title}
                  onChange={(title) => {
                    if (level !== "collaborateur") setPage((current) => ({ ...current, title, updated: "À l'instant" }));
                  }}
                  placeholder={t("studio.pageTitlePlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetaField label={t("studio.validation")} value={pageStatus.label} />
                <MetaField label={t("studio.candidates")} value={`${page.candidates.filter(c => c.status !== "Empty").length}/${page.candidates.length}`} />
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-[18px] font-bold">{t("studio.pageNote")}</h3>
              <IconButton ariaLabel={t("studio.saveNoteAria")} onClick={savePageNote}><Save className="h-4 w-4" /></IconButton>
            </div>
            <TextInput value={noteTitle} onChange={level === "collaborateur" ? undefined : setNoteTitle} placeholder={t("studio.noteTitleField")} className="mb-2" />
            <textarea value={noteContent} onChange={level === "collaborateur" ? undefined : (event) => setNoteContent(event.target.value)} placeholder={t("studio.notesToComplete")} className="min-h-[80px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--neon)]" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">{t("studio.linkedDate")}</label>
                <input
                  type="date"
                  value={noteDate}
                  onChange={(event) => { if (level !== "collaborateur") setNoteDate(event.target.value); }}
                  className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-3 text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--neon)] [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">{t("studio.priority")}</label>
                <div className="relative">
                  <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <select
                    value={notePriority}
                    onChange={(event) => { if (level !== "collaborateur") setNotePriority(event.target.value as Note["priority"]); }}
                    className="h-11 w-full appearance-none rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] pl-9 pr-3 text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--neon)]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!page.validatedCandidateId && pages.some(p => !p.validatedCandidateId) && (
            <div className="flex items-start gap-3 rounded-[16px] border border-[rgba(255,184,77,0.35)] bg-[rgba(255,184,77,0.08)] p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <div className="text-[13px] text-[var(--text-secondary)]"><span className="font-bold text-[var(--warning)]">{t("studio.previewWillShowWarnings")}</span> {t("studio.somePagesNoValidatedImage")}</div>
            </div>
          )}
        </aside>
      </div>

      {previewOpen && <ChapterPreviewModal chapter={chapter} pages={pages} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

/* ----- Chapter reader preview ----- */

function ChapterPreviewModal({ chapter, pages, onClose }: { chapter: Chapter; pages: PageItem[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [idx, setIdx] = useState(0);
  const page = pages[idx];
  const validated = page ? page.candidates.find(c => c.id === page.validatedCandidateId) ?? null : null;
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(pages.length - 1, i + 1));

  useEffect(() => {
    for (const targetIndex of [idx, idx + 1]) {
      const targetPage = pages[targetIndex];
      const source = targetPage?.candidates.find(
        (candidate) => candidate.id === targetPage.validatedCandidateId,
      )?.image;
      if (!source) continue;
      const preload = new Image();
      preload.decoding = "async";
      preload.src = source;
      void preload.decode().catch(() => undefined);
    }
  }, [idx, pages]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-0 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-[900px] flex-col overflow-hidden border border-[var(--border-strong)] bg-[var(--panel)] sm:h-auto sm:max-h-[92vh] sm:rounded-[24px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-default)] px-6 py-4">
          <div className="min-w-0">
            <div className="tiny-meta text-[var(--text-muted)]">{t("studio.previewChapter")}</div>
            <h3 className="truncate font-display text-[18px] font-bold">{locale === "fr" ? "Chapitre" : "Chapter"} {String(chapter.number).padStart(2, "0")} — {chapter.title}</h3>
          </div>
          <IconButton ariaLabel={t("studio.close")} onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[var(--stage)] p-4">
          {validated?.image ? (
            <img
              src={validated.image}
              alt={`Page ${page.number}`}
              className="max-h-full max-w-full object-contain"
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--elevated)]"><FileImage className="h-6 w-6 text-[var(--text-muted)]" /></div>
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Page {page?.number ?? idx + 1}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">{t("studio.noValidatedImageForPage")}</div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--elevated)] px-6 py-4">
          <SecondaryButton icon={ChevronLeft} className="!h-10 !px-3" onClick={prev}>{t("studio.previous")}</SecondaryButton>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Page {idx + 1} / {pages.length}</span>
          <SecondaryButton className="!h-10 !px-3" onClick={next}>{t("studio.next")}<ChevronRight className="h-4 w-4" /></SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------- Root page ---------- */

const MemoizedProjectWorkspace = memo(ProjectWorkspace);
const MemoizedChapterWorkspace = memo(ChapterWorkspace);

function CollabMangaPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const persistedProjectsRef = useRef(new Map<string, Project>());
  const { project: selectedProject, chapter: selectedChapter } = Route.useSearch();
  const navigate = Route.useNavigate();

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | null = null;
    const refresh = () =>
      void loadStudioProjects<unknown>()
        .then((saved) => {
          if (cancelled) return;
          const normalized = saved
            .map(normalizeStoredProject)
            .filter((project): project is Project => project !== null);
          persistedProjectsRef.current = new Map(
            normalized.map((project) => [project.id, project]),
          );
          setProjects(normalized);
          setLoaded(true);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setFeedback(
            error instanceof Error ? error.message : t("studio.projectSaveFailedMsg"),
          );
          setLoaded(true);
        });
    refresh();
    const unsubscribe = subscribeStudioProjects(() => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 350);
    });
    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [t]);

  useEffect(() => {
    if (!loaded) return;
    const changedProjects = projects.filter(
      (project) => persistedProjectsRef.current.get(project.id) !== project,
    );
    if (changedProjects.length === 0) return;
    const timer = window.setTimeout(() => {
      void saveStudioProjects(changedProjects)
        .then((saved) => {
          if (!saved) {
            setFeedback(t("studio.needLoginToSave"));
            return;
          }
          for (const project of changedProjects) {
            persistedProjectsRef.current.set(project.id, project);
          }
        })
        .catch((error: unknown) => {
          setFeedback(error instanceof Error ? error.message : t("studio.projectSaveFailedMsg"));
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [projects, loaded, t]);

  const project = useMemo(() => projects.find(p => p.id === selectedProject) ?? null, [projects, selectedProject]);
  const chapter = useMemo(() => project?.chapters.find(c => c.id === selectedChapter) ?? null, [project, selectedChapter]);

  useEffect(() => {
    if (!loaded) return;
    if (selectedProject && !project) {
      void navigate({ search: { project: undefined, chapter: undefined }, replace: true });
      return;
    }
    if (selectedChapter && !chapter) {
      void navigate({ search: { project: selectedProject, chapter: undefined }, replace: true });
    }
  }, [chapter, loaded, navigate, project, selectedChapter, selectedProject]);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(null), 3200);
  }, []);

  const addProject = async (project: Project) => {
    const next = [project, ...projects];
    try {
      const saved = await saveStudioProjects([project]);
      if (!saved) throw new Error(t("studio.needLoginToCreate"));
      persistedProjectsRef.current.set(project.id, project);
      setProjects(next);
      await navigate({ search: { project: project.id, chapter: undefined } });
      showFeedback(t("studio.projectCreatedMsg"));
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : t("studio.projectCreateFailedMsg"));
    }
  };

  const updateProject = useCallback((id: string, updater: (project: Project) => Project) => {
    setProjects((current) => current.map((p) => (p.id === id ? deriveProjectState(updater(p)) : p)));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await deleteStudioProject(id);
      setProjects((current) => current.filter((p) => p.id !== id));
      await navigate({ search: { project: undefined, chapter: undefined } });
      showFeedback(t("studio.projectDeletedMsg"));
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : t("studio.projectDeleteFailedMsg"));
    }
  }, [navigate, showFeedback, t]);

  const leaveProject = useCallback(async (id: string) => {
    try {
      await leaveStudioProject(id);
      setProjects((current) => current.filter((project) => project.id !== id));
      await navigate({ search: { project: undefined, chapter: undefined } });
      showFeedback(t("studio.leftProjectMsg"));
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : t("studio.leaveProjectFailedMsg"));
    }
  }, [navigate, showFeedback, t]);

  const backToProjects = useCallback(
    () => void navigate({ search: { project: undefined, chapter: undefined } }),
    [navigate],
  );
  const openProjectChapter = useCallback(
    (id: string) => {
      if (project) void navigate({ search: { project: project.id, chapter: id } });
    },
    [navigate, project],
  );
  const updateSelectedProject = useCallback(
    (updater: (current: Project) => Project) => {
      if (project) updateProject(project.id, updater);
    },
    [project, updateProject],
  );
  const deleteSelectedProject = useCallback(() => {
    if (project) void deleteProject(project.id);
  }, [deleteProject, project]);
  const leaveSelectedProject = useCallback(() => {
    if (project) void leaveProject(project.id);
  }, [leaveProject, project]);

  if (!loaded) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1440px] rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-10 text-center text-[14px] font-semibold text-[var(--text-secondary)]">
          {t("studio.loadingProjects")}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        {!project && <ProjectSelection projects={projects} onOpen={(id) => void navigate({ search: { project: id, chapter: undefined } })} onCreate={() => setCreateProjectOpen(true)} />}
        {project && !chapter && (
          <MemoizedProjectWorkspace
            project={project}
            onBack={backToProjects}
            onOpenChapter={openProjectChapter}
            onWorkflow={showFeedback}
            updateProject={updateSelectedProject}
            onDeleteProject={deleteSelectedProject}
            onLeaveProject={leaveSelectedProject}
          />
        )}
        {project && chapter && (
          <MemoizedChapterWorkspace
            project={project}
            chapter={chapter}
            onBack={() => void navigate({ search: { project: project.id, chapter: undefined } })}
            onWorkflow={showFeedback}
            onSavePageNote={(pageId, noteId, note) => {
              const id = noteId ?? `n-page-${Date.now()}`;
              updateProject(project.id, (current) => {
                const nextNote: Note = { ...note, id, category: "Other", status: "Open" };
                const notes = current.notes.some((item) => item.id === id)
                  ? current.notes.map((item) => item.id === id ? nextNote : item)
                  : [nextNote, ...current.notes];
                return {
                  ...current,
                  notes,
                  chapters: current.chapters.map((item) => item.id === chapter.id
                    ? { ...item, pages: item.pages.map((page) => page.id === pageId ? { ...page, noteRef: id } : page) }
                    : item),
                  updated: "À l'instant",
                };
              });
              return id;
            }}
            onChapterChange={(updater) =>
              updateProject(project.id, (p) => {
                const publishedBefore = hasPublishedChapter(p);
                const next = {
                  ...p,
                  chapters: p.chapters.map((c) => (c.id === chapter.id ? updater(c) : c)),
                };
                // Première publication d'un chapitre → le projet devient visible dans le catalogue.
                if (!publishedBefore && hasPublishedChapter(next)) next.catalogVisible = true;
                return next;
              })
            }
          />
        )}
        {createProjectOpen && (
          <CreateProjectModal
            onClose={() => setCreateProjectOpen(false)}
            onCreate={(newProject) => {
              void addProject(newProject);
              setCreateProjectOpen(false);
            }}
          />
        )}
        {feedback && (
          <div className="fixed bottom-6 right-6 z-[70] max-w-[420px] rounded-[16px] border border-[var(--neon-border)] bg-[var(--panel)] px-4 py-3 text-[14px] font-bold text-[var(--text-primary)] shadow-[0_18px_44px_rgba(0,0,0,0.45)]">
            {feedback}
          </div>
        )}
      </div>
    </main>
  );
}
