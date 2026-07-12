import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  Eye,
  Globe2,
  Image as ImageIcon,
  Layers,
  Link2,
  MessageSquare,
  Palette,
  Plus,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_collab/profile")({
  head: () => ({
    meta: [
      { title: "Profile · CollabManga" },
      {
        name: "description",
        content:
          "CollabManga creator profile — projects, illustrations, propositions, announcements and sponsorship in one premium dark workspace.",
      },
      { property: "og:title", content: "Profile · CollabManga" },
      {
        property: "og:description",
        content:
          "Discover a CollabManga creator: bio, roles, availability, projects and collaboration options.",
      },
    ],
  }),
  component: ProfilePage,
});

type ProfileType = "creator" | "content";
type ViewMode = "own" | "public";
type AddKind = "sponsorship" | "announcement" | "illustration" | "proposition";

function ProfilePage() {
  const [profileType, setProfileType] = useState<ProfileType>("creator");
  const [mode, setMode] = useState<ViewMode>("own");
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<null | { title: string; kind: string }>(null);
  const [addOpen, setAddOpen] = useState<AddKind | null>(null);

  const tabs = useMemo(() => {
    const base =
      profileType === "creator"
        ? [
            { id: "overview", label: "Overview" },
            { id: "projects", label: "Projects" },
            { id: "illustrations", label: "Illustrations" },
            { id: "propositions", label: "Propositions" },
            { id: "announcements", label: "Announcements" },
          ]
        : [
            { id: "overview", label: "Overview" },
            { id: "sponsorship", label: "Sponsorship" },
            { id: "announcements", label: "Announcements" },
            { id: "projects", label: "Projects Promoted" },
            { id: "propositions", label: "Propositions" },
          ];
    if (mode === "own") base.push({ id: "account", label: "Account" });
    return base;
  }, [profileType, mode]);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#050B1D", color: "#F7FAFF" }}>
      <div
        className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8 lg:px-8"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        <DemoSwitcher
          profileType={profileType}
          setProfileType={setProfileType}
          mode={mode}
          setMode={setMode}
        />

        <ProfileHeader
          profileType={profileType}
          mode={mode}
          onEdit={() => setEditOpen(true)}
          onAdd={setAddOpen}
        />

        <div className="mt-6">
          <Tabs.Root value={tab} onValueChange={setTab}>
            <div className="cm-tabs-scroll -mx-1 overflow-x-auto">
              <Tabs.List className="flex min-w-max items-center gap-1 border-b px-1"
                style={{ borderColor: "rgba(133,154,206,0.18)" }}
              >
                {tabs.map((t) => (
                  <Tabs.Trigger
                    key={t.id}
                    value={t.id}
                    className="cm-tab relative whitespace-nowrap px-4 py-3 text-[13px] font-semibold transition-colors"
                  >
                    {t.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>

            <div className="mt-6">
              <Tabs.Content value="overview">
                <OverviewTab
                  profileType={profileType}
                  mode={mode}
                  onDetails={(t, k) => setDetailsOpen({ title: t, kind: k })}
                />
              </Tabs.Content>
              <Tabs.Content value="projects">
                <ProjectsTab
                  profileType={profileType}
                  mode={mode}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Project" })}
                />
              </Tabs.Content>
              <Tabs.Content value="illustrations">
                <IllustrationsTab
                  mode={mode}
                  onAdd={() => setAddOpen("illustration")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Illustration" })}
                />
              </Tabs.Content>
              <Tabs.Content value="propositions">
                <PropositionsTab
                  mode={mode}
                  onAdd={() => setAddOpen("proposition")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Proposition" })}
                />
              </Tabs.Content>
              <Tabs.Content value="announcements">
                <AnnouncementsTab
                  mode={mode}
                  onAdd={() => setAddOpen("announcement")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Announcement" })}
                />
              </Tabs.Content>
              <Tabs.Content value="sponsorship">
                <SponsorshipTab
                  mode={mode}
                  onAdd={() => setAddOpen("sponsorship")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Sponsorship option" })}
                />
              </Tabs.Content>
              {mode === "own" && (
                <Tabs.Content value="account">
                  <AccountTab profileType={profileType} />
                </Tabs.Content>
              )}
            </div>
          </Tabs.Root>
        </div>
      </div>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profileType={profileType}
      />
      <DetailsModal
        open={!!detailsOpen}
        onClose={() => setDetailsOpen(null)}
        title={detailsOpen?.title ?? ""}
        kind={detailsOpen?.kind ?? ""}
      />
      <AddSponsorshipModal open={addOpen === "sponsorship"} onClose={() => setAddOpen(null)} />
      <AddAnnouncementModal open={addOpen === "announcement"} onClose={() => setAddOpen(null)} />
      <AddIllustrationModal open={addOpen === "illustration"} onClose={() => setAddOpen(null)} />
      <AddPropositionModal open={addOpen === "proposition"} onClose={() => setAddOpen(null)} />

      <style>{`
        .cm-tab { color: #B8C4E5; }
        .cm-tab[data-state="active"] { color: #39FF88; }
        .cm-tab[data-state="active"]::after {
          content: "";
          position: absolute;
          left: 12px; right: 12px; bottom: -1px; height: 2px;
          background: #39FF88;
          border-radius: 999px;
          box-shadow: 0 0 12px rgba(57,255,136,0.55);
        }
        .cm-tabs-scroll::-webkit-scrollbar { display: none; }
        .cm-tabs-scroll { scrollbar-width: none; }
        .cm-sora { font-family: var(--font-sora); }
        .cm-input {
          background: #0E193A;
          border: 1px solid rgba(133,154,206,0.20);
          border-radius: 14px;
          height: 44px;
          padding: 0 14px;
          color: #F7FAFF;
          width: 100%;
          font-size: 14px;
        }
        .cm-input::placeholder { color: #7F8CB3; }
        .cm-input:focus {
          outline: none;
          border-color: #39FF88;
          box-shadow: 0 0 0 3px rgba(57,255,136,0.10);
        }
        .cm-textarea {
          background: #0E193A;
          border: 1px solid rgba(133,154,206,0.20);
          border-radius: 14px;
          padding: 12px 14px;
          color: #F7FAFF;
          width: 100%;
          min-height: 96px;
          font-size: 14px;
          resize: vertical;
        }
        .cm-textarea:focus {
          outline: none;
          border-color: #39FF88;
          box-shadow: 0 0 0 3px rgba(57,255,136,0.10);
        }
      `}</style>
    </div>
  );
}

/* ---------------- Buttons & primitives ---------------- */

function PrimaryButton({
  children,
  onClick,
  icon,
  className = "",
  type = "button",
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit";
  full?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-[18px] text-[14px] font-bold transition-colors ${full ? "w-full" : ""} ${className}`}
      style={{ background: "#39FF88", color: "#04111E", height: 44 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#25E575")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#39FF88")}
    >
      {icon}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  icon,
  className = "",
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-[18px] text-[14px] font-bold transition-colors ${full ? "w-full" : ""} ${className}`}
      style={{
        background: "#101B3F",
        border: "1px solid rgba(133,154,206,0.28)",
        color: "#F7FAFF",
        height: 44,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.borderColor = "rgba(133,154,206,0.40)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#101B3F";
        e.currentTarget.style.borderColor = "rgba(133,154,206,0.28)";
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-[14px] px-3 text-[14px] font-bold transition-colors"
      style={{ color: "#B8C4E5", height: 44 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#F7FAFF")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#B8C4E5")}
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-[12px] transition-colors"
      style={{
        background: "#101B3F",
        border: "1px solid rgba(133,154,206,0.18)",
        color: "#B8C4E5",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(133,154,206,0.40)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(133,154,206,0.18)")}
    >
      {children}
    </button>
  );
}

type ChipTone = "neutral" | "active" | "info" | "warning";
function Chip({ children, tone = "neutral", icon }: { children: ReactNode; tone?: ChipTone; icon?: ReactNode }) {
  const styles: Record<ChipTone, { bg: string; bd: string; c: string }> = {
    neutral: { bg: "#0E193A", bd: "rgba(133,154,206,0.18)", c: "#B8C4E5" },
    active: { bg: "rgba(57,255,136,0.12)", bd: "rgba(57,255,136,0.45)", c: "#39FF88" },
    info: { bg: "rgba(117,167,255,0.12)", bd: "rgba(117,167,255,0.35)", c: "#75A7FF" },
    warning: { bg: "rgba(255,184,77,0.12)", bd: "rgba(255,184,77,0.35)", c: "#FFB84D" },
  };
  const s = styles[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.c }}
    >
      {icon}
      {children}
    </span>
  );
}

function Panel({
  children,
  className = "",
  padding = 24,
}: {
  children: ReactNode;
  className?: string;
  padding?: number;
}) {
  return (
    <div
      className={`rounded-[22px] ${className}`}
      style={{
        background: "#0B1430",
        border: "1px solid rgba(133,154,206,0.18)",
        padding,
        boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, className = "", padding = 18 }: { children: ReactNode; className?: string; padding?: number }) {
  return (
    <div
      className={`rounded-[18px] transition-colors ${className}`}
      style={{
        background: "#101B3F",
        border: "1px solid rgba(133,154,206,0.18)",
        padding,
        boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="cm-sora text-[20px] font-bold leading-7" style={{ color: "#F7FAFF" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[13px] font-medium leading-5" style={{ color: "#7F8CB3" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[11px] font-extrabold uppercase"
      style={{ color: "#7F8CB3", letterSpacing: "0.06em" }}
    >
      {children}
    </div>
  );
}

/* ---------------- Demo switcher ---------------- */

function DemoSwitcher({
  profileType,
  setProfileType,
  mode,
  setMode,
}: {
  profileType: ProfileType;
  setProfileType: (v: ProfileType) => void;
  mode: ViewMode;
  setMode: (v: ViewMode) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-[12px]" style={{ color: "#7F8CB3" }}>
      <span className="mr-1 font-bold uppercase tracking-wider">Demo view</span>
      <SegBtn active={profileType === "creator"} onClick={() => setProfileType("creator")}>
        Dessinateur / Scénariste
      </SegBtn>
      <SegBtn active={profileType === "content"} onClick={() => setProfileType("content")}>
        Créateur de contenu
      </SegBtn>
      <span className="mx-1" style={{ color: "#5E6A90" }}>|</span>
      <SegBtn active={mode === "own"} onClick={() => setMode("own")}>
        Own profile
      </SegBtn>
      <SegBtn active={mode === "public"} onClick={() => setMode("public")}>
        Public view
      </SegBtn>
    </div>
  );
}

function SegBtn({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors"
      style={
        active
          ? {
              background: "rgba(57,255,136,0.12)",
              border: "1px solid rgba(57,255,136,0.45)",
              color: "#39FF88",
            }
          : {
              background: "#0E193A",
              border: "1px solid rgba(133,154,206,0.18)",
              color: "#B8C4E5",
            }
      }
    >
      {children}
    </button>
  );
}

/* ---------------- Header ---------------- */

function ProfileHeader({
  profileType,
  mode,
  onEdit,
  onAdd,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  onEdit: () => void;
  onAdd: (kind: AddKind) => void;
}) {
  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-[22px]"
        style={{
          height: 240,
          background:
            "linear-gradient(135deg, #060D24 0%, #0B1430 50%, #101B3F 100%)",
          border: "1px solid rgba(133,154,206,0.18)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 200px at 20% 0%, rgba(117,167,255,0.10), transparent 60%), radial-gradient(500px 240px at 80% 100%, rgba(57,255,136,0.10), transparent 60%)",
          }}
        />
        <span
          className="absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase"
          style={{
            background: "rgba(8,17,43,0.7)",
            border: "1px solid rgba(133,154,206,0.18)",
            color: "#7F8CB3",
            letterSpacing: "0.06em",
          }}
        >
          Banner image
        </span>
      </div>

      <div className="relative -mt-14 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-1 md:-mt-16 md:gap-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 md:gap-5">
          <div
            className="grid shrink-0 place-items-center rounded-full"
            style={{
              width: 112,
              height: 112,
              background: "linear-gradient(135deg, #101B3F, #0B1430)",
              border: "4px solid #050B1D",
              outline: "2px solid rgba(57,255,136,0.55)",
              outlineOffset: -2,
              boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
            }}
          >
            <span className="cm-sora text-[36px] font-bold" style={{ color: "#F7FAFF" }}>
              KM
            </span>
          </div>
          <div className="min-w-0 pt-14 md:pt-16">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1
                className="cm-sora truncate text-[24px] font-bold leading-8 md:text-[30px] md:leading-[38px]"
                style={{ color: "#F7FAFF" }}
              >
                Creator display name
              </h1>
              <span className="text-[13px] font-semibold" style={{ color: "#7F8CB3" }}>
                @username
              </span>
            </div>
            <p className="mt-1 text-[13px] font-medium leading-5" style={{ color: "#B8C4E5" }}>
              Short profile tagline — one line describing focus and current intent.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="active" icon={<Sparkles size={12} />}>
                {profileType === "content" ? "Créateur de contenu" : "Dessinateur"}
              </Chip>
              {profileType === "creator" ? (
                <>
                  <Chip>Scénariste</Chip>
                </>
              ) : (
                <>
                  <Chip>Lecteur</Chip>
                </>
              )}
              <Chip tone="active">Available</Chip>
              <Chip tone="info" icon={<Globe2 size={12} />}>EN · FR · JP</Chip>
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2 md:col-span-1 md:justify-end md:pt-16">
          {mode === "own" ? (
            <>
              <PrimaryButton icon={<Edit3 size={16} />} onClick={onEdit}>
                Edit Profile
              </PrimaryButton>
              <SecondaryButton icon={<Eye size={16} />}>Preview Public</SecondaryButton>
              <CreateDropdown profileType={profileType} onSelect={onAdd} />
              <GhostButton icon={<Link2 size={16} />}>Copy Link</GhostButton>
            </>
          ) : profileType === "content" ? (
            <>
              <PrimaryButton icon={<Send size={16} />}>Propose Sponsorship</PrimaryButton>
              <SecondaryButton icon={<MessageSquare size={16} />}>Message</SecondaryButton>
              <SecondaryButton icon={<Check size={16} />}>Save Profile</SecondaryButton>
            </>
          ) : (
            <>
              <PrimaryButton icon={<Users size={16} />}>Invite to Project</PrimaryButton>
              <SecondaryButton icon={<MessageSquare size={16} />}>Message</SecondaryButton>
              <SecondaryButton icon={<Check size={16} />}>Save Profile</SecondaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateDropdown({ profileType, onSelect }: { profileType: ProfileType; onSelect: (kind: AddKind) => void }) {
  const items = [
    profileType === "content" ? { label: "Add Sponsorship Option", kind: "sponsorship" as const } : null,
    { label: "Create Sponsorship Announcement", kind: "sponsorship" as const },
    { label: "Upload Illustration", kind: "illustration" as const },
    { label: "Create Collaboration Announcement", kind: "announcement" as const },
    { label: "Create Proposition", kind: "proposition" as const },
  ].filter(Boolean) as { label: string; kind: AddKind }[];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-[14px] px-[18px] text-[14px] font-bold"
          style={{
            background: "#101B3F",
            border: "1px solid rgba(133,154,206,0.28)",
            color: "#F7FAFF",
            height: 44,
          }}
        >
          <Plus size={16} />
          Create
          <ChevronDown size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[260px] rounded-[18px] p-1.5"
          style={{
            background: "#0B1430",
            border: "1px solid rgba(133,154,206,0.28)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          }}
        >
          {items.map((it) => (
            <DropdownMenu.Item
              key={it.label}
              onSelect={() => onSelect(it.kind)}
              className="cursor-pointer rounded-[12px] px-3 py-2.5 text-[13px] font-semibold outline-none data-[highlighted]:bg-white/5"
              style={{ color: "#B8C4E5" }}
            >
              {it.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({
  profileType,
  mode,
  onDetails,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  onDetails: (title: string, kind: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <BioPanel profileType={profileType} mode={mode} />
      </div>
      <div className="lg:col-span-2">
        {profileType === "creator" ? (
          <ProjectShowcase mode={mode} onDetails={(t) => onDetails(t, "Project")} />
        ) : (
          <SponsorshipShowcase mode={mode} onDetails={(t) => onDetails(t, "Sponsorship option")} />
        )}
      </div>
    </div>
  );
}

function BioPanel({ profileType, mode }: { profileType: ProfileType; mode: ViewMode }) {
  return (
    <Panel>
      <SectionTitle title="About" />
      <p className="text-[14px] leading-[22px]" style={{ color: "#B8C4E5" }}>
        Bio placeholder — a short paragraph describing the creator's background,
        style and current focus. This area supports a few lines of context before
        readers explore projects, illustrations or sponsorship options.
      </p>

      <div className="mt-6 space-y-4">
        <InfoRow label="Languages">
          <Chip tone="info">English</Chip>
          <Chip tone="info">French</Chip>
          <Chip tone="info">Japanese</Chip>
        </InfoRow>
        <InfoRow label="Main role">
          <Chip tone="active">{profileType === "content" ? "Créateur de contenu" : "Dessinateur"}</Chip>
        </InfoRow>
        <InfoRow label="Availability">
          <Chip tone="active">Open to collaborations</Chip>
        </InfoRow>
        <InfoRow label="Collaboration">
          <Chip>Long-term</Chip>
          <Chip>One-shot</Chip>
        </InfoRow>
        <InfoRow label="Preferred genres">
          <Chip>Shonen</Chip>
          <Chip>Seinen</Chip>
          <Chip>Slice of life</Chip>
        </InfoRow>
        {profileType === "content" ? (
          <>
            <InfoRow label="Platforms">
              <Chip>YouTube</Chip>
              <Chip>TikTok</Chip>
              <Chip>Instagram</Chip>
            </InfoRow>
            <InfoRow label="Content formats">
              <Chip>Review</Chip>
              <Chip>Analysis</Chip>
              <Chip>Short</Chip>
            </InfoRow>
            <InfoRow label="Sponsorships">
              <Chip tone="active">Accepting</Chip>
            </InfoRow>
          </>
        ) : null}

        {mode === "own" && (
          <InfoRow label="Profile visibility">
            <Chip tone="active">Public</Chip>
          </InfoRow>
        )}
        {mode === "public" && (
          <InfoRow label="Contact preference">
            <Chip tone="info">Via message</Chip>
          </InfoRow>
        )}
      </div>
    </Panel>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/* ---------------- Project showcase ---------------- */

function ProjectShowcase({ mode, onDetails }: { mode: ViewMode; onDetails: (title: string) => void }) {
  const projects = [
    { title: "Project title placeholder", role: "Dessinateur", status: "In production", chapters: "12 chapters" },
    { title: "Project title placeholder", role: "Scénariste", status: "Ongoing", chapters: "4 chapters" },
    { title: "Project title placeholder", role: "Créateur de contenu", status: "Recruiting", chapters: "Pre-production" },
  ];

  return (
    <Panel>
      <SectionTitle
        title="Projects"
        subtitle="Manga projects this user created, joined, or contributed to."
        action={
          mode === "own" && (
            <SecondaryButton icon={<Plus size={16} />}>New Project</SecondaryButton>
          )
        }
      />
      <div className="space-y-4">
        {projects.map((p, i) => (
          <ProjectCard key={i} project={p} mode={mode} onDetails={() => onDetails(p.title)} />
        ))}
      </div>
    </Panel>
  );
}

function ProjectCard({
  project,
  mode,
  onDetails,
}: {
  project: { title: string; role: string; status: string; chapters: string };
  mode: ViewMode;
  onDetails: () => void;
}) {
  return (
    <Card padding={16}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
        <div
          className="grid aspect-[3/4] w-full max-w-[96px] place-items-center overflow-hidden rounded-[14px]"
          style={{
            background: "linear-gradient(160deg, #060D24, #0B1430)",
            border: "1px solid rgba(133,154,206,0.18)",
          }}
        >
          <ImageIcon size={22} color="#5E6A90" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-[16px] font-extrabold leading-[22px]"
              style={{ color: "#F7FAFF" }}
            >
              {project.title}
            </h3>
            <Chip tone={project.status === "Recruiting" ? "warning" : "info"}>{project.status}</Chip>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
            Short project description placeholder — two lines max, giving readers a taste of the tone and premise before opening full details.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip>Role · {project.role}</Chip>
            <Chip>{project.chapters}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:flex-col sm:items-stretch sm:justify-center">
          <PrimaryButton icon={<BookOpen size={16} />}>View Project</PrimaryButton>
          <SecondaryButton onClick={onDetails}>View Details</SecondaryButton>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Sponsorship showcase ---------------- */

function SponsorshipShowcase({ mode, onDetails }: { mode: ViewMode; onDetails: (title: string) => void }) {
  const options = [
    {
      title: "Short dedicated review",
      price: "€180",
      type: "Short dedicated video",
      video: "Review",
      duration: "2–5 min",
    },
    {
      title: "Long-form manga analysis",
      price: "€450",
      type: "Long dedicated video",
      video: "Analysis",
      duration: "10+ min",
    },
    {
      title: "Community post placement",
      price: "Custom price",
      type: "Community post",
      video: "—",
      duration: "—",
    },
  ];
  return (
    <Panel>
      <SectionTitle
        title="Sponsorship Options"
        subtitle="Services this creator offers to promote manga projects."
        action={
          mode === "own" && <SecondaryButton icon={<Plus size={16} />}>New Option</SecondaryButton>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((o, i) => (
          <SponsorshipCard key={i} opt={o} mode={mode} onDetails={() => onDetails(o.title)} />
        ))}
      </div>
    </Panel>
  );
}

function SponsorshipCard({
  opt,
  mode,
  onDetails,
}: {
  opt: { title: string; price: string; type: string; video: string; duration: string };
  mode: ViewMode;
  onDetails: () => void;
}) {
  return (
    <Card padding={20}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-extrabold leading-[22px]" style={{ color: "#F7FAFF" }}>
            {opt.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
            Short service description placeholder — two lines maximum before View Details.
          </p>
        </div>
        <IconButton label="Save"><Check size={16} /></IconButton>
      </div>

      <div className="mt-4">
        <MetaLabel>Price</MetaLabel>
        <div
          className="cm-sora mt-1 text-[24px] font-extrabold leading-none"
          style={{ color: "#39FF88" }}
        >
          {opt.price}
        </div>
      </div>

      <div className="mt-4">
        <MetaLabel>Platforms</MetaLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>YouTube</Chip>
          <Chip>TikTok</Chip>
          <Chip>Instagram</Chip>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <MetaLabel>Type</MetaLabel>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{opt.type}</div>
        </div>
        <div>
          <MetaLabel>Video</MetaLabel>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{opt.video}</div>
        </div>
        <div>
          <MetaLabel>Duration</MetaLabel>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{opt.duration}</div>
        </div>
        <div>
          <MetaLabel>Status</MetaLabel>
          <div className="mt-1"><Chip tone="active">Available</Chip></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onDetails}>View Details</SecondaryButton>
        {mode === "own" ? (
          <PrimaryButton icon={<Edit3 size={16} />}>Manage</PrimaryButton>
        ) : (
          <PrimaryButton icon={<Send size={16} />}>Propose Sponsorship</PrimaryButton>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Other tabs ---------------- */

function ProjectsTab({
  profileType,
  mode,
  onDetails,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  onDetails: (title: string) => void;
}) {
  const projects = Array.from({ length: 4 }).map((_, i) => ({
    title: profileType === "content" ? `Promoted project ${i + 1}` : `Project title ${i + 1}`,
    role: profileType === "content" ? "Créateur de contenu" : ["Dessinateur", "Scénariste", "Lecteur", "Créateur de contenu"][i % 4],
    status: ["Ongoing", "Recruiting", "In production", "Completed"][i % 4],
    chapters: profileType === "content" ? "Long-form video" : `${(i + 1) * 3} chapters`,
  }));

  return (
    <Panel>
      <SectionTitle
        title={profileType === "content" ? "Projects Promoted" : "All Projects"}
        subtitle={
          profileType === "content"
            ? "Manga projects this creator has promoted."
            : "Every project created, joined, or contributed to."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input className="cm-input" style={{ height: 40, width: 180 }} placeholder="Search projects" />
            <SecondaryButton>Filters</SecondaryButton>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        {projects.map((p, i) => (
          <ProjectCard key={i} project={p} mode={mode} onDetails={() => onDetails(p.title)} />
        ))}
      </div>
    </Panel>
  );
}

function IllustrationsTab({ mode, onDetails, onAdd }: { mode: ViewMode; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = Array.from({ length: 6 });
  return (
    <Panel>
      <SectionTitle
        title="Illustrations"
        subtitle="Portfolio pieces, character designs and finished artwork."
        action={
          mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>Upload</SecondaryButton>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No illustrations yet" text="Uploaded artwork will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((_, i) => (
            <IllustrationCard key={i} mode={mode} onDetails={() => onDetails(`Illustration ${i + 1}`)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function IllustrationCard({ mode, onDetails }: { mode: ViewMode; onDetails: () => void }) {
  return (
    <Card padding={14}>
      <div
        className="grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-[14px]"
        style={{
          background:
            "linear-gradient(160deg, #060D24, #0B1430 50%, #101B3F 100%)",
          border: "1px solid rgba(133,154,206,0.18)",
        }}
      >
        <Palette size={28} color="#5E6A90" />
      </div>
      <div className="mt-3">
        <h3 className="truncate text-[15px] font-extrabold" style={{ color: "#F7FAFF" }}>
          Artwork title
        </h3>
        <p className="mt-0.5 text-[12px] font-semibold" style={{ color: "#7F8CB3" }}>
          @artist_username
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>Ink</Chip>
          <Chip>Character</Chip>
          <Chip tone="active">Available</Chip>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SecondaryButton onClick={onDetails} full>
          View Details
        </SecondaryButton>
        {mode === "own" ? (
          <IconButton label="Edit"><Edit3 size={16} /></IconButton>
        ) : (
          <IconButton label="Save"><Check size={16} /></IconButton>
        )}
      </div>
    </Card>
  );
}

function PropositionsTab({ mode, onDetails, onAdd }: { mode: ViewMode; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = Array.from({ length: 4 });
  return (
    <Panel>
      <SectionTitle
        title="Propositions"
        subtitle="Story ideas, arcs and creative pitches shared by this creator."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Proposition</SecondaryButton>}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((_, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-2">
              <Chip tone="info">Story arc</Chip>
              <Chip>Shonen</Chip>
            </div>
            <h3 className="mt-3 text-[16px] font-extrabold" style={{ color: "#F7FAFF" }}>
              Proposition title {i + 1}
            </h3>
            <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
              Short description of the pitch — logline, tone and hook, two lines maximum before View Details.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>Complexity · Medium</Chip>
              <Chip>Tone · Dramatic</Chip>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <SecondaryButton onClick={() => onDetails(`Proposition ${i + 1}`)}>View Details</SecondaryButton>
              {mode === "own" ? (
                <PrimaryButton icon={<Edit3 size={16} />}>Edit</PrimaryButton>
              ) : (
                <PrimaryButton icon={<Layers size={16} />}>Use in Project</PrimaryButton>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function AnnouncementsTab({ mode, onDetails, onAdd }: { mode: ViewMode; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = [
    { kind: "project" as const, title: "Manga project looking for dessinateur" },
    { kind: "user" as const, title: "Scénariste looking for a serialized project" },
    { kind: "project" as const, title: "Seinen project seeking a reader" },
  ];
  return (
    <Panel>
      <SectionTitle
        title="Announcements"
        subtitle="Open collaboration calls and availability posts."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Announcement</SecondaryButton>}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-2">
              <Chip tone={it.kind === "project" ? "info" : "active"}>
                {it.kind === "project" ? "Project seeks partner" : "User seeks project"}
              </Chip>
              <Chip tone="warning">Recruiting</Chip>
            </div>
            <h3 className="mt-3 text-[16px] font-extrabold" style={{ color: "#F7FAFF" }}>
              {it.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
              Short announcement description placeholder — two lines maximum before View Details.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>{it.kind === "project" ? "Role · Dessinateur" : "Offering · Scénariste"}</Chip>
              <Chip>Shonen</Chip>
              <Chip>Remote</Chip>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <SecondaryButton onClick={() => onDetails(it.title)}>View Details</SecondaryButton>
              <PrimaryButton icon={<Send size={16} />}>{it.kind === "project" ? "Apply" : "Contact"}</PrimaryButton>
            </div>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function SponsorshipTab({ mode, onDetails, onAdd }: { mode: ViewMode; onDetails: (title: string) => void; onAdd: () => void }) {
  return (
    <Panel>
      <SectionTitle
        title="Sponsorship"
        subtitle="Services offered and sponsorship announcements."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Option</SecondaryButton>}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { title: "Short review", price: "€180", type: "Short dedicated video", video: "Review", duration: "2–5 min" },
          { title: "Long analysis", price: "€450", type: "Long dedicated video", video: "Analysis", duration: "10+ min" },
        ].map((o, i) => (
          <SponsorshipCard key={i} opt={o} mode={mode} onDetails={() => onDetails(o.title)} />
        ))}
      </div>
    </Panel>
  );
}

function AccountTab({ profileType }: { profileType: ProfileType }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <SectionTitle title="Identity" subtitle="Public display information." />
        <div className="space-y-3">
          <Field label="Display name"><input className="cm-input" defaultValue="Creator display name" /></Field>
          <Field label="Username"><input className="cm-input" defaultValue="@username" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Avatar"><SecondaryButton full>Upload avatar</SecondaryButton></Field>
            <Field label="Banner"><SecondaryButton full>Upload banner</SecondaryButton></Field>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="Profile information" subtitle="Roles, languages and preferences." />
        <div className="space-y-3">
          <Field label="Bio"><textarea className="cm-textarea" placeholder="Bio to complete." /></Field>
          <Field label="Main role"><input className="cm-input" defaultValue={profileType === "content" ? "Créateur de contenu" : "Dessinateur"} /></Field>
          <Field label="Languages"><input className="cm-input" defaultValue="English, French" /></Field>
          <Field label="Availability"><input className="cm-input" defaultValue="Open to collaborations" /></Field>
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="Content settings" subtitle="What appears on your public profile." />
        <div className="space-y-3">
          <ToggleRow label="Show projects" defaultChecked />
          <ToggleRow label="Show illustrations" defaultChecked />
          <ToggleRow label="Show propositions" defaultChecked />
          <ToggleRow label="Show sponsorship options" defaultChecked={profileType === "content"} />
          <ToggleRow label="Allow project invitations" defaultChecked />
          <ToggleRow label="Allow direct messages" defaultChecked />
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="CollabManga AI plan" subtitle="Usage and billing." />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current plan" value="Creator" />
          <Stat label="Credits left" value="1 240" />
          <Stat label="Used this month" value="360" />
          <Stat label="Renewal" value="Sep 24" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton>Manage plan</PrimaryButton>
          <SecondaryButton>Billing history</SecondaryButton>
        </div>
      </Panel>

      <Panel className="lg:col-span-2">
        <SectionTitle title="Security" subtitle="Account access and notifications." />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Email"><input className="cm-input" defaultValue="you@collabmanga.app" /></Field>
          <Field label="Password"><SecondaryButton full>Change password</SecondaryButton></Field>
          <Field label="Notifications"><SecondaryButton full>Manage notifications</SecondaryButton></Field>
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12px] font-bold" style={{ color: "#B8C4E5" }}>{label}</div>
      {children}
    </label>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div
      className="flex items-center justify-between rounded-[14px] px-4 py-3"
      style={{ background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)" }}
    >
      <span className="text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{label}</span>
      <button
        onClick={() => setOn(!on)}
        aria-pressed={on}
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{
          background: on ? "rgba(57,255,136,0.35)" : "#101B3F",
          border: `1px solid ${on ? "rgba(57,255,136,0.55)" : "rgba(133,154,206,0.28)"}`,
        }}
      >
        <span
          className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
          style={{
            left: on ? 22 : 2,
            background: on ? "#39FF88" : "#B8C4E5",
          }}
        />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[14px] px-4 py-3"
      style={{ background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)" }}
    >
      <MetaLabel>{label}</MetaLabel>
      <div className="cm-sora mt-1 text-[18px] font-bold" style={{ color: "#F7FAFF" }}>{value}</div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="grid place-items-center rounded-[18px] px-6 py-14 text-center"
      style={{ background: "#08112B", border: "1px dashed rgba(133,154,206,0.28)" }}
    >
      <h3 className="cm-sora text-[18px] font-bold" style={{ color: "#F7FAFF" }}>{title}</h3>
      <p className="mt-1 text-[13px]" style={{ color: "#7F8CB3" }}>{text}</p>
    </div>
  );
}

/* ---------------- Modals ---------------- */

function ModalShell({
  open,
  onClose,
  title,
  children,
  width = 900,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(3,7,20,0.72)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px]"
          style={{
            maxWidth: width,
            maxHeight: "85vh",
            background: "#0B1430",
            border: "1px solid rgba(133,154,206,0.28)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid rgba(133,154,206,0.18)" }}
          >
            <Dialog.Title
              className="cm-sora text-[18px] font-bold"
              style={{ color: "#F7FAFF" }}
            >
              {title}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-[12px]"
              style={{
                background: "#101B3F",
                border: "1px solid rgba(133,154,206,0.18)",
                color: "#B8C4E5",
              }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div
            className="overflow-y-auto px-6 py-6"
            style={{ maxHeight: "calc(85vh - 132px)" }}
          >
            {children}
          </div>
          {footer && (
            <div
              className="flex items-center justify-end gap-2 px-6 py-4"
              style={{ borderTop: "1px solid rgba(133,154,206,0.18)", background: "#08112B" }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditProfileModal({
  open,
  onClose,
  profileType,
}: {
  open: boolean;
  onClose: () => void;
  profileType: ProfileType;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Edit profile"
      width={840}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={onClose}>Save Changes</PrimaryButton>
        </>
      }
    >
      <div className="space-y-8">
        <FormGroup title="Identity">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Display name"><input className="cm-input" defaultValue="Creator display name" /></Field>
            <Field label="Username"><input className="cm-input" defaultValue="@username" /></Field>
            <Field label="Avatar"><SecondaryButton full>Upload avatar</SecondaryButton></Field>
            <Field label="Banner"><SecondaryButton full>Upload banner</SecondaryButton></Field>
          </div>
        </FormGroup>

        <FormGroup title="About">
          <Field label="Bio"><textarea className="cm-textarea" placeholder="Bio to complete." /></Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Spoken languages"><input className="cm-input" placeholder="English, French, Japanese" /></Field>
            <Field label="Availability"><input className="cm-input" placeholder="Open to collaborations" /></Field>
            <Field label="Main role"><input className="cm-input" defaultValue={profileType === "content" ? "Créateur de contenu" : "Dessinateur"} /></Field>
            <Field label="Secondary roles"><input className="cm-input" placeholder="Scénariste, Lecteur" /></Field>
          </div>
        </FormGroup>

        <FormGroup title="Preferences">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Profile visibility"><input className="cm-input" defaultValue="Public" /></Field>
            <Field label="Collaboration preferences"><input className="cm-input" placeholder="Long-term, remote" /></Field>
            {profileType === "content" ? (
              <Field label="Sponsorship settings"><input className="cm-input" placeholder="Accepting sponsorships" /></Field>
            ) : (
              <Field label="Portfolio visibility"><input className="cm-input" defaultValue="Public" /></Field>
            )}
            <Field label="Writing sample visibility"><input className="cm-input" defaultValue="Public" /></Field>
          </div>
        </FormGroup>
      </div>
    </ModalShell>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="cm-sora mb-3 text-[18px] font-bold leading-[26px]" style={{ color: "#F7FAFF" }}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ---------------- Add / create modals ---------------- */

// One filter/option row: title + all options shown at once as selectable chips.
function ChoiceRow({
  label,
  options,
  multi = false,
  defaultValue,
}: {
  label: string;
  options: string[];
  multi?: boolean;
  defaultValue?: string;
}) {
  const [sel, setSel] = useState<string[]>(defaultValue ? [defaultValue] : []);
  const toggle = (o: string) =>
    setSel((prev) =>
      multi
        ? prev.includes(o)
          ? prev.filter((x) => x !== o)
          : [...prev, o]
        : prev[0] === o
          ? []
          : [o],
    );
  return (
    <div>
      <div className="mb-2 text-[12px] font-bold" style={{ color: "#B8C4E5" }}>{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = sel.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              style={
                active
                  ? { background: "rgba(57,255,136,0.12)", border: "1px solid rgba(57,255,136,0.45)", color: "#39FF88" }
                  : { background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)", color: "#B8C4E5" }
              }
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dropzone() {
  return (
    <div
      className="grid cursor-pointer place-items-center rounded-[16px] px-6 py-10 text-center text-[13px] font-semibold"
      style={{ background: "#08112B", border: "1px dashed rgba(133,154,206,0.28)", color: "#7F8CB3" }}
    >
      Drop files here to upload (or click)
    </div>
  );
}

function AddSponsorshipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ajouter parrainage"
      width={860}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={onClose}>Confirmer</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ChoiceRow multi label="Plateforme" options={["Youtube", "Tiktok", "Instagram", "Twitter"]} />
        <ChoiceRow
          multi
          label="Format de parrainage"
          options={["Post communautaire", "Vidéo longue dédiée", "Vidéo courte dédiée", "Placement dans une vidéo", "Story"]}
        />
        <ChoiceRow label="Type de vidéo" options={["Analyse profonde", "Review", "Reaction", "Présentation"]} />
        <ChoiceRow label="Durée de vidéo" options={["0–30 s", "30–60 s", "60–120 s", "2–3 min", "3–5 min", "5–10 min", "10+ min"]} />
        <ChoiceRow label="Mode de paiement" options={["Abonnement", "Paiement unique"]} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Quantité"><input type="number" min={0} className="cm-input" placeholder="0" /></Field>
          <Field label="Prix (€)"><input type="number" min={0} className="cm-input" placeholder="0" /></Field>
        </div>
        <Field label="Description"><textarea className="cm-textarea" placeholder="Description" /></Field>
        <div className="rounded-[16px] p-4" style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)" }}>
          <div className="cm-sora mb-3 text-[15px] font-bold" style={{ color: "#F7FAFF" }}>Chapitres — Parrainage</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nombre de chapitres minimum"><input type="number" min={0} className="cm-input" placeholder="0" /></Field>
            <Field label="Nombre de chapitres maximal"><input type="number" min={0} className="cm-input" placeholder="0" /></Field>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function AddAnnouncementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Créer une annonce"
      width={860}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={onClose}>Confirmer</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ChoiceRow label="Langage" options={["FR", "ENG"]} defaultValue="FR" />
        <Field label="Titre"><input className="cm-input" placeholder="Titre" /></Field>
        <Field label="Accroche"><input className="cm-input" placeholder="Accroche" /></Field>
        <Field label="Description"><textarea className="cm-textarea" placeholder="Description" /></Field>
        <ChoiceRow label="Statut recherché" options={["Scénariste", "Dessinateur"]} defaultValue="Scénariste" />
        <div>
          <div className="cm-sora mb-3 text-[15px] font-bold" style={{ color: "#F7FAFF" }}>Type de projet favori</div>
          <div className="space-y-4">
            <ChoiceRow multi label="Genre" options={["Shonen", "Seinen", "Shojo", "Josei"]} />
            <ChoiceRow
              multi
              label="Sous-genre"
              options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function AddIllustrationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ajouter illustration"
      width={720}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={onClose}>Confirmer</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="Titre"><input className="cm-input" placeholder="Titre" /></Field>
        <Field label="Description"><textarea className="cm-textarea" placeholder="Description" /></Field>
        <Dropzone />
      </div>
    </ModalShell>
  );
}

function AddPropositionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ajouter proposition"
      width={860}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={onClose}>Ajouter</PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ChoiceRow
          label="Type de proposition"
          defaultValue="Autre"
          options={["Autre", "Système de pouvoirs", "Motivations", "Charadesign", "Worldbuilding", "Équipement"]}
        />
        <Field label="Titre"><input className="cm-input" placeholder="Titre" /></Field>
        <Field label="Description"><textarea className="cm-textarea" placeholder="Description" /></Field>
        <Dropzone />
      </div>
    </ModalShell>
  );
}

function DetailsModal({
  open,
  onClose,
  title,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: string;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title || kind}
      width={1040}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton onClick={onClose} icon={<Send size={16} />}>{kind === "Project" ? "View Project" : "Contact"}</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div
          className="grid aspect-[3/4] w-full max-w-[220px] place-items-center overflow-hidden rounded-[18px]"
          style={{
            background: "linear-gradient(160deg, #060D24, #0B1430 50%, #101B3F 100%)",
            border: "1px solid rgba(133,154,206,0.18)",
          }}
        >
          <ImageIcon size={30} color="#5E6A90" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="info">{kind}</Chip>
            <Chip tone="active">Available</Chip>
          </div>
          <h2 className="cm-sora mt-3 text-[20px] font-bold leading-7" style={{ color: "#F7FAFF" }}>
            {title || `${kind} details`}
          </h2>
          <p className="mt-2 text-[14px] leading-[22px]" style={{ color: "#B8C4E5" }}>
            Full description placeholder — this popup expands the concise card into a complete overview,
            including context, goals, requirements and everything a collaborator or reader would want to know
            before taking action.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Status" value="Ongoing" />
            <Stat label="Role" value="Dessinateur" />
            <Stat label="Chapters" value="12" />
            <Stat label="Genre" value="Shonen" />
            <Stat label="Mode" value="Remote" />
            <Stat label="Updated" value="2d ago" />
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">
            <Chip>Long-term</Chip>
            <Chip>Team of 3</Chip>
            <Chip>Weekly cadence</Chip>
            <Chip tone="info">Remote</Chip>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle title="Details" subtitle="Everything condensed cards omit." />
        <div
          className="rounded-[18px] p-5 text-[14px] leading-[22px]"
          style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)", color: "#B8C4E5" }}
        >
          Long-form description placeholder. Additional sections such as chapter history, contributor list,
          previous illustrations, pricing tiers, or sponsorship deliverables belong here. Cards on the profile
          stay sober; this modal absorbs the depth.
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SecondaryButton icon={<Copy size={16} />}>Copy link</SecondaryButton>
        <GhostButton icon={<Check size={16} />}>Save</GhostButton>
      </div>
    </ModalShell>
  );
}
