import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Search, LayoutGrid, List as ListIcon, MoreHorizontal,
  Edit3, Copy, Trash2, Check, Upload, Image as ImageIcon, Eye, Calendar as CalendarIcon,
  StickyNote, Megaphone, Settings as SettingsIcon, ChevronLeft, ChevronRight,
  BookOpen, Layers, AlertTriangle, FileImage, RefreshCw, Save, Play,
  Filter, ArrowUpDown, Bell, Target, Sparkles, Star, X,
  Users, UserPlus, Rocket, Undo2, Handshake,
} from "lucide-react";
import { addSponsorOption } from "@/lib/sponsorship-options";
import { ServiceFormModal } from "@/components/sponsorship/ServiceFormModal";
import {
  createAnnouncementWorkflow,
  createProjectNote,
  createProjectWorkflow,
  sendCollaborationInvitation,
} from "@/lib/user-workflows";
import { loadStudioProjects, saveStudioProjects } from "@/lib/studio-projects";

export const Route = createFileRoute("/_collab/studio")({
  component: CollabMangaPage,
});

/* ---------- Types & mock data ---------- */

type ProjectStatus = "Draft" | "In progress" | "Published" | "Archived";
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
  description: string; created: string;
  platform: string; videoType: string; duration: string;
  subscribers: number; quantity: number; price: string; paymentMode: string;
}
interface RecruitAnnouncement {
  id: string; role: string; status: "Ouverte" | "Brouillon";
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
  /** Couverture importée (data URL). */
  coverDataUrl?: string;
  /** Projet visible dans le catalogue public (masquable dans les paramètres). */
  catalogVisible?: boolean;
}

const COLLAB_ROLES = ["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"];

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
  return s === "Published" ? "neon" : s === "In progress" ? "info" : s === "Draft" ? "neutral" : "warn";
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
  const initials = title.split(" ").map(w => w[0]).slice(0, 2).join("");
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-gradient-to-br from-[#0E1736] via-[#0B1430] to-[#050B1D] ${className}`}>
      <div className="absolute inset-3 rounded-[10px] border border-[var(--border-default)]" />
      <div className="absolute inset-6 rounded-[8px] border border-dashed border-[var(--border-default)]" />
      <div className="relative z-10 flex flex-col items-center gap-2 px-3 text-center">
        <div className="font-display text-[28px] font-bold text-[var(--text-primary)]">{initials}</div>
        <div className="tiny-meta text-[var(--text-muted)]">Cover pending</div>
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
  const [q, setQ] = useState("");

  const filtered = projects.filter(p =>
    q === "" || p.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mes projets"
        description="Select a manga project, continue production, or create a new workspace."
        actions={<PrimaryButton icon={Plus} onClick={onCreate}>Create Project</PrimaryButton>}
      />

      {/* Control bar — search + sort only */}
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput icon={Search} value={q} onChange={setQ} placeholder="Search manga projects…" className="sm:flex-1" />
          <SecondaryButton icon={ArrowUpDown} className="!h-10 !px-3">Sort</SecondaryButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-12 text-center shadow-[var(--shadow-panel)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--elevated)]"><BookOpen className="h-6 w-6 text-[var(--neon)]" /></div>
          <h2 className="mt-5 font-display text-[20px] font-bold">No manga projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--text-secondary)]">Create your first manga workspace to start building chapters, pages, notes, and sponsorship announcements.</p>
          <div className="mt-6 flex justify-center"><PrimaryButton icon={Plus} onClick={onCreate}>Create Project</PrimaryButton></div>
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

const PROJECT_RATING: Record<string, number> = {};

const PROJECT_COLLABORATORS: Record<string, number> = {};

type Collaborator = { id: string; name: string; role: string; status: "Propriétaire" | "Actif" | "Invité" };

const PROJECT_COLLAB_LIST: Record<string, Collaborator[]> = {};

const defaultCollaborators = (): Collaborator[] => [
  { id: "co-owner", name: "Vous", role: "Scénariste", status: "Propriétaire" },
];

// Réalisés / en cours — parrainages liés au projet (alimentés quand des parrainages aboutissent).
type RealizedParrainage = { id: string; creator: string; platform: string; status: "Terminé" | "En cours" | "Planifié"; price: string };

const PROJECT_REALIZED_PARRAINAGES: Record<string, RealizedParrainage[]> = {};

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
  const rating = PROJECT_RATING[project.id] ?? 4;
  return (
    <div className="group flex flex-col overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--elevated)] p-4 shadow-[var(--shadow-card)] transition-all hover:border-[var(--neon-border)] hover:shadow-[var(--shadow-neon)]">
      <CoverPlaceholder title={project.title} className="aspect-[3/4] w-full" />
      <h3 className="mt-4 truncate text-[15px] font-bold">{project.title}</h3>
      <div className="mt-2"><StarRating value={rating} /></div>
      <div className="mt-4">
        <PrimaryButton onClick={onOpen} className="!h-10 w-full justify-center !px-3">Open</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- STATE 2: Project Workspace ---------- */

type ProjectTab = "Chapters" | "Notes" | "Calendar" | "Recrutement" | "Parrainage" | "Collaborateurs" | "Settings";

function ProjectWorkspace({
  project,
  onBack,
  onOpenChapter,
  onWorkflow,
  updateProject,
  onDeleteProject,
}: {
  project: Project;
  onBack: () => void;
  onOpenChapter: (id: string) => void;
  onWorkflow: (message: string) => void;
  updateProject: (updater: (p: Project) => Project) => void;
  onDeleteProject: () => void;
}) {
  const [tab, setTab] = useState<ProjectTab>("Chapters");
  const editing = false;
  const [modal, setModal] = useState<"chapter" | "note" | "parrainage" | "recruit" | null>(null);
  const [noteDate, setNoteDate] = useState<string | undefined>(undefined);
  const tabsRef = useRef<HTMLDivElement>(null);
  const openNote = (date?: string) => {
    setNoteDate(date);
    setModal("note");
  };
  const openCalendar = () => {
    setTab("Calendar");
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ label: "Back to Projects", onClick: onBack }}
        eyebrow={<span className="tiny-meta text-[var(--neon)]">Project workspace</span>}
        title={project.title}
        description={`${project.status} · ${project.chaptersCount} chapters · ${project.validatedPages}/${project.totalPages} pages validated`}
        actions={<PrimaryButton icon={Plus} onClick={() => setModal("chapter")}>Add Chapter</PrimaryButton>}
      />

      {/* Summary panel */}
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-6 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr_280px]">
          {/* Left: cover */}
          <div className="flex flex-col gap-3">
            <CoverPlaceholder title={project.title} className="aspect-[3/4] w-full max-w-[200px]" />
            <SecondaryButton icon={Upload} className="!h-10 !px-3">Replace Cover</SecondaryButton>
            <StatusChip label={project.status} tone={toneForProjectStatus(project.status)} />
          </div>

          {/* Center: info */}
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Project name</div>
              {editing ? (
                <TextInput value={project.title} placeholder="Project title" />
              ) : (
                <div className="font-display text-[20px] font-bold leading-7">{project.title}</div>
              )}
            </div>
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Synopsis</div>
              {editing ? (
                <textarea defaultValue={project.synopsis} className="min-h-[96px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]" />
              ) : (
                <p className="text-[14px] leading-[22px] text-[var(--text-secondary)]">{project.synopsis}</p>
              )}
            </div>
            <div>
              <div className="tiny-meta mb-2 text-[var(--text-muted)]">Genres</div>
              <div className="flex flex-wrap gap-2">
                {project.genres.map(g => <Chip key={g} label={g} active />)}
                {editing && <button className="rounded-full border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Plus className="mr-1 inline h-3.5 w-3.5" />Add genre</button>}
              </div>
            </div>
          </div>

          {/* Right: stats + quick actions */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Chapitres" value={project.chaptersCount} />
              <StatBox label="Parrainages" value={project.sponsorships.length} />
              <StatBox label="Collaborateurs" value={PROJECT_COLLABORATORS[project.id] ?? 1} />
              <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--elevated)] p-3">
                <div className="flex items-center gap-1 font-display text-[20px] font-bold leading-7 text-[var(--warning)]">
                  <Star className="h-4 w-4" fill="var(--warning)" />
                  {(PROJECT_RATING[project.id] ?? 4).toFixed(1)}
                </div>
                <div className="tiny-meta text-[var(--text-muted)]">Note</div>
              </div>
            </div>
            <div className="mt-1 grid gap-2">
              <SecondaryButton icon={Plus} className="!h-10 justify-start !px-3" onClick={() => setModal("chapter")}>Add Chapter</SecondaryButton>
              <SecondaryButton icon={StickyNote} className="!h-10 justify-start !px-3" onClick={() => setModal("note")}>Add Note</SecondaryButton>
              <SecondaryButton icon={Megaphone} className="!h-10 justify-start !px-3" onClick={() => setModal("parrainage")}>Add Sponsorship</SecondaryButton>
              <SecondaryButton icon={CalendarIcon} className="!h-10 justify-start !px-3" onClick={openCalendar}>Open Calendar</SecondaryButton>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div ref={tabsRef} className="flex flex-col gap-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={["Chapters", "Notes", "Calendar", "Recrutement", "Parrainage", "Collaborateurs", "Settings"]}
          icons={{ Recrutement: Megaphone, Parrainage: Handshake, Collaborateurs: Users }}
        />

        {tab === "Chapters" && <ChaptersTab project={project} onOpenChapter={onOpenChapter} onAdd={() => setModal("chapter")} updateProject={updateProject} onWorkflow={onWorkflow} />}
        {tab === "Notes" && <NotesTab project={project} onAdd={() => openNote()} />}
        {tab === "Calendar" && <CalendarTab project={project} onAddNote={openNote} />}
        {tab === "Recrutement" && <RecrutementTab project={project} onAddRecruit={() => setModal("recruit")} />}
        {tab === "Parrainage" && <ParrainageTab project={project} onAddParrainage={() => setModal("parrainage")} />}
        {tab === "Collaborateurs" && <CollaborateursTab project={project} onWorkflow={onWorkflow} />}
        {tab === "Settings" && <SettingsTab project={project} updateProject={updateProject} onDeleteProject={onDeleteProject} onWorkflow={onWorkflow} />}
      </div>

      {modal === "chapter" && (
        <AddChapterModal
          onClose={() => setModal(null)}
          onAdd={(chapter) => {
            updateProject((p) => ({
              ...p,
              chapters: [...p.chapters, { ...chapter, number: p.chapters.length + 1 }],
              chaptersCount: p.chapters.length + 1,
              totalPages: p.totalPages + chapter.pages.length,
              updated: "À l'instant",
            }));
            setModal(null);
            onWorkflow(`Chapitre « ${chapter.title} » ajouté.`);
          }}
        />
      )}
      {modal === "note" && (
        <AddNoteModal
          onClose={() => setModal(null)}
          defaultDate={noteDate}
          onAdd={(note) => {
            updateProject((p) => ({ ...p, notes: [note, ...p.notes], updated: "À l'instant" }));
            createProjectNote({ projectTitle: project.title, content: note.content || note.title });
            setModal(null);
            onWorkflow("Note ajoutée.");
          }}
        />
      )}
      {modal === "parrainage" && (
        <AddParrainageModal
          onClose={() => setModal(null)}
          onAdd={(sponsorship) => {
            updateProject((p) => ({ ...p, sponsorships: [sponsorship, ...p.sponsorships], updated: "À l'instant" }));
            // Annonce créée par un projet → visible dans « Trouver un projet ».
            addSponsorOption({
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
            });
            createAnnouncementWorkflow({
              title: sponsorship.title,
              category: "Parrainage",
              description: sponsorship.description,
              projectTitle: project.title,
            });
            setModal(null);
            onWorkflow("Annonce de parrainage publiée.");
          }}
        />
      )}
      {modal === "recruit" && (
        <AddRecruitModal
          onClose={() => setModal(null)}
          onAdd={(recruit) => {
            updateProject((p) => ({ ...p, recruits: [recruit, ...(p.recruits ?? [])], updated: "À l'instant" }));
            createAnnouncementWorkflow({
              title: `${recruit.role} — ${project.title}`,
              category: "Recrutement",
              description: recruit.description,
              projectTitle: project.title,
            });
            setModal(null);
            onWorkflow("Annonce de recrutement publiée.");
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

function Tabs<T extends string>({ value, onChange, items, icons }: { value: T; onChange: (v: T) => void; items: T[]; icons?: Record<string, React.ComponentType<{ className?: string }>> }) {
  return (
    <div className="scrollbar-thin flex gap-1 overflow-x-auto rounded-[16px] border border-[var(--border-default)] bg-[var(--panel)] p-1.5">
      {items.map(item => {
        const active = item === value;
        const Icon = icons?.[item];
        return (
          <button key={item} onClick={() => onChange(item)} className={`inline-flex items-center gap-2 h-[38px] shrink-0 rounded-[12px] px-4 text-[13px] font-bold transition-colors ${active ? "bg-[var(--neon-soft)] text-[var(--neon)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
            {Icon && <Icon className="h-4 w-4" />}
            {item}
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
  const [editChapter, setEditChapter] = useState<Chapter | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const duplicateChapter = (ch: Chapter) => {
    if (!updateProject) return;
    const stamp = Date.now();
    const copy: Chapter = {
      ...ch,
      id: `ch-${stamp}`,
      number: project.chapters.length + 1,
      title: `${ch.title} (copie)`,
      status: "Draft",
      updated: "À l'instant",
      pages: ch.pages.map((p, i) => ({
        ...p,
        id: `p-${stamp}-${i}`,
        candidates: p.candidates.map((c, j) => ({ ...c, id: `c-${stamp}-${i}-${j}` })),
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
    onWorkflow?.(`Chapitre « ${ch.title} » dupliqué.`);
  };

  const deleteChapter = (ch: Chapter) => {
    if (!updateProject) return;
    updateProject((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((c) => c.id !== ch.id),
      chaptersCount: Math.max(0, prev.chapters.length - 1),
      totalPages: Math.max(0, prev.totalPages - ch.pages.length),
      updated: "À l'instant",
    }));
    setConfirmDeleteId(null);
    onWorkflow?.(`Chapitre « ${ch.title} » supprimé.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[18px] font-bold">Chapters</h2>
        <div className="flex items-center gap-2">
          <TextInput icon={Search} placeholder="Find a chapter…" className="w-64" />
          <PrimaryButton icon={Plus} onClick={onAdd}>Add Chapter</PrimaryButton>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {project.chapters.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><Layers className="h-5 w-5 text-[var(--neon)]" /></div>
            <h3 className="mt-4 font-display text-[18px] font-bold">No chapters yet</h3>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Start production by adding the first chapter.</p>
            <div className="mt-4 flex justify-center"><PrimaryButton icon={Plus} onClick={onAdd}>Add Chapter</PrimaryButton></div>
          </div>
        )}
        {project.chapters.map(ch => {
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
                    <span>{ch.pages.length} pages</span><span>•</span><span className="text-[var(--neon)]">{validated} validated</span><span>•</span><span>Edited {ch.updated}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:flex-col md:items-stretch">
                  <PrimaryButton onClick={() => onOpenChapter(ch.id)} className="!h-10 !px-4">Open</PrimaryButton>
                  <div className="flex items-center gap-1.5">
                    <IconButton ariaLabel="Edit" onClick={() => setEditChapter(ch)}><Edit3 className="h-4 w-4" /></IconButton>
                    <IconButton ariaLabel="Duplicate" onClick={() => duplicateChapter(ch)}><Copy className="h-4 w-4" /></IconButton>
                    {confirmDeleteId === ch.id ? (
                      <button
                        onClick={() => deleteChapter(ch)}
                        className="rounded-[12px] border border-[rgba(255,95,126,0.45)] bg-[rgba(255,95,126,0.12)] px-2.5 py-2 text-[12px] font-bold text-[var(--danger)]"
                      >
                        Confirmer
                      </button>
                    ) : (
                      <IconButton ariaLabel="Delete" onClick={() => setConfirmDeleteId(ch.id)}><Trash2 className="h-4 w-4" /></IconButton>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
  const [title, setTitle] = useState(chapter.title);
  const [objective, setObjective] = useState(chapter.objective);
  const [status, setStatus] = useState<string[]>([chapter.status]);
  return (
    <StudioModal
      title="Modifier le chapitre"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton icon={Save} onClick={() => title.trim() && onSave({ title: title.trim(), objective: objective.trim(), status: (status[0] as ChapterStatus) || chapter.status })}>
            Enregistrer
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ModalField label="Titre du chapitre"><TextInput value={title} onChange={setTitle} placeholder="Titre" /></ModalField>
        <ModalField label="Objectif"><textarea value={objective} onChange={(e) => setObjective(e.target.value)} className={modalTextarea} /></ModalField>
        <ChoiceRow label="Statut" defaultValue={chapter.status} options={["Draft", "In progress", "Ready for review", "Published"]} onChange={setStatus} />
      </div>
    </StudioModal>
  );
}

/* ----- Notes tab ----- */

function NotesTab({ project, onAdd }: { project: Project; onAdd: () => void }) {
  const [selected, setSelected] = useState<string | null>(project.notes[0]?.id ?? null);
  const note = project.notes.find(n => n.id === selected) ?? null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold">Notes</h2>
          <PrimaryButton icon={Plus} className="!h-9 !px-3" onClick={onAdd}>New</PrimaryButton>
        </div>
        <TextInput icon={Search} placeholder="Search notes…" className="mb-3" />
        <div className="flex flex-col gap-2">
          {project.notes.map(n => (
            <button key={n.id} onClick={() => setSelected(n.id)} className={`rounded-[14px] border p-3 text-left transition-colors ${selected === n.id ? "border-[var(--neon-border)] bg-[var(--neon-soft)]" : "border-[var(--border-default)] bg-[var(--elevated)] hover:border-[var(--border-strong)]"}`}>
              <div className="truncate text-[14px] font-bold">{n.title}</div>
              <p className="mt-1 line-clamp-2 text-[13px] text-[var(--text-secondary)]">{n.preview}</p>
              <div className="mt-2 flex items-center gap-3 tiny-meta text-[var(--text-muted)]">
                {n.date ? <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{n.date}</span> : <span>Date to define</span>}
                <span>•</span>
                <span className={n.priority === "High" ? "text-[var(--warning)]" : ""}>{n.priority}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-6 shadow-[var(--shadow-panel)]">
        {note ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="tiny-meta text-[var(--text-muted)]">Note</div>
                <h3 className="mt-1 font-display text-[20px] font-bold">{note.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <SecondaryButton icon={Edit3} className="!h-10 !px-3">Edit</SecondaryButton>
                <DangerButton icon={Trash2}>Delete</DangerButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetaField label="Linked date" value={note.date ?? "Date to define"} />
              <MetaField label="Priority" value={note.priority} />
            </div>
            <div>
              <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Content</div>
              <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] leading-[22px] text-[var(--text-secondary)]">
                {note.preview} Notes to complete.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-[14px] text-[var(--text-muted)]">Select a note or create a new one.</div>
        )}
      </div>
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
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date(2026, 6, 1); // July 2026
  const shown = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const monthName = shown.toLocaleString("fr-FR", { month: "long", year: "numeric" });
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
            <IconButton ariaLabel="Mois précédent" onClick={() => setMonthOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></IconButton>
            <IconButton ariaLabel="Mois suivant" onClick={() => setMonthOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></IconButton>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">Aujourd'hui</button>
            )}
          </div>
          <span className="tiny-meta text-[var(--text-muted)]">Clique le + pour ajouter, une note pour la consulter</span>
        </div>
        <div className="grid grid-cols-7 gap-1 tiny-meta text-[var(--text-muted)]">
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => <div key={d} className="p-2">{d}</div>)}
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
                    aria-label={`Ajouter une note le ${dateStr(day)}`}
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
                ← Upcoming
              </button>
            </div>
            <div className="rounded-[14px] border border-[var(--neon-border)] bg-[var(--elevated)] p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-bold text-[var(--text-primary)]">{selectedNote.title}</span>
                <StatusChip label={selectedNote.priority} tone={selectedNote.priority === "High" ? "warn" : "info"} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 tiny-meta text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{selectedNote.date ?? "Sans date"}</span>
                <span>{selectedNote.category}</span>
                <span>{selectedNote.status}</span>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">
                {selectedNote.content || selectedNote.preview || "Aucun contenu."}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold">Upcoming</h2>
              <IconButton ariaLabel="Notifications"><Bell className="h-4 w-4" /></IconButton>
            </div>
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
            {events.length === 0 && <p className="text-[14px] text-[var(--text-muted)]">No deadlines yet.</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ----- Sponsorship tab ----- */

function AnnonceCard({
  title, status, statusTone, description, metas, remunerated = false,
}: {
  title: string;
  status: string;
  statusTone: "neutral" | "neon" | "warn" | "danger" | "info";
  description: string;
  metas: { label: string; value: string }[];
  remunerated?: boolean;
}) {
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
        <SecondaryButton className="!h-10 !px-3">View Details</SecondaryButton>
        <PrimaryButton icon={Edit3} className="!h-10 !px-3">Manage</PrimaryButton>
      </div>
    </div>
  );
}

/* ----- Recrutement tab ----- */

function RecrutementTab({ project, onAddRecruit }: { project: Project; onAddRecruit: () => void }) {
  const recruit = project.recruits ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-bold">Annonces de recrutement</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">Attirez de nouveaux collaborateurs pour rejoindre votre projet.</p>
        </div>
        <PrimaryButton icon={Plus} onClick={onAddRecruit}>Nouvelle annonce de recrutement</PrimaryButton>
      </div>
      {recruit.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><UserPlus className="h-5 w-5 text-[var(--neon)]" /></div>
          <h3 className="mt-4 font-display text-[18px] font-bold">Aucune annonce de recrutement</h3>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Publiez une annonce pour attirer des collaborateurs sur ce projet.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {recruit.map(r => (
          <AnnonceCard
            key={r.id}
            title={r.role}
            status={r.status}
            statusTone={r.status === "Ouverte" ? "neon" : "neutral"}
            description={r.description}
            metas={[
              { label: "Engagement", value: r.commitment },
              { label: "Rémunération", value: r.compensation },
              { label: "Créée", value: r.created },
            ]}
            remunerated={r.remunerated}
          />
        ))}
      </div>
    </div>
  );
}

/* ----- Parrainage tab ----- */

function ParrainageDetailModal({ s, onClose }: { s: Sponsorship; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: "Type de vidéo", value: s.videoType },
    { label: "Durée de vidéo", value: s.duration },
    { label: "Plateforme", value: s.platform },
    { label: "Abonnés min.", value: String(s.subscribers) },
    { label: "Quantité", value: String(s.quantity) },
    { label: "Prix", value: `${s.price} €` },
    { label: "Mode de paiement", value: s.paymentMode },
    { label: "Statut", value: s.status },
  ];
  return (
    <StudioModal
      title={s.title}
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Fermer</GhostButton><PrimaryButton icon={Edit3} onClick={onClose}>Modifier</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map(r => <MetaField key={r.label} label={r.label} value={r.value} />)}
        </div>
        <div>
          <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Description</div>
          <div className="rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] leading-[22px] text-[var(--text-secondary)]">{s.description || "—"}</div>
        </div>
      </div>
    </StudioModal>
  );
}

function ParrainageTab({ project, onAddParrainage }: { project: Project; onAddParrainage: () => void }) {
  const [detail, setDetail] = useState<Sponsorship | null>(null);
  const realized = PROJECT_REALIZED_PARRAINAGES[project.id] ?? [];
  return (
    <div className="flex flex-col gap-8">
      {/* Annonces de parrainage — promotion du manga */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-bold">Annonces de parrainage</h2>
            <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">Faites la promotion de votre manga auprès de créateurs de contenu.</p>
          </div>
          <PrimaryButton icon={Megaphone} onClick={onAddParrainage}>Nouvelle annonce de parrainage</PrimaryButton>
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
                <div className="tiny-meta text-[var(--text-muted)]">Qté {s.quantity} · {s.paymentMode}</div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <SecondaryButton className="!h-10 !px-3" onClick={() => setDetail(s)}>Voir détails</SecondaryButton>
                <PrimaryButton icon={Edit3} className="!h-10 !px-3">Gérer</PrimaryButton>
              </div>
            </div>
          ))}
          {project.sponsorships.length === 0 && (
            <div className="col-span-full rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--elevated)]"><Megaphone className="h-5 w-5 text-[var(--neon)]" /></div>
              <h3 className="mt-4 font-display text-[18px] font-bold">Aucune annonce de parrainage</h3>
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Publiez une annonce de parrainage pour faire la promotion de votre manga.</p>
            </div>
          )}
        </div>
      </section>

      {/* Parrainages du projet — réalisés / en cours */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[18px] font-bold">Parrainages du projet</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">Parrainages réalisés ou en cours liés à ce projet.</p>
        </div>
        {realized.length === 0 ? (
          <p className="text-[14px] text-[var(--text-muted)]">Aucun parrainage pour l'instant.</p>
        ) : (
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-2 shadow-[var(--shadow-panel)]">
            {realized.map((r, i) => (
              <div key={r.id} className={`flex flex-wrap items-center gap-4 rounded-[16px] p-4 ${i > 0 ? "border-t border-[var(--border-default)]" : ""}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--elevated)]"><Megaphone className="h-4 w-4 text-[var(--neon)]" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{r.creator}</div>
                  <div className="tiny-meta text-[var(--text-muted)]">{r.platform}</div>
                </div>
                <div className="text-[14px] font-bold text-[var(--neon)]">{r.price}</div>
                <StatusChip label={r.status} tone={r.status === "Terminé" ? "neon" : r.status === "En cours" ? "info" : "neutral"} />
                <SecondaryButton className="!h-9 !px-3">Ouvrir</SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </section>

      {detail && <ParrainageDetailModal s={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ----- Collaborateurs tab ----- */

function CollaborateursTab({ project, onWorkflow }: { project: Project; onWorkflow?: (message: string) => void }) {
  const collabs = PROJECT_COLLAB_LIST[project.id] ?? defaultCollaborators();
  const [inviteOpen, setInviteOpen] = useState(false);
  const initials = (name: string) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[18px] font-bold">Collaborateurs</h2>
          <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{collabs.length} personne{collabs.length > 1 ? "s" : ""} sur ce projet.</p>
        </div>
        <PrimaryButton icon={UserPlus} onClick={() => setInviteOpen(true)}>Inviter un collaborateur</PrimaryButton>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collabs.map(c => (
          <div key={c.id} className="flex items-center gap-3 rounded-[18px] border border-[var(--border-default)] bg-[var(--elevated)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-gradient-to-br from-[#1a2960] to-[#0a1030] font-display text-[14px] font-bold">{initials(c.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold">{c.name}</div>
              <div className="truncate tiny-meta text-[var(--text-muted)]">{c.role}</div>
            </div>
            <StatusChip label={c.status} tone={c.status === "Propriétaire" ? "neon" : c.status === "Invité" ? "neutral" : "info"} />
          </div>
        ))}
      </div>
      {inviteOpen && (
        <InviteCollaboratorModal
          projectTitle={project.title}
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
  projectTitle,
  onClose,
  onDone,
}: {
  projectTitle: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [role, setRole] = useState<string[]>(["Dessinateur"]);
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!recipient.trim()) return;
    sendCollaborationInvitation({
      recipient: recipient.trim(),
      projectTitle,
      role: role[0] || "Dessinateur",
      message: message.trim() || undefined,
    });
    onDone(`Invitation envoyée à ${recipient.trim()}.`);
  };

  return (
    <StudioModal
      title="Inviter un collaborateur"
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Annuler</GhostButton><PrimaryButton icon={UserPlus} onClick={submit}>Envoyer l'invitation</PrimaryButton></>}
    >
      <div className="flex flex-col gap-5">
        <ModalField label="Email ou pseudo"><TextInput value={recipient} onChange={setRecipient} placeholder="collaborateur@email.com ou @username" /></ModalField>
        <ChoiceRow label="Rôle" defaultValue="Dessinateur" options={COLLAB_ROLES} onChange={setRole} />
        <ChoiceRow label="Accès au projet" defaultValue="Collaborateur" options={["Collaborateur", "Lecture seule"]} />
        <ModalField label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Expliquez le rôle attendu, le rythme et les prochaines étapes." className={modalTextarea} /></ModalField>
      </div>
    </StudioModal>
  );
}

/* ----- Settings tab ----- */

/* ---------- Add modals ---------- */

function StudioModal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--border-strong)] bg-[var(--panel)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-h-[85vh] sm:rounded-[24px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
          <h3 className="font-display text-[18px] font-bold">{title}</h3>
          <IconButton ariaLabel="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
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
function ChoiceRow({ label, options, multi = false, defaultValue, onChange }: { label: string; options: string[]; multi?: boolean; defaultValue?: string; onChange?: (selected: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(defaultValue ? [defaultValue] : []);
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
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [pageCount, setPageCount] = useState("12");

  const submit = () => {
    if (!title.trim()) return;
    const count = Math.max(1, Math.min(60, Number(pageCount) || 12));
    onAdd({
      id: `ch-${Date.now()}`,
      number: 0, // renuméroté à l'affichage via l'index
      title: title.trim(),
      status: "Draft",
      objective: objective.trim() || "Objectif à définir.",
      pages: makeEmptyPages(count),
      updated: "À l'instant",
    });
  };

  return (
    <StudioModal
      title="Ajouter un chapitre"
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Annuler</GhostButton><PrimaryButton icon={Plus} onClick={submit}>Ajouter le chapitre</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <ModalField label="Titre du chapitre"><TextInput value={title} onChange={setTitle} placeholder="Titre du chapitre" /></ModalField>
        <ModalField label="Objectif"><textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objectif du chapitre" className={modalTextarea} /></ModalField>
        <ModalField label="Nombre de pages"><TextInput value={pageCount} onChange={setPageCount} placeholder="12" /></ModalField>
      </div>
    </StudioModal>
  );
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (project: Project) => void }) {
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(["Draft"]);
  const [productionNote, setProductionNote] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    const project: Project = {
      id: `prj-${Date.now()}`,
      title: title.trim(),
      synopsis: synopsis.trim() || "Synopsis à compléter.",
      status: (status[0] as ProjectStatus) || "Draft",
      chaptersCount: 0,
      validatedPages: 0,
      totalPages: 0,
      updated: "À l'instant",
      genres,
      subgenres,
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
    };
    createProjectWorkflow({ title: project.title, synopsis: project.synopsis, genres: project.genres });
    onCreate(project);
  };

  return (
    <StudioModal
      title="Créer un projet"
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Annuler</GhostButton><PrimaryButton icon={Plus} onClick={submit}>Créer le projet</PrimaryButton></>}
    >
      <div className="flex flex-col gap-5">
        <ModalField label="Titre du projet"><TextInput value={title} onChange={setTitle} placeholder="Nom du manga" /></ModalField>
        <ModalField label="Synopsis"><textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="Résumé court du projet, ton, objectif principal." className={modalTextarea} /></ModalField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChoiceRow multi label="Genre" options={["Shonen", "Seinen", "Shojo", "Josei"]} onChange={setGenres} />
          <ChoiceRow label="Statut" defaultValue="Draft" options={["Draft", "In progress", "Published"]} onChange={setStatus} />
        </div>
        <ChoiceRow
          multi
          label="Sous-genres"
          options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
          onChange={setSubgenres}
        />
        <ModalField label="Note de production"><textarea value={productionNote} onChange={(e) => setProductionNote(e.target.value)} placeholder="Indiquez ce dont l'équipe aura besoin pour démarrer." className={modalTextarea} /></ModalField>
      </div>
    </StudioModal>
  );
}

function AddNoteModal({ onClose, defaultDate, onAdd }: { onClose: () => void; defaultDate?: string; onAdd: (note: Note) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [priority, setPriority] = useState<string[]>(["Medium"]);

  const submit = () => {
    if (!title.trim()) return;
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
      title="Ajouter une note"
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Annuler</GhostButton><PrimaryButton icon={Plus} onClick={submit}>Ajouter la note</PrimaryButton></>}
    >
      <div className="flex flex-col gap-4">
        <ModalField label="Titre"><TextInput value={title} onChange={setTitle} placeholder="Titre de la note" /></ModalField>
        <ModalField label="Contenu"><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu de la note…" className={modalTextarea} /></ModalField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModalField label="Date liée">
            {/* Mini calendrier natif + saisie chiffrée, stylé selon le design du site. */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition-shadow focus:border-[var(--neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] [color-scheme:dark]"
            />
          </ModalField>
          <ChoiceRow label="Priorité" defaultValue="Medium" options={["Low", "Medium", "High"]} onChange={setPriority} />
        </div>
      </div>
    </StudioModal>
  );
}

function AddParrainageModal({ onClose, onAdd }: { onClose: () => void; onAdd: (sponsorship: Sponsorship) => void }) {
  // Popup service unifié (le même que sur la page profil).
  return (
    <ServiceFormModal
      open
      onClose={onClose}
      title="Nouvelle annonce de parrainage"
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
          subscribers: 0,
          quantity: values.quantity,
          price: values.price,
          paymentMode: values.paymentMode,
        });
      }}
    />
  );
}

function AddRecruitModal({ onClose, onAdd }: { onClose: () => void; onAdd: (recruit: RecruitAnnouncement) => void }) {
  const [remuneration, setRemuneration] = useState(false);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<string[]>(["Scénariste"]);
  const [engagement, setEngagement] = useState<string[]>(["Long terme"]);

  const submit = () => {
    onAdd({
      id: `r-${Date.now()}`,
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
      title="Nouvelle annonce de recrutement"
      onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Annuler</GhostButton><PrimaryButton icon={Plus} onClick={submit}>Confirmer</PrimaryButton></>}
    >
      <div className="flex flex-col gap-6">
        <ChoiceRow label="Langage" defaultValue="FR" options={["FR", "ENG"]} />
        <ModalField label="Titre"><TextInput value={title} onChange={setTitle} placeholder="Titre" /></ModalField>
        <ModalField label="Accroche"><TextInput value={hook} onChange={setHook} placeholder="Accroche" /></ModalField>
        <ModalField label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={modalTextarea} /></ModalField>
        <ChoiceRow label="Statut recherché" defaultValue="Scénariste" options={COLLAB_ROLES} onChange={setRole} />
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
          <span className="text-[13px] font-bold text-[var(--text-primary)]">Rémunération</span>
          <span className="relative h-6 w-11 rounded-full border border-[var(--border-default)] bg-[var(--elevated)]">
            <span
              className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
              style={{ left: remuneration ? 22 : 2, background: remuneration ? "var(--neon)" : "var(--text-secondary)" }}
            />
          </span>
        </button>
        <ChoiceRow label="Engagement" defaultValue="Long terme" options={["Long terme", "Ponctuel"]} onChange={setEngagement} />
        <div>
          <div className="mb-3 font-display text-[15px] font-bold">Type de projet favori</div>
          <div className="flex flex-col gap-4">
            <ChoiceRow multi label="Genre" options={["Shonen", "Seinen", "Shojo", "Josei"]} />
            <ChoiceRow multi label="Sous-genre" options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]} />
          </div>
        </div>
      </div>
    </StudioModal>
  );
}

function SettingsTab({
  project,
  updateProject,
  onDeleteProject,
  onWorkflow,
}: {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
  onDeleteProject: () => void;
  onWorkflow: (message: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [synopsis, setSynopsis] = useState(project.synopsis);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const catalogVisible = project.catalogVisible ?? false;

  const saveEdits = () => {
    if (!title.trim()) return;
    updateProject((p) => ({ ...p, title: title.trim(), synopsis: synopsis.trim(), updated: "À l'instant" }));
    setEditing(false);
    onWorkflow("Paramètres du projet enregistrés.");
  };

  const onCoverChosen = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateProject((p) => ({ ...p, coverDataUrl: String(reader.result), updated: "À l'instant" }));
      onWorkflow("Couverture mise à jour.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[18px] font-bold">Projet</h3>
            {editing ? (
              <div className="flex items-center gap-2">
                <GhostButton onClick={() => { setEditing(false); setTitle(project.title); setSynopsis(project.synopsis); }}>Annuler</GhostButton>
                <PrimaryButton icon={Save} className="!h-10 !px-3" onClick={saveEdits}>Enregistrer</PrimaryButton>
              </div>
            ) : (
              <SecondaryButton icon={Edit3} className="!h-10 !px-3" onClick={() => setEditing(true)}>Modifier</SecondaryButton>
            )}
          </div>
          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Titre</div>
                <TextInput value={title} onChange={setTitle} placeholder="Titre du projet" />
              </div>
              <div>
                <div className="tiny-meta mb-1.5 text-[var(--text-muted)]">Synopsis</div>
                <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} className={modalTextarea} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border-default)]">
              {[
                { label: "Titre", value: project.title },
                { label: "Statut", value: project.status },
                { label: "Genres", value: project.genres.join(", ") || "—" },
                { label: "Chapitres", value: String(project.chapters.length) },
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
          <h3 className="font-display text-[18px] font-bold">Couverture</h3>
          <div className="mt-3 flex items-center gap-4">
            {project.coverDataUrl ? (
              <img src={project.coverDataUrl} alt="Couverture" className="aspect-[3/4] w-24 rounded-[12px] border border-[var(--border-default)] object-cover" />
            ) : (
              <CoverPlaceholder title={project.title} className="aspect-[3/4] w-24" />
            )}
            <div className="flex flex-col gap-2">
              <SecondaryButton icon={Upload} className="!h-10 !px-3" onClick={() => coverInputRef.current?.click()}>
                {project.coverDataUrl ? "Remplacer la couverture" : "Uploader une couverture"}
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
          <h3 className="font-display text-[18px] font-bold">Statut du projet</h3>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Contrôle la visibilité du projet dans le catalogue public.</p>
          <button
            type="button"
            role="switch"
            aria-checked={catalogVisible}
            onClick={() => {
              updateProject((p) => ({ ...p, catalogVisible: !catalogVisible, updated: "À l'instant" }));
              onWorkflow(catalogVisible ? "Projet masqué du catalogue." : "Projet visible dans le catalogue.");
            }}
            className="mt-4 flex w-full items-center justify-between rounded-[14px] border px-4 py-3 text-left"
            style={{
              borderColor: catalogVisible ? "rgba(57,255,136,0.45)" : "var(--border-default)",
              background: catalogVisible ? "rgba(57,255,136,0.12)" : "var(--input-bg)",
            }}
          >
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              {catalogVisible ? "Visible dans le catalogue" : "Masqué du catalogue"}
            </span>
            <span className="relative h-6 w-11 rounded-full border border-[var(--border-default)] bg-[var(--elevated)]">
              <span
                className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
                style={{ left: catalogVisible ? 22 : 2, background: catalogVisible ? "var(--neon)" : "var(--text-secondary)" }}
              />
            </span>
          </button>
        </div>
        <div className="rounded-[22px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.05)] p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[var(--danger)]" /><h3 className="font-display text-[18px] font-bold text-[var(--danger)]">Danger zone</h3></div>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {confirmDelete
              ? "Confirme la suppression : tous les chapitres, pages et notes seront définitivement perdus."
              : "Deleting the project removes all chapters, pages and notes permanently."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {confirmDelete ? (
              <>
                <DangerButton icon={Trash2} onClick={onDeleteProject}>Supprimer définitivement</DangerButton>
                <GhostButton onClick={() => setConfirmDelete(false)}>Annuler</GhostButton>
              </>
            ) : (
              <DangerButton icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete Project</DangerButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ title, items, action }: { title: string; items: { label: string; value: string }[]; action?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[18px] font-bold">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col divide-y divide-[var(--border-default)]">
        {items.map(i => (
          <div key={i.label} className="flex items-center justify-between py-3">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{i.label}</span>
            <span className="text-[14px] font-bold">{i.value}</span>
          </div>
        ))}
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
}: {
  project: Project;
  chapter: Chapter;
  onBack: () => void;
  onChapterChange: (updater: (c: Chapter) => Chapter) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pages, setPages] = useState<PageItem[]>(chapter.pages);
  const page = pages[pageIndex];
  const validatedCount = pages.filter(p => p.validatedCandidateId).length;
  const [selectedCand, setSelectedCand] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublishedState] = useState(chapter.status === "Published");

  // Persiste chaque modification de pages dans le projet (store IndexedDB).
  useEffect(() => {
    if (pages === chapter.pages) return;
    onChapterChange((c) => ({ ...c, pages, updated: "À l'instant" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const setPublished = (value: boolean) => {
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
    setPage(p => ({
      ...p,
      validatedCandidateId: selectedCand,
      candidates: p.candidates.map(c => c.id === selectedCand ? { ...c, status: "Validated" } : (c.status === "Validated" ? { ...c, status: "Imported" } : c)),
    }));
    setSelectedCand(null);
  };

  const triggerImport = (candId: string) => {
    pendingCand.current = candId;
    fileInputRef.current?.click();
  };

  const importInto = (candId: string) => triggerImport(candId);

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const candId = pendingCand.current;
    event.target.value = "";
    pendingCand.current = null;
    if (!file || !candId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPage(p => ({
        ...p,
        candidates: p.candidates.map(c => c.id === candId ? { ...c, status: "Imported", image: url } : c),
      }));
    };
    reader.readAsDataURL(file);
  };

  const importFirstEmpty = () => {
    const target = page.candidates.find(c => c.status === "Empty") ?? page.candidates[0];
    if (target) triggerImport(target.id);
  };

  const removeCand = (candId: string) => {
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
    const nextIndex = pages.length;
    setPages(prev => {
      const num = prev.length ? Math.max(...prev.map(p => p.number)) + 1 : 1;
      return [...prev, { id: `p-new-${Date.now()}`, number: num, title: "", description: "", candidates: makeCandidates(), validatedCandidateId: null, updated: "Just now" }];
    });
    setPageIndex(nextIndex);
  };

  const duplicatePage = () => {
    setPages(prev => {
      const src = prev[pageIndex];
      const num = Math.max(...prev.map(p => p.number)) + 1;
      const stamp = Date.now();
      const copy: PageItem = {
        ...src,
        id: `p-dup-${stamp}`,
        number: num,
        candidates: src.candidates.map((c, i) => ({ ...c, id: `${c.id}-dup-${stamp}-${i}` })),
      };
      return [...prev.slice(0, pageIndex + 1), copy, ...prev.slice(pageIndex + 1)];
    });
    setPageIndex(i => i + 1);
  };

  const deletePage = () => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter((_, i) => i !== pageIndex));
    setPageIndex(i => Math.max(0, Math.min(i, pages.length - 2)));
  };

  const pageStatus: { label: string; tone: "neutral" | "neon" | "warn" } = page.validatedCandidateId
    ? { label: "Validated", tone: "neon" }
    : page.candidates.some(c => c.status !== "Empty") ? { label: "Needs selection", tone: "warn" } : { label: "No image", tone: "neutral" };
  const validatedCand = page.candidates.find(c => c.id === page.validatedCandidateId) ?? null;
  // The candidate shown large: the one currently selected, otherwise the validated one.
  const activeCand = (selectedCand ? page.candidates.find(c => c.id === selectedCand) : null) ?? validatedCand;

  return (
    <div className="flex flex-col gap-6">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
      <PageHeader
        back={{ label: `Back to ${project.title}`, onClick: onBack }}
        eyebrow={<span className="tiny-meta text-[var(--neon)]">Chapter workspace</span>}
        title={`Chapter ${String(chapter.number).padStart(2, "0")} — ${chapter.title}`}
        description={chapter.objective}
        actions={
          <>
            <StatusChip label={published ? "Published" : "In progress"} tone={published ? "neon" : "warn"} />
            <SecondaryButton icon={Play} onClick={() => setPreviewOpen(true)}>Preview Chapter</SecondaryButton>
            <SecondaryButton icon={Upload} onClick={importFirstEmpty}>Import Images</SecondaryButton>
            {published ? (
              <SecondaryButton icon={Undo2} onClick={() => setPublished(false)}>Annuler la publication</SecondaryButton>
            ) : (
              <PrimaryButton icon={Rocket} onClick={() => setPublished(true)}>Publier le chapitre</PrimaryButton>
            )}
            <SecondaryButton icon={Save}>Save Chapter</SecondaryButton>
          </>
        }
      />

      {/* Chapter summary */}
      <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetaField label="Chapter title" value={chapter.title} />
          <MetaField label="Status" value={chapter.status} />
          <MetaField label="Pages" value={String(pages.length)} />
          <MetaField label="Validated" value={`${validatedCount}/${pages.length}`} />
          <MetaField label="Last edited" value={chapter.updated} />
        </div>
      </div>

      {/* Pagination */}
      <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <IconButton ariaLabel="Previous page" onClick={() => setPageIndex(i => Math.max(0, i - 1))}><ChevronLeft className="h-4 w-4" /></IconButton>
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
          <IconButton ariaLabel="Next page" onClick={() => setPageIndex(i => Math.min(pages.length - 1, i + 1))}><ChevronRight className="h-4 w-4" /></IconButton>
          <div className="ml-2 hidden items-center gap-1.5 md:flex">
            <SecondaryButton icon={Plus} className="!h-9 !px-3" onClick={addPage}>Add Page</SecondaryButton>
            <IconButton ariaLabel="Duplicate page" onClick={duplicatePage}><Copy className="h-4 w-4" /></IconButton>
            <IconButton ariaLabel="Delete page" onClick={deletePage}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        </div>
      </div>

      {/* Main + inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* Selected page preview */}
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--stage)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="tiny-meta text-[var(--text-muted)]">Selected page</div>
                <h2 className="mt-1 font-display text-[20px] font-bold">Page {page.number}</h2>
              </div>
              <StatusChip label={pageStatus.label} tone={pageStatus.tone} />
            </div>
            <div
              className="mx-auto flex w-full items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-gradient-to-br from-[#0B1430] to-[#050B1D]"
              style={{ height: "min(72vh, 760px)" }}
            >
              {activeCand?.image ? (
                <img src={activeCand.image} alt={`Page ${page.number}`} className="max-h-full max-w-full object-contain" />
              ) : page.validatedCandidateId ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--neon-border)] bg-[var(--neon-soft)]"><Check className="h-6 w-6 text-[var(--neon)]" /></div>
                  <div className="font-display text-[18px] font-bold">Validated image</div>
                  <div className="tiny-meta text-[var(--text-muted)]">Candidate {page.candidates.findIndex(c => c.id === page.validatedCandidateId) + 1}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--elevated)]"><FileImage className="h-6 w-6 text-[var(--text-muted)]" /></div>
                  <div className="text-[14px] font-bold text-[var(--text-primary)]">Choose one image candidate to validate this page.</div>
                  <div className="text-[13px] text-[var(--text-secondary)]">Import as many candidates as you like, then select and validate the final image.</div>
                </div>
              )}
            </div>
          </div>

          {/* Candidates */}
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-[18px] font-bold">Image candidates</h3>
              <div className="flex items-center gap-2">
                <SecondaryButton icon={Plus} className="!h-10 !px-3" onClick={addCandidate}>Add candidate</SecondaryButton>
                <PrimaryButton onClick={validateSelected} className={!selectedCand ? "opacity-50" : ""}>Validate Selected Image</PrimaryButton>
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
                      <div className="tiny-meta text-[var(--text-muted)]">Candidate {idx + 1}</div>
                      {validated ? <StatusChip label="Validated" tone="neon" />
                        : c.status === "Imported" ? <StatusChip label="Imported" tone="info" />
                        : <StatusChip label="Empty" tone="neutral" />}
                    </div>
                    <button
                      onClick={() => empty ? importInto(c.id) : setSelectedCand(c.id)}
                      className={`relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[12px] border transition-colors ${empty ? "border-dashed border-[var(--border-strong)] bg-[var(--input-bg)] hover:border-[var(--neon-border)]" : "border-[var(--border-default)] bg-gradient-to-br from-[#0E1736] to-[#050B1D]"}`}
                    >
                      {empty ? (
                        <div className="flex flex-col items-center gap-1.5 text-[var(--text-muted)]">
                          <Upload className="h-5 w-5" />
                          <span className="text-[13px] font-bold">Import image</span>
                        </div>
                      ) : c.image ? (
                        <>
                          <img src={c.image} alt={`Candidate ${idx + 1}`} className="h-full w-full object-cover" />
                          {validated && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[var(--neon-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--neon)]"><Check className="h-3 w-3" /> Final</span>}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <ImageIcon className="h-6 w-6 text-[var(--text-secondary)]" />
                          <span className="tiny-meta text-[var(--text-muted)]">Image candidate</span>
                          {validated && <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--neon)]"><Check className="h-3.5 w-3.5" /> Final</div>}
                        </div>
                      )}
                    </button>
                    <div className="mt-3 flex items-center gap-1.5">
                      {!empty && !validated && (
                        <button onClick={() => setSelectedCand(c.id)} className={`inline-flex h-9 flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition-colors ${selected ? "border-[var(--info)] bg-[rgba(117,167,255,0.10)] text-[var(--info)]" : "border-[var(--border-default)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                          {selected ? "Selected" : "Select"}
                        </button>
                      )}
                      {empty && (
                        <button onClick={() => importInto(c.id)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-[var(--input-bg)] text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Upload className="h-3.5 w-3.5" />Import</button>
                      )}
                      {!empty && (
                        <>
                          <IconButton ariaLabel="Replace" onClick={() => triggerImport(c.id)}><RefreshCw className="h-4 w-4" /></IconButton>
                          <IconButton ariaLabel="Remove" onClick={() => removeCand(c.id)}><Trash2 className="h-4 w-4" /></IconButton>
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
        <aside className="flex flex-col gap-4">
          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <h3 className="mb-3 font-display text-[18px] font-bold">Page details</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">Page number</label>
                <TextInput value={String(page.number)} />
              </div>
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">Page title (optional)</label>
                <TextInput placeholder="Page title" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetaField label="Validation" value={pageStatus.label} />
                <MetaField label="Candidates" value={`${page.candidates.filter(c => c.status !== "Empty").length}/${page.candidates.length}`} />
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-[18px] font-bold">Page note</h3>
              <IconButton ariaLabel="Add note"><Plus className="h-4 w-4" /></IconButton>
            </div>
            <TextInput placeholder="Note title" className="mb-2" />
            <textarea placeholder="Notes to complete." className="min-h-[80px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] p-4 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--neon)]" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">Linked date</label>
                <div className="inline-flex h-11 w-full items-center gap-2 rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-secondary)]"><CalendarIcon className="h-4 w-4" />Date to define</div>
              </div>
              <div>
                <label className="tiny-meta mb-1.5 block text-[var(--text-muted)]">Priority</label>
                <div className="inline-flex h-11 w-full items-center gap-2 rounded-[14px] border border-[var(--border-default)] bg-[var(--input-bg)] px-4 text-[14px] text-[var(--text-secondary)]"><Target className="h-4 w-4" />Medium</div>
              </div>
            </div>
          </div>

          {!page.validatedCandidateId && pages.some(p => !p.validatedCandidateId) && (
            <div className="flex items-start gap-3 rounded-[16px] border border-[rgba(255,184,77,0.35)] bg-[rgba(255,184,77,0.08)] p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <div className="text-[13px] text-[var(--text-secondary)]"><span className="font-bold text-[var(--warning)]">Preview will show warnings.</span> Some pages don't have a validated image yet.</div>
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
  const [idx, setIdx] = useState(0);
  const page = pages[idx];
  const validated = page ? page.candidates.find(c => c.id === page.validatedCandidateId) ?? null : null;
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(pages.length - 1, i + 1));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-0 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-[900px] flex-col overflow-hidden border border-[var(--border-strong)] bg-[var(--panel)] sm:h-auto sm:max-h-[92vh] sm:rounded-[24px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-default)] px-6 py-4">
          <div className="min-w-0">
            <div className="tiny-meta text-[var(--text-muted)]">Aperçu du chapitre</div>
            <h3 className="truncate font-display text-[18px] font-bold">Chapter {String(chapter.number).padStart(2, "0")} — {chapter.title}</h3>
          </div>
          <IconButton ariaLabel="Fermer" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden bg-[var(--stage)] p-4">
          {validated?.image ? (
            <img src={validated.image} alt={`Page ${page.number}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--elevated)]"><FileImage className="h-6 w-6 text-[var(--text-muted)]" /></div>
              <div className="text-[14px] font-bold text-[var(--text-primary)]">Page {page?.number ?? idx + 1}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">Aucune image validée pour cette page.</div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--elevated)] px-6 py-4">
          <SecondaryButton icon={ChevronLeft} className="!h-10 !px-3" onClick={prev}>Précédent</SecondaryButton>
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Page {idx + 1} / {pages.length}</span>
          <SecondaryButton className="!h-10 !px-3" onClick={next}>Suivant<ChevronRight className="h-4 w-4" /></SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------- Root page ---------- */

function CollabMangaPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStudioProjects<Project>().then((saved) => {
      if (cancelled) return;
      setProjects(saved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveStudioProjects(projects);
  }, [projects, loaded]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const addProject = (project: Project) => {
    setProjects((current) => [project, ...current]);
    setSelectedProject(project.id);
    showFeedback("Projet créé.");
  };

  const updateProject = (id: string, updater: (project: Project) => Project) => {
    setProjects((current) => current.map((p) => (p.id === id ? updater(p) : p)));
  };

  const deleteProject = (id: string) => {
    setProjects((current) => current.filter((p) => p.id !== id));
    setSelectedProject(null);
    setSelectedChapter(null);
    showFeedback("Projet supprimé.");
  };

  const project = useMemo(() => projects.find(p => p.id === selectedProject) ?? null, [projects, selectedProject]);
  const chapter = useMemo(() => project?.chapters.find(c => c.id === selectedChapter) ?? null, [project, selectedChapter]);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px]">
        {!project && <ProjectSelection projects={projects} onOpen={setSelectedProject} onCreate={() => setCreateProjectOpen(true)} />}
        {project && !chapter && (
          <ProjectWorkspace
            project={project}
            onBack={() => setSelectedProject(null)}
            onOpenChapter={setSelectedChapter}
            onWorkflow={showFeedback}
            updateProject={(updater) => updateProject(project.id, updater)}
            onDeleteProject={() => deleteProject(project.id)}
          />
        )}
        {project && chapter && (
          <ChapterWorkspace
            project={project}
            chapter={chapter}
            onBack={() => setSelectedChapter(null)}
            onChapterChange={(updater) =>
              updateProject(project.id, (p) => ({
                ...p,
                chapters: p.chapters.map((c) => (c.id === chapter.id ? updater(c) : c)),
              }))
            }
          />
        )}
        {createProjectOpen && (
          <CreateProjectModal
            onClose={() => setCreateProjectOpen(false)}
            onCreate={(newProject) => {
              addProject(newProject);
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
