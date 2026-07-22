import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addAnnouncement,
  addIdea,
  addIllustration,
  currentUserId,
  listAnnouncements,
  listFriendsDb,
  listIdeas,
  listIllustrations,
  listPendingFriendRequests,
  getMyRoles,
  getProfileByUsername,
  respondFriendRequestDb,
  sendFriendRequestDb,
  sendProfileWorkflowDb,
  startConversationWith,
  updateMyRole,
  uploadImage,
  type DbAnnouncement,
  type DbFriendRequest,
  type DbIdea,
  type DbIllustration,
  type DbProfile,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { addFavorite, listFavorites, type Favorite } from "@/lib/favorites";
import { addSponsorOption, listSponsorOptions, updateSponsorOption, type SponsorOption } from "@/lib/sponsorship-options";
import { ServiceFormModal } from "@/components/sponsorship/ServiceFormModal";
import { CommentsPanel } from "@/components/collab/CommentsPanel";
import {
  loadProfileStudioProjects,
  loadStudioProjects,
  saveStudioProjects,
} from "@/lib/studio-projects";
import {
  DEFAULT_PROFILE_PREFERENCES,
  loadProfilePreferences,
  saveProfilePreferences,
  type ProfilePreferences,
} from "@/lib/profile-preferences";
import {
  DEFAULT_PROFILE_IDENTITY,
  type ProfileType,
  type PublicProfileIdentity,
} from "@/lib/profile-identity";

/** Projection minimale d'un projet Studio stocké dans Supabase. */
type StudioProjectLite = {
  id: string;
  title: string;
  synopsis?: string;
  coverUrl?: string;
  coverDataUrl?: string;
  status: string;
  genres: string[];
  subgenres?: string[];
  chapters: unknown[];
};
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import {
  BookOpen,
  Check,
  ChevronDown,
  Edit3,
  Eye,
  Globe2,
  Image as ImageIcon,
  Link2,
  LogOut,
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
          "CollabManga creator profile — projects, illustrations, ideas, announcements and sponsorship in one premium dark workspace.",
      },
      { property: "og:title", content: "Profile · CollabManga" },
      {
        property: "og:description",
        content:
          "Discover a CollabManga creator: bio, roles, availability, projects and collaboration options.",
      },
    ],
  }),
  component: OwnProfilePage,
});

type ViewMode = "own" | "public";
type AddKind = "project" | "sponsorship" | "announcement" | "illustration" | "proposition";
type ProfileWorkflow = "invite" | "patronage" | "follow" | "friend";
const PROFILE_ROLES = ["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"] as const;
const PROFILE_LANGUAGES = [
  "Français",
  "English",
  "Español",
  "Italiano",
  "日本語",
  "Deutsch",
  "Português",
  "한국어",
  "中文",
  "Nederlands",
  "العربية",
  "हिन्दी",
] as const;
const PROFILE_VISIBILITY_OPTIONS = ["Public", "Privé", "Sur invitation"] as const;

async function persistProfileIdentity(displayName: string, username: string): Promise<void> {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const cleanUsername = username.trim().replace(/^@/, "");
  if (!displayName.trim() || !cleanUsername) throw new Error("Le nom et le nom d'utilisateur sont obligatoires.");
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("Connecte-toi pour modifier ton profil.");
  const { error: authError } = await supabase.auth.updateUser({
    data: { display_name: displayName.trim(), username: cleanUsername },
  });
  if (authError) throw authError;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim(), username: cleanUsername })
    .eq("id", user.id);
  if (profileError) throw profileError;
}

async function compressCoverImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.84);
}

function OwnProfilePage() {
  return <ProfilePage />;
}

export function PublicProfilePage({
  identity,
  profileId,
}: {
  identity: PublicProfileIdentity;
  profileId?: string;
}) {
  return <ProfilePage initialMode="public" initialProfileType={identity.profileType} identity={identity} profileId={profileId} />;
}

function ProfilePage({
  initialMode = "own",
  initialProfileType = "creator",
  identity = DEFAULT_PROFILE_IDENTITY,
  profileId,
}: {
  initialMode?: ViewMode;
  initialProfileType?: ProfileType;
  identity?: PublicProfileIdentity;
  profileId?: string;
}) {
  const navigate = useNavigate();
  const publicLocked = initialMode === "public";
  const [profileType, setProfileType] = useState<ProfileType>(initialProfileType);
  const [mode] = useState<ViewMode>(initialMode);
  const [tab, setTab] = useState("overview");
  // Identité réelle affichée (utilisateur connecté en mode own, profil visité en mode public).
  const [liveIdentity, setLiveIdentity] = useState<PublicProfileIdentity | null>(null);
  const [identityRefreshKey, setIdentityRefreshKey] = useState(0);
  // Id Supabase du profil affiché (le mien en own ; celui visité en public).
  const [shownUserId, setShownUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PROFILE_PREFERENCES);

  const identityFromProfile = (p: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    banner_url?: string | null;
    role?: string | null;
    secondary_role?: string | null;
  }): PublicProfileIdentity => {
    const displayName = p.display_name || p.username;
    const initials = displayName.split(/[\s_.-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return {
      displayName,
      username: p.username.startsWith("@") ? p.username : `@${p.username}`,
      initials: initials || "?",
      tagline: "",
      profileType: "creator",
      mainRole: p.role ?? undefined,
      secondaryRole: p.secondary_role ?? undefined,
      avatarUrl: p.avatar_url ?? undefined,
      bannerUrl: p.banner_url ?? undefined,
    };
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!supabase) return;
        if (publicLocked) {
          // Profil d'un AUTRE utilisateur : on le résout par pseudo.
          const slug = profileId ?? identity.username;
          const other = slug ? await getProfileByUsername(slug) : null;
          if (cancelled) return;
          if (other) {
            setShownUserId(other.id);
            setLiveIdentity(identityFromProfile(other));
            setProfileType(other.role === "Créateur de contenu" ? "content" : "creator");
          } else {
            setShownUserId(null); // profil introuvable en base → contenu vide
          }
          return;
        }
        // Mode own : identité de l'utilisateur connecté.
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user || cancelled) return;
        setShownUserId(user.id);
        let { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, banner_url, role, secondary_role")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) {
          const fallback = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url, role, secondary_role")
            .eq("id", user.id)
            .maybeSingle();
          profileRow = fallback.data;
        }
        if (profileRow) {
          setLiveIdentity(identityFromProfile(profileRow));
          setProfileType(profileRow.role === "Créateur de contenu" ? "content" : "creator");
          return;
        }
        const meta = user.user_metadata as Record<string, string | undefined>;
        const username = meta?.username || user.email?.split("@")[0] || "utilisateur";
        const displayName = meta?.display_name || meta?.full_name || username;
        const initials = displayName.split(/[\s_.-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        setLiveIdentity({
          displayName,
          username: username.startsWith("@") ? username : `@${username}`,
          initials: initials || "?",
          tagline: "",
          profileType: "creator",
          avatarUrl: meta?.avatar_url,
          bannerUrl: meta?.banner_url,
        });
        const { data: row } = await supabase.from("profiles").select("role, secondary_role").eq("id", user.id).single();
        if (!cancelled && row?.role) {
          setProfileType(row.role === "Créateur de contenu" ? "content" : "creator");
          setLiveIdentity((current) => current ? {
            ...current,
            mainRole: row.role,
            secondaryRole: row.secondary_role ?? undefined,
          } : current);
        }
      } catch {
        /* identité par défaut conservée */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicLocked, identityRefreshKey, profileId, identity.username]);

  const baseIdentity = liveIdentity ?? identity;
  const effectiveIdentity = {
    ...baseIdentity,
    tagline: preferences.bio || baseIdentity.tagline,
    languages: preferences.languages,
  };
  const effectiveMainRole =
    effectiveIdentity.mainRole ??
    (profileType === "content" ? "Créateur de contenu" : "Dessinateur");
  const effectiveSecondaryRole = effectiveIdentity.secondaryRole;

  // Tous les contenus affichés proviennent de Supabase.
  const [myIllustrations, setMyIllustrations] = useState<DbIllustration[]>([]);
  const [myAnnouncements, setMyAnnouncements] = useState<DbAnnouncement[]>([]);
  const [myIdeas, setMyIdeas] = useState<DbIdea[]>([]);
  const [myProjects, setMyProjects] = useState<StudioProjectLite[]>([]);
  const [myOptions, setMyOptions] = useState<SponsorOption[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const refreshOwnContent = () => {
    void (async () => {
      const uid = publicLocked ? shownUserId : await currentUserId().catch(() => null);
      if (uid) {
        void listIllustrations().then((rows) => setMyIllustrations(rows.filter((r) => r.author_id === uid))).catch(() => {});
        void listAnnouncements().then((rows) => setMyAnnouncements(rows.filter((r) => r.author_id === uid))).catch(() => {});
        void listIdeas().then((rows) => setMyIdeas(rows.filter((r) => r.author_id === uid))).catch(() => {});
      } else {
        setMyIllustrations([]);
        setMyAnnouncements([]);
        setMyIdeas([]);
      }
      if (publicLocked) {
        if (uid) {
          void loadProfileStudioProjects<StudioProjectLite>(uid)
            .then(setMyProjects)
            .catch(() => setMyProjects([]));
          void listSponsorOptions(uid)
            .then((options) => setMyOptions(options.filter((option) => option.mode === "creator")))
            .catch(() => setMyOptions([]));
        }
        setFavorites([]);
        return;
      }
      void loadStudioProjects<StudioProjectLite>().then(setMyProjects).catch(() => {});
      void listSponsorOptions()
        .then((options) => setMyOptions(options.filter((o) => o.mode === "creator")))
        .catch(() => setMyOptions([]));
      void listFavorites().then(setFavorites).catch(() => setFavorites([]));
    })();
  };

  // Recharge quand l'id du profil affiché est connu (public : après résolution).
  useEffect(refreshOwnContent, [shownUserId, publicLocked]);
  const [editOpen, setEditOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<null | { title: string; kind: string; source: "own" | "favorite" }>(null);
  const [addOpen, setAddOpen] = useState<AddKind | null>(null);
  const [editSponsorship, setEditSponsorship] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState<ProfileWorkflow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadProfilePreferences(shownUserId)
      .then((value) => {
        if (!cancelled) setPreferences(value);
      })
      .catch(() => {
        if (!cancelled) setPreferences(DEFAULT_PROFILE_PREFERENCES);
      });
    return () => {
      cancelled = true;
    };
  }, [shownUserId]);

  const updatePreferences = (next: ProfilePreferences) => {
    setPreferences(next);
    if (!publicLocked) {
      void saveProfilePreferences(next, shownUserId).catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : "Le profil n'a pas pu être enregistré.");
      });
    }
  };

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showFeedback("Lien du profil copié.");
    } catch {
      showFeedback("Impossible de copier le lien.");
    }
  };

  const available = preferences.available;

  const openConversation = async () => {
    if (contacting) return;
    if (!shownUserId) {
      setFeedback("Ce profil ne peut pas encore être contacté.");
      return;
    }
    setContacting(true);
    try {
      const conversation = await startConversationWith(shownUserId);
      await navigate({ to: "/messages", search: { conversation } });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Impossible d'ouvrir la conversation.");
      window.setTimeout(() => setFeedback(null), 3200);
    } finally {
      setContacting(false);
    }
  };

  const tabs = useMemo(() => {
    const base =
      profileType === "creator"
        ? [
            { id: "overview", label: "Overview" },
            { id: "projects", label: "Projects" },
            { id: "illustrations", label: "Illustrations" },
            { id: "propositions", label: "Idées" },
            { id: "announcements", label: "Announcements" },
          ]
        : [
            { id: "overview", label: "Overview" },
            { id: "sponsorship", label: "Sponsorship" },
            { id: "illustrations", label: "Illustrations" },
            { id: "announcements", label: "Announcements" },
            { id: "projects", label: "Projects Promoted" },
            { id: "propositions", label: "Idées" },
          ];
    if (mode === "own") base.push({ id: "friends", label: "Amis" }, { id: "favorites", label: "Favoris" }, { id: "account", label: "Account" });
    return base;
  }, [profileType, mode]);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#050B1D", color: "#F7FAFF" }}>
      <div
        className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8 lg:px-8"
        style={{ fontFamily: "var(--font-manrope)" }}
      >

        <ProfileHeader
          profileType={profileType}
          mode={mode}
          identity={effectiveIdentity}
          mainRole={effectiveMainRole}
          secondaryRole={effectiveSecondaryRole}
          onEdit={() => setEditOpen(true)}
          onAdd={setAddOpen}
          available={available}
          onAvailabilityChange={(value) => updatePreferences({ ...preferences, available: value })}
          onCopyLink={() => void copyProfileLink()}
          onInvite={() => setWorkflowOpen("invite")}
          onPatronage={() => setWorkflowOpen("patronage")}
          onFollow={() => setWorkflowOpen("follow")}
          onFriend={() => setWorkflowOpen("friend")}
          onMessage={() => void openConversation()}
          contacting={contacting}
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
                  identity={effectiveIdentity}
                  mainRole={effectiveMainRole}
                  secondaryRole={effectiveSecondaryRole}
                  available={available}
                  visibility={preferences.visibility}
                  sponsorshipStatus={preferences.sponsorshipStatus}
                  options={myOptions}
                  onAdd={setAddOpen}
                  projects={myProjects}
                  onDetails={(t, k) => setDetailsOpen({ title: t, kind: k, source: "own" })}
                  onOpenProject={(id) => void navigate({ to: "/studio", search: { project: id, chapter: undefined } })}
                  onEditSponsorship={setEditSponsorship}
                />
              </Tabs.Content>
              <Tabs.Content value="projects">
                <ProjectsTab
                  profileType={profileType}
                  mode={mode}
                  projects={myProjects}
                  onAdd={() => setAddOpen("project")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Project", source: "own" })}
                  onOpenProject={(id) => void navigate({ to: "/studio", search: { project: id, chapter: undefined } })}
                />
              </Tabs.Content>
              <Tabs.Content value="illustrations">
                <IllustrationsTab
                  mode={mode}
                  illustrations={myIllustrations}
                  onAdd={() => setAddOpen("illustration")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Illustration", source: "own" })}
                />
              </Tabs.Content>
              <Tabs.Content value="propositions">
                <PropositionsTab
                  mode={mode}
                  ideas={myIdeas}
                  onAdd={() => setAddOpen("proposition")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Idée", source: "own" })}
                />
              </Tabs.Content>
              <Tabs.Content value="announcements">
                <AnnouncementsTab
                  mode={mode}
                  announcements={myAnnouncements}
                  onAdd={() => setAddOpen("announcement")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Announcement", source: "own" })}
                />
              </Tabs.Content>
              <Tabs.Content value="sponsorship">
                <SponsorshipTab
                  mode={mode}
                  options={myOptions}
                  onAdd={() => setAddOpen("sponsorship")}
                  onDetails={(t) => setDetailsOpen({ title: t, kind: "Sponsorship option", source: "own" })}
                  onManage={setEditSponsorship}
                />
              </Tabs.Content>
              {mode === "own" && (
                <>
                  <Tabs.Content value="friends">
                    <ProfileFriendsTab />
                  </Tabs.Content>
                  <Tabs.Content value="favorites">
                    <FavoritesTab favorites={favorites} onDetails={(t, k) => setDetailsOpen({ title: t, kind: k, source: "favorite" })} />
                  </Tabs.Content>
                  <Tabs.Content value="account">
                    <AccountTab
                      identity={effectiveIdentity}
                      preferences={preferences}
                      onPreferencesChange={updatePreferences}
                      onIdentityChange={() => setIdentityRefreshKey((k) => k + 1)}
                      onFeedback={showFeedback}
                    />
                  </Tabs.Content>
                </>
              )}
            </div>
          </Tabs.Root>
        </div>
      </div>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profileType={profileType}
        identity={effectiveIdentity}
        preferences={preferences}
        onPreferencesChange={updatePreferences}
        onIdentityChange={() => setIdentityRefreshKey((k) => k + 1)}
        onProfileTypeChange={setProfileType}
      />
      <DetailsModal
        open={!!detailsOpen}
        onClose={() => setDetailsOpen(null)}
        title={detailsOpen?.title ?? ""}
        kind={detailsOpen?.kind ?? ""}
        source={detailsOpen?.source ?? "own"}
        mode={mode}
        illustration={myIllustrations.find((i) => i.title === detailsOpen?.title)}
        idea={myIdeas.find((i) => i.title === detailsOpen?.title)}
        announcement={myAnnouncements.find((a) => a.title === detailsOpen?.title)}
        option={myOptions.find((o) => o.format === detailsOpen?.title)}
        project={myProjects.find((p) => p.title === detailsOpen?.title)}
        onEdit={(t) => {
          setDetailsOpen(null);
          setEditSponsorship(t);
        }}
      />
      <AddSponsorshipModal
        open={addOpen === "sponsorship" || editSponsorship !== null}
        editTitle={editSponsorship}
        ownerName={effectiveIdentity.displayName}
        onCreated={refreshOwnContent}
        onClose={() => {
          setAddOpen(null);
          setEditSponsorship(null);
        }}
      />
      <AddAnnouncementModal open={addOpen === "announcement"} onClose={() => setAddOpen(null)} onCreated={refreshOwnContent} />
      <AddIllustrationModal open={addOpen === "illustration"} onClose={() => setAddOpen(null)} onCreated={refreshOwnContent} />
      <AddPropositionModal open={addOpen === "proposition"} onClose={() => setAddOpen(null)} onCreated={refreshOwnContent} />
      <AddProjectModal open={addOpen === "project"} onClose={() => setAddOpen(null)} onCreated={refreshOwnContent} />
      {workflowOpen && (
        <ProfileWorkflowModal
          type={workflowOpen}
          profileType={profileType}
          profileName={effectiveIdentity.displayName}
          recipientId={shownUserId}
          onClose={() => setWorkflowOpen(null)}
          onDone={(message) => {
            setWorkflowOpen(null);
            setFeedback(message);
            window.setTimeout(() => setFeedback(null), 3200);
          }}
        />
      )}
      {feedback && <ProfileToast>{feedback}</ProfileToast>}

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

/* ---------------- Header ---------------- */

function ProfileHeader({
  profileType,
  mode,
  identity,
  mainRole,
  secondaryRole,
  onEdit,
  onAdd,
  available,
  onAvailabilityChange,
  onCopyLink,
  onInvite,
  onPatronage,
  onFollow,
  onFriend,
  onMessage,
  contacting,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  identity: PublicProfileIdentity;
  mainRole: string;
  secondaryRole?: string;
  onEdit: () => void;
  onAdd: (kind: AddKind) => void;
  available: boolean;
  onAvailabilityChange: (available: boolean) => void;
  onCopyLink: () => void;
  onInvite: () => void;
  onPatronage: () => void;
  onFollow: () => void;
  onFriend: () => void;
  onMessage: () => void;
  contacting: boolean;
}) {
  const languages = identity.languages ?? (mode === "own" ? ["EN", "FR", "JP"] : []);
  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-[22px]"
        style={{
          height: 240,
          background: identity.bannerUrl
            ? `url(${identity.bannerUrl}) center/cover no-repeat`
            : "linear-gradient(135deg, #060D24 0%, #0B1430 50%, #101B3F 100%)",
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
            className="grid shrink-0 place-items-center overflow-hidden rounded-full"
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
            {identity.avatarUrl ? (
              <img src={identity.avatarUrl} alt={identity.displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="cm-sora text-[36px] font-bold" style={{ color: "#F7FAFF" }}>
                {identity.initials}
              </span>
            )}
          </div>
          <div className="min-w-0 pt-14 md:pt-16">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1
                className="cm-sora truncate text-[24px] font-bold leading-8 md:text-[30px] md:leading-[38px]"
                style={{ color: "#F7FAFF" }}
              >
                {identity.displayName}
              </h1>
              <span className="text-[13px] font-semibold" style={{ color: "#7F8CB3" }}>
                {identity.username}
              </span>
            </div>
            <p className="mt-1 text-[13px] font-medium leading-5" style={{ color: "#B8C4E5" }}>
              {identity.tagline}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="active" icon={<Sparkles size={12} />}>
                {mainRole}
              </Chip>
              {secondaryRole && secondaryRole !== mainRole ? <Chip>{secondaryRole}</Chip> : null}
              {mode === "own" ? (
                <AvailabilitySwitch available={available} onChange={onAvailabilityChange} />
              ) : (
                <Chip tone={available ? "active" : "neutral"}>{available ? "Available" : "Unavailable"}</Chip>
              )}
              {languages.length ? (
                <Chip tone="info" icon={<Globe2 size={12} />}>{languages.join(" · ")}</Chip>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2 md:col-span-1 md:justify-end md:pt-16">
          {mode === "own" ? (
            <>
              <PrimaryButton icon={<Edit3 size={16} />} onClick={onEdit}>
                Edit Profile
              </PrimaryButton>
              <CreateDropdown profileType={profileType} onSelect={onAdd} />
              <GhostButton icon={<Link2 size={16} />} onClick={onCopyLink}>Copy Link</GhostButton>
            </>
          ) : profileType === "content" ? (
            <>
              <PrimaryButton icon={<Send size={16} />} onClick={onPatronage}>Propose Sponsorship</PrimaryButton>
              <SecondaryButton icon={<MessageSquare size={16} />} onClick={onMessage}>{contacting ? "Ouverture…" : "Message"}</SecondaryButton>
              <SecondaryButton icon={<Check size={16} />} onClick={onFollow}>S'abonner</SecondaryButton>
              <GhostButton icon={<Users size={16} />} onClick={onFriend}>Ajouter ami</GhostButton>
            </>
          ) : (
            <>
              <PrimaryButton icon={<Users size={16} />} onClick={onInvite}>Invite to Project</PrimaryButton>
              <SecondaryButton icon={<MessageSquare size={16} />} onClick={onMessage}>{contacting ? "Ouverture…" : "Message"}</SecondaryButton>
              <SecondaryButton icon={<Check size={16} />} onClick={onFollow}>S'abonner</SecondaryButton>
              <GhostButton icon={<Users size={16} />} onClick={onFriend}>Ajouter ami</GhostButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateDropdown({ profileType, onSelect }: { profileType: ProfileType; onSelect: (kind: AddKind) => void }) {
  const items = [
    { label: "Create Project", kind: "project" as const },
    profileType === "content" ? { label: "Add service", kind: "sponsorship" as const } : null,
    { label: "Upload Illustration", kind: "illustration" as const },
    { label: "Create Collaboration Announcement", kind: "announcement" as const },
    { label: "Create Idea", kind: "proposition" as const },
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

function AvailabilitySwitch({
  available,
  onChange,
}: {
  available: boolean;
  onChange: (available: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      onClick={() => onChange(!available)}
      className="inline-flex items-center gap-3 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
      style={{
        background: available ? "rgba(57,255,136,0.12)" : "#0E193A",
        border: `1px solid ${available ? "rgba(57,255,136,0.45)" : "rgba(133,154,206,0.22)"}`,
        color: available ? "#39FF88" : "#B8C4E5",
      }}
    >
      <span>{available ? "Available" : "Unavailable"}</span>
      <span
        className="relative inline-flex h-5 w-9 rounded-full transition-colors"
        style={{ background: available ? "rgba(57,255,136,0.38)" : "#101B3F" }}
      >
        <span
          className="absolute top-[2px] h-4 w-4 rounded-full transition-all"
          style={{
            left: available ? 18 : 2,
            background: available ? "#39FF88" : "#B8C4E5",
          }}
        />
      </span>
    </button>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({
  profileType,
  mode,
  identity,
  mainRole,
  secondaryRole,
  available,
  visibility,
  sponsorshipStatus,
  onAdd,
  onDetails,
  options,
  projects,
  onOpenProject,
  onEditSponsorship,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  identity: PublicProfileIdentity;
  mainRole: string;
  secondaryRole?: string;
  available: boolean;
  visibility: string;
  sponsorshipStatus: string;
  onAdd: (kind: AddKind) => void;
  onDetails: (title: string, kind: string) => void;
  options?: SponsorOption[];
  projects?: StudioProjectLite[];
  onOpenProject: (id: string) => void;
  onEditSponsorship: (title: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <BioPanel
          profileType={profileType}
          mode={mode}
          identity={identity}
          mainRole={mainRole}
          secondaryRole={secondaryRole}
          available={available}
          visibility={visibility}
          sponsorshipStatus={sponsorshipStatus}
        />
      </div>
      <div className="lg:col-span-2 space-y-6">
        {profileType === "creator" ? (
          <ProjectShowcase projects={projects} mode={mode} onAdd={() => onAdd("project")} onDetails={(t) => onDetails(t, "Project")} onOpenProject={onOpenProject} />
        ) : (
          <SponsorshipShowcase mode={mode} options={options} onAdd={() => onAdd("sponsorship")} onDetails={(t) => onDetails(t, "Sponsorship option")} onManage={onEditSponsorship} />
        )}
      </div>
    </div>
  );
}

function BioPanel({
  profileType,
  mode,
  identity,
  mainRole,
  secondaryRole,
  available,
  visibility,
  sponsorshipStatus,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  identity: PublicProfileIdentity;
  mainRole: string;
  secondaryRole?: string;
  available: boolean;
  visibility: string;
  sponsorshipStatus: string;
}) {
  const publicBio = identity.tagline.trim() || "Cet utilisateur n'a pas encore renseigné sa bio.";
  const languages = identity.languages ?? (mode === "own" ? ["English", "French", "Japanese"] : []);
  return (
    <Panel>
      <SectionTitle title="About" />
      <p className="text-[14px] leading-[22px]" style={{ color: "#B8C4E5" }}>
        {publicBio}
      </p>

      <div className="mt-6 space-y-4">
        {languages.length ? (
          <InfoRow label="Languages">
            {languages.map((language) => <Chip key={language} tone="info">{language}</Chip>)}
          </InfoRow>
        ) : null}
        <InfoRow label="Main role">
          <Chip tone="active">{mainRole}</Chip>
          {secondaryRole && secondaryRole !== mainRole ? <Chip>{secondaryRole}</Chip> : null}
        </InfoRow>
        <InfoRow label="Availability">
          <Chip tone={available ? "active" : "neutral"}>{available ? "Open to collaborations" : "Unavailable"}</Chip>
        </InfoRow>
        {profileType === "content" && mode === "own" ? (
          <InfoRow label="Sponsorships"><Chip tone="active">{sponsorshipStatus}</Chip></InfoRow>
        ) : null}

        {mode === "own" && (
          <InfoRow label="Profile visibility">
            <Chip tone="active">{visibility}</Chip>
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

function ProjectShowcase({ projects = [], mode, onAdd, onDetails, onOpenProject }: { projects?: StudioProjectLite[]; mode: ViewMode; onAdd: () => void; onDetails: (title: string) => void; onOpenProject: (id: string) => void }) {

  return (
    <Panel>
      <SectionTitle
        title="Projects"
        subtitle="Manga projects this user created, joined, or contributed to."
        action={
          mode === "own" && (
            <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Project</SecondaryButton>
          )
        }
      />
      <div className="space-y-4">
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" text="Les projets créés dans le Studio apparaîtront ici." />
        ) : projects.slice(0, 3).map((p) => (
          <ProjectCard
            key={p.id}
            project={{
              title: p.title,
              description: p.synopsis,
              coverUrl: p.coverDataUrl ?? p.coverUrl,
              role: "Propriétaire",
              status: p.status,
              chapters: `${p.chapters.length} chapitre${p.chapters.length > 1 ? "s" : ""}`,
            }}
            onDetails={() => onDetails(p.title)}
            onOpen={() => onOpenProject(p.id)}
          />
        ))}
      </div>
    </Panel>
  );
}

function ProjectCard({
  project,
  onDetails,
  onOpen = onDetails,
}: {
  project: { title: string; description?: string; coverUrl?: string; role: string; status: string; chapters: string };
  onDetails: () => void;
  onOpen?: () => void;
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
          {project.coverUrl ? <img src={project.coverUrl} alt={project.title} className="h-full w-full object-cover" /> : <ImageIcon size={22} color="#5E6A90" />}
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
            {project.description || "Synopsis à compléter."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip>Role · {project.role}</Chip>
            <Chip>{project.chapters}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:flex-col sm:items-stretch sm:justify-center">
          <PrimaryButton icon={<BookOpen size={16} />} onClick={onOpen}>View Project</PrimaryButton>
          <SecondaryButton onClick={onDetails}>View Details</SecondaryButton>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Sponsorship showcase ---------------- */

function SponsorshipShowcase({ mode, options, onAdd, onDetails, onManage }: { mode: ViewMode; options?: SponsorOption[]; onAdd: () => void; onDetails: (title: string) => void; onManage: (title: string) => void }) {
  const cards = options ?? [];
  return (
    <Panel>
      <SectionTitle
        title="Sponsorship Options"
        subtitle="Services this creator offers to promote manga projects."
        action={
          mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>Add service</SecondaryButton>
        }
      />
      {cards.length === 0 ? (
        <EmptyState title="No services yet" text="Les services de parrainage créés apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((o, i) => (
            <SponsorshipCard key={i} opt={o} mode={mode} onDetails={() => onDetails(o.format)} onManage={() => onManage(o.format)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function SponsorshipCard({
  opt,
  mode,
  onDetails,
  onManage,
}: {
  opt: SponsorOption;
  mode: ViewMode;
  onDetails: () => void;
  onManage: () => void;
}) {
  return (
    <Card padding={20}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-extrabold leading-[22px]" style={{ color: "#F7FAFF" }}>
            {opt.format}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
            {opt.description || "Service de parrainage."}
          </p>
        </div>
        <IconButton label="Save" onClick={() => void addFavorite("Sponsorship option", opt.format)}><Check size={16} /></IconButton>
      </div>

      <div className="mt-4">
        <MetaLabel>Price</MetaLabel>
        <div
          className="cm-sora mt-1 text-[24px] font-extrabold leading-none"
          style={{ color: "#39FF88" }}
        >
          €{opt.price}
        </div>
      </div>

      <div className="mt-4">
        <MetaLabel>Platforms</MetaLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {opt.platforms.map((platform) => <Chip key={platform}>{platform}</Chip>)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <MetaLabel>Type</MetaLabel>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{opt.format}</div>
        </div>
        <div>
          <MetaLabel>Video</MetaLabel>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{opt.videoType}</div>
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
          <PrimaryButton icon={<Edit3 size={16} />} onClick={onManage}>Manage</PrimaryButton>
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
  projects,
  onAdd,
  onDetails,
  onOpenProject,
}: {
  profileType: ProfileType;
  mode: ViewMode;
  projects?: StudioProjectLite[];
  onAdd: () => void;
  onDetails: (title: string) => void;
  onOpenProject: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  // Projets réels créés dans le Studio (IndexedDB).
  const projectCards = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    role: "Propriétaire",
    status: p.status,
    description: p.synopsis,
    coverUrl: p.coverDataUrl ?? p.coverUrl,
    chapters: `${p.chapters.length} chapitre${p.chapters.length > 1 ? "s" : ""}`,
  }));
  const visibleProjects = projectCards.filter((project) => {
    const matchesQuery = project.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesStatus = statusFilter === "Tous" || project.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

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
            <input className="cm-input" style={{ height: 40, width: 180 }} placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><SecondaryButton>Filters</SecondaryButton></DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[180px] rounded-[14px] p-1.5" style={{ background: "#0B1430", border: "1px solid rgba(133,154,206,0.28)" }}>
                  {["Tous", ...Array.from(new Set(projectCards.map((project) => project.status)))].map((status) => (
                    <DropdownMenu.Item key={status} onSelect={() => setStatusFilter(status)} className="cursor-pointer rounded-[10px] px-3 py-2 text-[13px] font-semibold outline-none data-[highlighted]:bg-white/5" style={{ color: status === statusFilter ? "#39FF88" : "#B8C4E5" }}>
                      {status}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Project</SecondaryButton>}
          </div>
        }
      />
      {visibleProjects.length === 0 ? (
        <EmptyState title={projectCards.length ? "Aucun résultat" : "No projects yet"} text={projectCards.length ? "Modifie la recherche ou le filtre actif." : "Les projets créés dans le Studio apparaîtront ici."} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleProjects.map((p, i) => (
            <ProjectCard key={p.id || i} project={p} onDetails={() => onDetails(p.title)} onOpen={() => onOpenProject(p.id)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function IllustrationsTab({ mode, illustrations, onDetails, onAdd }: { mode: ViewMode; illustrations?: DbIllustration[]; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = illustrations ?? [];
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
          {items.map((illustration) => (
            <IllustrationCard
              key={illustration.id}
              mode={mode}
              title={illustration.title}
              subtitle={illustration.description || "Illustration"}
              imageUrl={illustration.image_url}
              onDetails={() => onDetails(illustration.title)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function IllustrationCard({
  mode,
  title,
  subtitle,
  imageUrl,
  onDetails,
}: {
  mode: ViewMode;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onDetails: () => void;
}) {
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
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Palette size={28} color="#5E6A90" />
        )}
      </div>
      <div className="mt-3">
        <h3 className="truncate text-[15px] font-extrabold" style={{ color: "#F7FAFF" }}>
          {title}
        </h3>
        <p className="mt-0.5 truncate text-[12px] font-semibold" style={{ color: "#7F8CB3" }}>
          {subtitle || "Illustration"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone="active">Publiée</Chip>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SecondaryButton onClick={onDetails} full>
          View Details
        </SecondaryButton>
        {mode === "own" ? (
          <IconButton label="Details" onClick={onDetails}><Eye size={16} /></IconButton>
        ) : (
          <IconButton label="Save" onClick={() => void addFavorite("Illustration", title)}><Check size={16} /></IconButton>
        )}
      </div>
    </Card>
  );
}

function PropositionsTab({ mode, ideas, onDetails, onAdd }: { mode: ViewMode; ideas?: DbIdea[]; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = ideas ?? [];
  return (
    <Panel>
      <SectionTitle
        title="Idées"
        subtitle="Story ideas, arcs and creative pitches shared by this creator."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Idea</SecondaryButton>}
      />
      {items.length === 0 ? (
        <EmptyState title="No ideas yet" text="Les idées publiées apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((idea) => (
            <Card key={idea.id}>
              <div className="flex items-start justify-between gap-2">
                <Chip tone="info">{idea.category || "Idée"}</Chip>
                {idea.image_url && <Chip>Image incluse</Chip>}
              </div>
              <h3 className="mt-3 text-[16px] font-extrabold" style={{ color: "#F7FAFF" }}>
                {idea.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
                {idea.description}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <SecondaryButton onClick={() => onDetails(idea.title)}>View Details</SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Onglet Amis : demandes reçues (accepter/refuser) + liste des amis réels. */
function ProfileFriendsTab() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<DbFriendRequest[]>([]);
  const [friends, setFriends] = useState<DbProfile[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = () => {
    void listPendingFriendRequests().then(setPending).catch(() => setPending([]));
    void listFriendsDb().then(setFriends).catch(() => setFriends([]));
  };
  useEffect(refresh, []);

  const respond = async (id: string, accept: boolean) => {
    try {
      await respondFriendRequestDb(id, accept);
      setFeedback(accept ? "Demande acceptée — vous êtes amis." : "Demande refusée.");
      refresh();
      window.setTimeout(() => setFeedback(null), 2600);
    } catch {
      setFeedback("Action impossible.");
    }
  };

  const contact = async (profileId: string) => {
    try {
      const conversation = await startConversationWith(profileId);
      void navigate({ to: "/messages", search: { conversation } });
    } catch {
      setFeedback("Impossible d'ouvrir la conversation.");
    }
  };

  return (
    <Panel>
      <SectionTitle title="Amis" subtitle="Demandes reçues et liste de tes amis CollabManga." />
      {feedback && (
        <div className="mb-4 rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.4)", color: "#39FF88" }}>
          {feedback}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[14px] font-extrabold" style={{ color: "#F7FAFF" }}>Demandes en attente</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pending.map((r) => {
              const p = r.initiator;
              const name = p?.display_name || p?.username || "Membre";
              return (
                <Card key={r.id}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "#101B3F", border: "1px solid rgba(133,154,206,0.22)" }}>
                      {p?.avatar_url ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" /> : <span className="text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{name}</p>
                      <p className="text-[12px]" style={{ color: "#7F8CB3" }}>souhaite devenir ami</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <PrimaryButton onClick={() => void respond(r.id, true)}>Accepter</PrimaryButton>
                    <SecondaryButton onClick={() => void respond(r.id, false)}>Refuser</SecondaryButton>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {friends.length === 0 ? (
        <EmptyState title="Aucun ami pour l'instant" text="Envoie des demandes d'ami depuis la page Discover — elles apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {friends.map((p) => {
            const name = p.display_name || p.username;
            return (
              <Card key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => void navigate({ to: "/profile/$profileId", params: { profileId: p.username } })}
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "#101B3F", border: "1px solid rgba(133,154,206,0.22)" }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" /> : <span className="text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{name.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{name}</p>
                    <p className="truncate text-[12px]" style={{ color: "#7F8CB3" }}>@{p.username}</p>
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <PrimaryButton icon={<MessageSquare size={16} />} onClick={() => void contact(p.id)}>Contacter</PrimaryButton>
                  <SecondaryButton onClick={() => void navigate({ to: "/profile/$profileId", params: { profileId: p.username } })}>Voir le profil</SecondaryButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function FavoritesTab({ favorites, onDetails }: { favorites?: Favorite[]; onDetails: (title: string, kind: string) => void }) {
  // Favoris réels (store local) — chaque publication créée y est ajoutée.
  const all = favorites ?? [];
  const byKind = (kind: string) => all.filter((f) => f.kind === kind).map((f) => f.title);
  const groups: { title: string; kind: string; items: string[] }[] = [
    { title: "Annonces", kind: "Announcement", items: byKind("Announcement") },
    { title: "Idées", kind: "Idée", items: byKind("Idée") },
    { title: "Illustrations", kind: "Illustration", items: byKind("Illustration") },
    { title: "Parrainages", kind: "Sponsorship option", items: byKind("Sponsorship option") },
    { title: "Projets", kind: "Project", items: byKind("Project") },
  ];

  return (
    <Panel>
      <SectionTitle
        title="Favoris"
        subtitle="Elements sauvegardes, separes par categorie pour les retrouver rapidement."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-extrabold" style={{ color: "#F7FAFF" }}>{group.title}</h3>
              <Chip tone="info">{group.items.length}</Chip>
            </div>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-[14px] border px-3 py-3"
                  style={{ borderColor: "rgba(133,154,206,0.18)", background: "#0E193A" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{item}</p>
                    <p className="mt-0.5 text-[12px] font-semibold" style={{ color: "#7F8CB3" }}>{group.kind}</p>
                  </div>
                  <SecondaryButton onClick={() => onDetails(item, group.kind)}>Details</SecondaryButton>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function AnnouncementsTab({ mode, announcements, onDetails, onAdd }: { mode: ViewMode; announcements?: DbAnnouncement[]; onDetails: (title: string) => void; onAdd: () => void }) {
  const items = announcements ?? [];
  return (
    <Panel>
      <SectionTitle
        title="Announcements"
        subtitle="Open collaboration calls and availability posts."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>New Announcement</SecondaryButton>}
      />
      {items.length === 0 ? (
        <EmptyState title="No announcements yet" text="Les annonces publiées apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((it) => (
            <Card key={it.id}>
              <div className="flex items-start justify-between gap-2">
                <Chip tone={it.mode === "project" ? "info" : "active"}>
                  {it.mode === "project" ? "Project seeks partner" : "User seeks project"}
                </Chip>
                <Chip tone="warning">Recruiting</Chip>
              </div>
              <h3 className="mt-3 text-[16px] font-extrabold" style={{ color: "#F7FAFF" }}>
                {it.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5" style={{ color: "#B8C4E5" }}>
                {it.hook || it.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {it.status_sought && <Chip>Role · {it.status_sought}</Chip>}
                <Chip>{it.language}</Chip>
                {it.genres.slice(0, 2).map((g) => (
                  <Chip key={g}>{g}</Chip>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <SecondaryButton onClick={() => onDetails(it.title)}>View Details</SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SponsorshipTab({ mode, options, onDetails, onAdd, onManage }: { mode: ViewMode; options?: SponsorOption[]; onDetails: (title: string) => void; onAdd: () => void; onManage: (title: string) => void }) {
  const cards = options ?? [];
  return (
    <Panel>
      <SectionTitle
        title="Sponsorship"
        subtitle="Services offered and sponsorship announcements."
        action={mode === "own" && <SecondaryButton icon={<Plus size={16} />} onClick={onAdd}>Add service</SecondaryButton>}
      />
      {cards.length === 0 ? (
        <EmptyState title="No services yet" text="Les services de parrainage créés apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((o, i) => (
            <SponsorshipCard key={i} opt={o} mode={mode} onDetails={() => onDetails(o.format)} onManage={() => onManage(o.format)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function AccountTab({
  identity,
  preferences,
  onPreferencesChange,
  onIdentityChange,
  onFeedback,
}: {
  identity: PublicProfileIdentity;
  preferences: ProfilePreferences;
  onPreferencesChange: (preferences: ProfilePreferences) => void;
  onIdentityChange?: () => void;
  onFeedback: (message: string) => void;
}) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [username, setUsername] = useState(identity.username);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    setDisplayName(identity.displayName);
    setUsername(identity.username);
  }, [identity.displayName, identity.username]);

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, []);

  const saveIdentity = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await persistProfileIdentity(displayName, username);
      onIdentityChange?.();
      onFeedback("Informations du profil enregistrées.");
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!supabase) return onFeedback("Supabase n'est pas configuré.");
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return onFeedback("Aucune adresse e-mail n'est associée à ce compte.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/profile` });
    onFeedback(error ? error.message : "E-mail de réinitialisation envoyé.");
  };

  const logout = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const saveMainRole = async (role: string) => {
    try {
      await updateMyRole(role);
      onIdentityChange?.();
      onFeedback("Rôle principal enregistré.");
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : "Modification du rôle impossible.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <SectionTitle title="Identity" subtitle="Public display information." />
        <div className="space-y-3">
          <Field label="Display name"><input className="cm-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
          <Field label="Username"><input className="cm-input" value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Avatar"><MediaUploadButton kind="avatar" onDone={onIdentityChange} /></Field>
            <Field label="Banner"><MediaUploadButton kind="banner" onDone={onIdentityChange} /></Field>
          </div>
          <PrimaryButton full onClick={() => void saveIdentity()}>{saving ? "Enregistrement…" : "Enregistrer l'identité"}</PrimaryButton>
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="Profile information" subtitle="Roles, languages and preferences." />
        <div className="space-y-3">
          <Field label="Bio"><textarea className="cm-textarea" placeholder="Bio to complete." value={preferences.bio} onChange={(event) => onPreferencesChange({ ...preferences, bio: event.target.value })} /></Field>
          <Field label="Main role">
            <ProfileSelect defaultValue={identity.mainRole ?? "Dessinateur"} options={PROFILE_ROLES} onChange={(role) => void saveMainRole(role)} />
          </Field>
          <Field label="Languages">
            <LanguageMultiSelect values={preferences.languages} onChange={(languages) => onPreferencesChange({ ...preferences, languages })} />
          </Field>
          <AvailabilityEditToggle available={preferences.available} onChange={(available) => onPreferencesChange({ ...preferences, available })} />
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="Content settings" subtitle="What appears on your public profile." />
        <div className="space-y-3">
          <ToggleRow label="Show projects" checked={preferences.showProjects} onChange={(showProjects) => onPreferencesChange({ ...preferences, showProjects })} />
          <ToggleRow label="Show illustrations" checked={preferences.showIllustrations} onChange={(showIllustrations) => onPreferencesChange({ ...preferences, showIllustrations })} />
          <ToggleRow label="Show ideas" checked={preferences.showIdeas} onChange={(showIdeas) => onPreferencesChange({ ...preferences, showIdeas })} />
          <ToggleRow label="Show sponsorship options" checked={preferences.showSponsorships} onChange={(showSponsorships) => onPreferencesChange({ ...preferences, showSponsorships })} />
          <ToggleRow label="Allow project invitations" checked={preferences.allowInvites} onChange={(allowInvites) => onPreferencesChange({ ...preferences, allowInvites })} />
          <ToggleRow label="Allow direct messages" checked={preferences.allowMessages} onChange={(allowMessages) => onPreferencesChange({ ...preferences, allowMessages })} />
        </div>
      </Panel>

      <Panel>
        <SectionTitle title="CollabManga AI plan" subtitle="Usage and billing." />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current plan" value="See details" />
          <Stat label="Credits" value="Live balance" />
          <Stat label="Usage" value="Current period" />
          <Stat label="Renewal" value="Billing page" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton onClick={() => void navigate({ to: "/ai/plan" })}>Manage plan</PrimaryButton>
          <SecondaryButton onClick={() => void navigate({ to: "/ai/history" })}>Usage history</SecondaryButton>
        </div>
      </Panel>

      <Panel className="lg:col-span-2">
        <SectionTitle title="Security" subtitle="Account access and notifications." />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Email"><input className="cm-input" value={email || "Adresse du compte connecté"} readOnly /></Field>
          <Field label="Password"><SecondaryButton full onClick={() => void sendPasswordReset()}>Change password</SecondaryButton></Field>
          <Field label="Notifications"><SecondaryButton full onClick={() => void navigate({ to: "/notifications" })}>Manage notifications</SecondaryButton></Field>
          <Field label="Session"><SecondaryButton full icon={<LogOut size={16} />} onClick={() => void logout()}>Se déconnecter</SecondaryButton></Field>
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

function ProfileSelect({
  options,
  defaultValue,
  onChange,
}: {
  options: readonly string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <select className="cm-input" defaultValue={defaultValue ?? options[0]} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function LanguageMultiSelect({ defaultValues = [], values, onChange }: { defaultValues?: string[]; values?: string[]; onChange?: (languages: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(values ?? defaultValues);
  useEffect(() => {
    if (values) setSelected(values);
  }, [values]);
  const toggle = (language: string) =>
    setSelected((prev) => {
      const next = prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language];
      onChange?.(next);
      return next;
    });
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {PROFILE_LANGUAGES.map((language) => {
          const active = selected.includes(language);
          return (
            <button
              key={language}
              type="button"
              onClick={() => toggle(language)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3.5 py-1.5 font-manrope text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cm-neon/50",
                active
                  ? "border-transparent bg-cm-neon text-[#04111e] shadow-[0_4px_14px_rgba(57,255,136,0.28)]"
                  : "border-[rgba(133,154,206,0.20)] bg-cm-input text-cm-text2 hover:border-[rgba(133,154,206,0.40)] hover:text-cm-text",
              )}
            >
              {language}
            </button>
          );
        })}
      </div>
      {selected.map((language) => (
        <input key={language} type="hidden" name="languages" value={language} />
      ))}
      <p className="mt-1.5 text-[11px] font-medium" style={{ color: "#7F8CB3" }}>
        Clique pour ajouter ou retirer une langue.
      </p>
    </>
  );
}

function AvailabilityEditToggle({
  available,
  onChange,
}: {
  available: boolean;
  onChange: (available: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold" style={{ color: "#B8C4E5" }}>Availability</div>
      <div
        className="flex items-center justify-between rounded-[14px] px-4 py-3"
        style={{ background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>
          {available ? "Available" : "Not available"}
        </span>
        <button
          type="button"
          onClick={() => onChange(!available)}
          role="switch"
          aria-checked={available}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{
            background: available ? "rgba(57,255,136,0.35)" : "#101B3F",
            border: `1px solid ${available ? "rgba(57,255,136,0.55)" : "rgba(133,154,206,0.28)"}`,
          }}
        >
          <span
            className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
            style={{
              left: available ? 22 : 2,
              background: available ? "#39FF88" : "#B8C4E5",
            }}
          />
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, defaultChecked, checked, onChange }: { label: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void }) {
  const [localOn, setLocalOn] = useState(!!defaultChecked);
  const on = checked ?? localOn;
  const toggle = () => {
    const next = !on;
    if (checked === undefined) setLocalOn(next);
    onChange?.(next);
  };
  return (
    <div
      className="flex items-center justify-between rounded-[14px] px-4 py-3"
      style={{ background: "#0E193A", border: "1px solid rgba(133,154,206,0.18)" }}
    >
      <span className="text-[13px] font-semibold" style={{ color: "#F7FAFF" }}>{label}</span>
      <button
        type="button"
        onClick={toggle}
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
  identity,
  preferences,
  onPreferencesChange,
  onIdentityChange,
  onProfileTypeChange,
}: {
  open: boolean;
  onClose: () => void;
  onIdentityChange?: () => void;
  profileType: ProfileType;
  identity: PublicProfileIdentity;
  preferences: ProfilePreferences;
  onPreferencesChange: (preferences: ProfilePreferences) => void;
  onProfileTypeChange?: (type: ProfileType) => void;
}) {
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [username, setUsername] = useState(identity.username);
  const [draftPreferences, setDraftPreferences] = useState(preferences);
  const [mainRole, setMainRole] = useState(profileType === "content" ? "Créateur de contenu" : "Dessinateur");
  const [secondaryRole, setSecondaryRole] = useState("Scénariste");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayName(identity.displayName);
    setUsername(identity.username);
    setDraftPreferences(preferences);
    setSaveError("");
    setMainRole(profileType === "content" ? "Créateur de contenu" : "Dessinateur");
    void getMyRoles().then((r) => {
      if (r.role) setMainRole(r.role);
      if (r.secondaryRole) setSecondaryRole(r.secondaryRole);
    });
  }, [open, profileType, identity.displayName, identity.username, preferences]);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await persistProfileIdentity(displayName, username);
      await updateMyRole(mainRole, secondaryRole);
      onPreferencesChange(draftPreferences);
      onIdentityChange?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Enregistrement impossible.");
      setSaving(false);
      return;
    }
    onProfileTypeChange?.(mainRole === "Créateur de contenu" ? "content" : "creator");
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Edit profile"
      width={840}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => void save()}>{saving ? "Enregistrement…" : "Save Changes"}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-8">
        <FormGroup title="Identity">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Display name"><input className="cm-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
            <Field label="Username"><input className="cm-input" value={username} onChange={(event) => setUsername(event.target.value)} /></Field>
            <Field label="Avatar"><MediaUploadButton kind="avatar" onDone={onIdentityChange} /></Field>
            <Field label="Banner"><MediaUploadButton kind="banner" onDone={onIdentityChange} /></Field>
          </div>
        </FormGroup>

        <FormGroup title="About">
          <Field label="Bio"><textarea className="cm-textarea" placeholder="Bio to complete." value={draftPreferences.bio} onChange={(event) => setDraftPreferences((current) => ({ ...current, bio: event.target.value }))} /></Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Spoken languages">
              <LanguageMultiSelect values={draftPreferences.languages} onChange={(languages) => setDraftPreferences((current) => ({ ...current, languages }))} />
            </Field>
            <AvailabilityEditToggle available={draftPreferences.available} onChange={(available) => setDraftPreferences((current) => ({ ...current, available }))} />
            <Field label="Main role">
              <ProfileSelect key={`main-${mainRole}`} defaultValue={mainRole} options={PROFILE_ROLES} onChange={setMainRole} />
            </Field>
            <Field label="Secondary role">
              <ProfileSelect key={`sec-${secondaryRole}`} defaultValue={secondaryRole} options={PROFILE_ROLES} onChange={setSecondaryRole} />
            </Field>
          </div>
        </FormGroup>

        <FormGroup title="Preferences">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Profile visibility">
              <ProfileSelect key={draftPreferences.visibility} defaultValue={draftPreferences.visibility} options={PROFILE_VISIBILITY_OPTIONS} onChange={(visibility) => setDraftPreferences((current) => ({ ...current, visibility }))} />
            </Field>
            {profileType === "content" && (
              <Field label="Sponsorship settings">
                <ProfileSelect key={draftPreferences.sponsorshipStatus} defaultValue={draftPreferences.sponsorshipStatus} options={["Accepting sponsorships", "Paused", "Hidden"]} onChange={(sponsorshipStatus) => setDraftPreferences((current) => ({ ...current, sponsorshipStatus }))} />
              </Field>
            )}
          </div>
        </FormGroup>

        <FormGroup title="Genres favoris">
          <div className="space-y-4">
            <ChoiceRow key={`genres-${draftPreferences.favoriteGenres.join("-")}`} multi label="Genres" options={["Shonen", "Seinen", "Shojo", "Josei"]} defaultValues={draftPreferences.favoriteGenres} onChange={(favoriteGenres) => setDraftPreferences((current) => ({ ...current, favoriteGenres }))} />
            <ChoiceRow
              key={`subgenres-${draftPreferences.favoriteSubgenres.join("-")}`}
              multi
              label="Sous-genres"
              defaultValues={draftPreferences.favoriteSubgenres}
              options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
              onChange={(favoriteSubgenres) => setDraftPreferences((current) => ({ ...current, favoriteSubgenres }))}
            />
          </div>
        </FormGroup>
        {saveError && <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>{saveError}</div>}
      </div>
    </ModalShell>
  );
}

/** Upload réel d'avatar/bannière : Storage Supabase + user_metadata (+ profiles.avatar_url). */
function MediaUploadButton({ kind, onDone }: { kind: "avatar" | "banner"; onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handle = async (file: File | undefined) => {
    if (!file || !supabase) return;
    setState("saving");
    try {
      const url = await uploadImage(file, kind === "avatar" ? "avatars" : "banners");
      await supabase.auth.updateUser({
        data: kind === "avatar" ? { avatar_url: url } : { banner_url: url },
      });
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      if (uid) {
        await supabase
          .from("profiles")
          .update(kind === "avatar" ? { avatar_url: url } : { banner_url: url })
          .eq("id", uid);
      }
      setState("saved");
      onDone?.();
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2400);
    }
  };

  return (
    <>
      <SecondaryButton full onClick={() => inputRef.current?.click()}>
        {state === "saving"
          ? "Envoi…"
          : state === "saved"
            ? "Enregistré ✓"
            : state === "error"
              ? "Échec — réessayer"
              : kind === "avatar"
                ? "Upload avatar"
                : "Upload banner"}
      </SecondaryButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handle(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </>
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
  defaultValues,
  onChange,
}: {
  label: string;
  options: string[];
  multi?: boolean;
  defaultValue?: string;
  defaultValues?: string[];
  onChange?: (selected: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(defaultValues ?? (defaultValue ? [defaultValue] : []));
  const toggle = (o: string) =>
    setSel((prev) => {
      const next = multi
        ? prev.includes(o)
          ? prev.filter((x) => x !== o)
          : [...prev, o]
        : prev[0] === o
          ? []
          : [o];
      onChange?.(next);
      return next;
    });
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

function ClassicImageUploader({
  multiple = true,
  label = "Importer une image",
  onFiles,
}: {
  multiple?: boolean;
  label?: string;
  onFiles?: (files: File[]) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const filesRef = useRef<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Index en cours de remplacement (null = ajout d'une nouvelle image).
  const replaceIndexRef = useRef<number | null>(null);
  const activeImage = images[0];

  const sync = (files: File[], urls: string[]) => {
    filesRef.current = files;
    setImages(urls);
    onFiles?.(files);
  };

  const handleChosen = (fileList: FileList | null) => {
    const incoming = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    const idx = replaceIndexRef.current;
    replaceIndexRef.current = null;
    if (!multiple) {
      sync(incoming.slice(0, 1), incoming.slice(0, 1).map((f) => URL.createObjectURL(f)));
      return;
    }
    if (idx !== null && idx < filesRef.current.length) {
      // Remplacement de l'image cliquée par la nouvelle.
      const files = [...filesRef.current];
      const urls = [...images];
      files[idx] = incoming[0];
      urls[idx] = URL.createObjectURL(incoming[0]);
      sync(files, urls);
    } else {
      sync([...filesRef.current, ...incoming], [...images, ...incoming.map((f) => URL.createObjectURL(f))]);
    }
  };

  const openPicker = (replaceIndex: number | null) => {
    replaceIndexRef.current = replaceIndex;
    inputRef.current?.click();
  };

  const removeAt = (index: number) => {
    sync(filesRef.current.filter((_, i) => i !== index), images.filter((_, i) => i !== index));
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => openPicker(activeImage ? 0 : null)}
        className="group grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-[18px] text-center"
        style={{ background: "#08112B", border: "1px dashed rgba(133,154,206,0.32)", color: "#B8C4E5" }}
        title={activeImage ? "Cliquer pour remplacer cette image" : label}
      >
        {activeImage ? (
          <img src={activeImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6">
            <span
              className="grid h-12 w-12 place-items-center rounded-[14px]"
              style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.32)", color: "#39FF88" }}
            >
              <ImageIcon size={22} />
            </span>
            <span className="text-[14px] font-bold" style={{ color: "#F7FAFF" }}>{label}</span>
            <span className="text-[12px]" style={{ color: "#7F8CB3" }}>PNG, JPG, WEBP</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={false}
        className="hidden"
        onChange={(event) => {
          handleChosen(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      {multiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <div key={`${src}-${index}`} className="relative shrink-0">
              <button
                type="button"
                onClick={() => openPicker(index)}
                title="Cliquer pour remplacer cette image"
                className="h-16 w-16 overflow-hidden rounded-[12px]"
                style={{ border: "1px solid rgba(133,154,206,0.22)", background: "#0E193A" }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                aria-label="Supprimer cette image"
                onClick={() => removeAt(index)}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-black"
                style={{ background: "#FF5F7E", color: "#04111E", border: "2px solid #0B1430" }}
              >
                ✕
              </button>
            </div>
          ))}
          {/* Cadre « + » permanent pour ajouter une nouvelle image */}
          <button
            type="button"
            aria-label="Ajouter une image"
            onClick={() => openPicker(null)}
            className="grid h-16 w-16 shrink-0 place-items-center rounded-[12px] text-[22px] font-black transition-colors"
            style={{ border: "1px dashed rgba(57,255,136,0.45)", color: "#39FF88", background: "rgba(57,255,136,0.06)" }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function AddSponsorshipModal({
  open,
  onClose,
  editTitle = null,
  ownerName = "Créateur",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  editTitle?: string | null;
  ownerName?: string;
  onCreated?: () => void;
}) {
  const isEdit = editTitle !== null;
  const [existing, setExisting] = useState<SponsorOption | undefined>();
  useEffect(() => {
    if (!open || !isEdit) {
      setExisting(undefined);
      return;
    }
    void listSponsorOptions()
      .then((options) =>
        setExisting(
          options.find((option) => option.mode === "creator" && option.format === editTitle),
        ),
      )
      .catch(() => setExisting(undefined));
  }, [editTitle, isEdit, open]);
  return (
    <ServiceFormModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier le service" : "Add service"}
      submitLabel={isEdit ? "Enregistrer" : "Confirmer"}
      initial={existing}
      onSubmit={(values) => {
        void (async () => {
          const next = {
            mode: "creator",
            format: values.format,
            platforms: values.platforms,
            videoType: values.videoType,
            duration: values.duration,
            paymentMode: values.paymentMode,
            price: values.price,
            quantity: values.quantity,
            description: values.description,
            ownerName,
            chaptersMin: values.chaptersMin,
            chaptersMax: values.chaptersMax,
            language: values.language,
          } as const;
          if (existing) await updateSponsorOption(existing.id, next);
          else await addSponsorOption(next);
          await addFavorite("Sponsorship option", values.format);
          onCreated?.();
          onClose();
        })();
      }}
    />
  );
}

function AddAnnouncementModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [language, setLanguage] = useState("FR");
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [statusSought, setStatusSought] = useState("Scénariste");
  const [genres, setGenres] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [remuneration, setRemuneration] = useState(false);
  const [engagement, setEngagement] = useState<"Long terme" | "Ponctuel">("Long terme");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Donne un titre à ton annonce.");
      return;
    }
    setSaving(true);
    try {
      await addAnnouncement({
        mode: "collaborator",
        title: title.trim(),
        hook: hook.trim(),
        description: description.trim(),
        language,
        status_sought: statusSought,
        genres,
        subgenres,
        remuneration,
        engagement,
      });
      void addFavorite("Announcement", title.trim());
      onCreated?.();
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Créer une annonce"
      width={860}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={submit}>
            {saving ? "Publication…" : done ? "Publiée ✓" : "Confirmer"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-6">
        <ChoiceRow label="Langage" options={["FR", "ENG", "ES", "IT", "JP"]} defaultValue="FR" onChange={(s) => setLanguage(s[0] ?? "FR")} />
        <Field label="Titre">
          <input className="cm-input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Accroche">
          <input className="cm-input" placeholder="Accroche" value={hook} onChange={(e) => setHook(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className="cm-textarea" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ChoiceRow label="Statut recherché" options={[...PROFILE_ROLES]} defaultValue="Scénariste" onChange={(s) => setStatusSought(s[0] ?? "")} />
        <ToggleRow label="Rémunération" checked={remuneration} onChange={setRemuneration} />
        <ChoiceRow label="Engagement" options={["Long terme", "Ponctuel"]} defaultValue="Long terme" onChange={(values) => setEngagement(values[0] === "Ponctuel" ? "Ponctuel" : "Long terme")} />
        <div>
          <div className="cm-sora mb-3 text-[15px] font-bold" style={{ color: "#F7FAFF" }}>Type de projet favori</div>
          <div className="space-y-4">
            <ChoiceRow multi label="Genre" options={["Shonen", "Seinen", "Shojo", "Josei"]} onChange={setGenres} />
            <ChoiceRow
              multi
              label="Sous-genre"
              options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
              onChange={setSubgenres}
            />
          </div>
        </div>
        {error && (
          <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>
            {error}
          </div>
        )}
        {done && (
          <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.4)", color: "#39FF88" }}>
            Annonce publiée ! Elle est visible dans la page Annonces.
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AddIllustrationModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setError(null);
    setDone(false);
  };

  const submit = async () => {
    setError(null);
    if (files.length === 0) {
      setError("Importe au moins une image.");
      return;
    }
    if (!title.trim()) {
      setError("Donne un titre à ton illustration.");
      return;
    }
    setSaving(true);
    try {
      await addIllustration({ title: title.trim(), description: description.trim(), files });
      void addFavorite("Illustration", title.trim());
      onCreated?.();
      setDone(true);
      setTimeout(() => {
        reset();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Ajouter illustration"
      width={980}
      footer={
        <>
          <SecondaryButton onClick={() => { reset(); onClose(); }}>Annuler</SecondaryButton>
          <PrimaryButton onClick={submit}>
            {saving ? "Publication…" : done ? "Publiée ✓" : "Confirmer"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ClassicImageUploader multiple label="Importer des illustrations" onFiles={setFiles} />
        <div className="space-y-4">
          <Field label="Titre">
            <input className="cm-input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className="cm-textarea" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {error && (
            <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>
              {error}
            </div>
          )}
          {done && (
            <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(57,255,136,0.10)", border: "1px solid rgba(57,255,136,0.4)", color: "#39FF88" }}>
              Illustration publiée ! Elle est maintenant visible dans la page Illustration.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function AddPropositionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [category, setCategory] = useState("Autre");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Donne un titre à ton idée."); return; }
    if (!description.trim()) { setError("Ajoute une description."); return; }
    setSaving(true);
    try {
      await addIdea({ title: title.trim(), category, description: description.trim(), files });
      void addFavorite("Idée", title.trim());
      setTitle(""); setDescription(""); setFiles([]);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ajouter une idée"
      width={980}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={submit}>{saving ? "Publication…" : "Ajouter"}</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ClassicImageUploader multiple label="Importer des images d'idée" onFiles={setFiles} />
        <div className="space-y-4">
        <ChoiceRow
          label="Type d'idée"
          defaultValue="Autre"
          options={["Autre", "Système de pouvoirs", "Motivations", "Charadesign", "Worldbuilding", "Équipement"]}
          onChange={(sel) => setCategory(sel[0] ?? "Autre")}
        />
        <Field label="Titre"><input className="cm-input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Description"><textarea className="cm-textarea" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {error && (
          <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>
            {error}
          </div>
        )}
        </div>
      </div>
    </ModalShell>
  );
}

function AddProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);

  const submit = async () => {
    if (!name.trim()) { setError("Donne un nom au projet."); return; }
    setError(null);
    setSaving(true);
    try {
      // Le projet est créé dans le même store que le Studio (IndexedDB).
      const existing = await loadStudioProjects<Record<string, unknown>>();
      const coverUrl = coverFiles[0] ? await compressCoverImage(coverFiles[0]) : undefined;
      const project = {
        id: `prj-${crypto.randomUUID()}`,
        title: name.trim(),
        synopsis: synopsis.trim() || "Synopsis à compléter.",
        coverUrl,
        status: "Draft",
        chaptersCount: 0,
        validatedPages: 0,
        totalPages: 0,
        updated: "À l'instant",
        genres,
        subgenres,
        chapters: [] as unknown[],
        notes: [] as unknown[],
        sponsorships: [] as unknown[],
        recruits: [] as unknown[],
      };
      await saveStudioProjects([project, ...existing]);
      void addFavorite("Project", name.trim());
      setName(""); setSynopsis(""); setCoverFiles([]);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Créer un projet"
      width={980}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={submit}>{saving ? "Création…" : "Créer le projet"}</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ClassicImageUploader multiple={false} label="Importer une couverture" onFiles={setCoverFiles} />
        <div className="space-y-4">
          <Field label="Nom du projet"><input className="cm-input" placeholder="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Synopsis"><textarea className="cm-textarea" placeholder="Synopsis du projet" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} /></Field>
          <ChoiceRow multi label="Genre" options={["Shonen", "Seinen", "Shojo", "Josei"]} onChange={setGenres} />
          <ChoiceRow
            multi
            label="Sous-genres"
            options={["Action", "Aventure", "Comédie", "Drame", "Fantastique", "Science-fiction", "Romance", "Slice of life", "Horreur", "Mystère", "Historique", "Sport", "Isekai", "Psychologique", "Mecha"]}
            onChange={setSubgenres}
          />
          {error && (
            <div className="rounded-[12px] px-4 py-3 text-[13px] font-semibold" style={{ background: "rgba(255,95,126,0.10)", border: "1px solid rgba(255,95,126,0.35)", color: "#FF5F7E" }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function ProfileWorkflowModal({
  type,
  profileType,
  profileName,
  recipientId,
  onClose,
  onDone,
}: {
  type: ProfileWorkflow;
  profileType: ProfileType;
  profileName: string;
  recipientId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [projectTitle, setProjectTitle] = useState("Neon Ronin");
  const [role, setRole] = useState(profileType === "content" ? "Créateur de contenu" : "Dessinateur");
  const [level, setLevel] = useState("Niveau 1");
  const [startDate, setStartDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title =
    type === "invite"
      ? "Inviter au projet"
      : type === "patronage"
        ? "Proposer un parrainage"
        : type === "friend"
          ? "Ajouter en ami"
          : "S'abonner";

  const submit = async () => {
    if (submitting) return;
    setError("");
    if (!recipientId) {
      setError("Ce profil n'est pas relié à un compte utilisateur actif.");
      return;
    }
    if (type === "invite") {
      if (!projectTitle.trim()) {
        setError("Le projet concerné est obligatoire.");
        return;
      }
    } else if (type === "patronage") {
      if (!level.trim()) {
        setError("Le niveau de parrainage est obligatoire.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (type === "invite") {
        await sendProfileWorkflowDb(recipientId, {
          kind: "collaboration_invitation",
          status: "pending",
          category: "project",
          type: "invitation_collab",
          title: `Invitation à rejoindre ${projectTitle.trim()}`,
          content: message.trim() || `Rôle proposé : ${role}.`,
          entityType: "project",
          entityTitle: projectTitle.trim(),
        });
        onDone("Invitation de collaboration envoyée et notification créée.");
        return;
      }
      if (type === "patronage") {
        await sendProfileWorkflowDb(recipientId, {
          kind: "patronage_request",
          status: "pending",
          category: "sponsorship",
          type: "demande_parrainage",
          title: `Nouvelle proposition de parrainage (${level})`,
          content: [message.trim(), startDate ? `Début souhaité : ${startDate}.` : ""].filter(Boolean).join(" "),
          entityType: "sponsorship",
          entityTitle: profileName,
        });
        onDone("Demande de parrainage envoyée et notification créée.");
        return;
      }
      if (type === "friend") {
        await sendFriendRequestDb(recipientId);
        onDone("Demande d'amitié envoyée.");
        return;
      }
      await sendProfileWorkflowDb(recipientId, {
        kind: "subscription",
        status: "active",
        category: "friend",
        type: "abonnement",
        title: "Un membre s'est abonné à ton profil",
        content: "Un nouvel utilisateur suit maintenant ton activité.",
        entityType: "profile",
        entityTitle: profileName,
      });
      onDone("Abonnement ajouté. Le créateur recevra une notification.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Action impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={title}
      width={720}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton onClick={() => void submit()}>
            {submitting ? "Envoi…" : type === "follow" || type === "friend" ? "Confirmer" : "Envoyer"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-[16px] p-4" style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)" }}>
          <div className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: "#7F8CB3" }}>Destinataire</div>
          <div className="mt-1 cm-sora text-[16px] font-bold" style={{ color: "#F7FAFF" }}>{profileName}</div>
        </div>

        {type === "invite" && (
          <>
            <Field label="Projet concerné">
              <input className="cm-input" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="Titre du projet" />
            </Field>
            <Field label="Rôle proposé">
              <select className="cm-input" value={role} onChange={(event) => setRole(event.target.value)}>
                {["Dessinateur", "Scénariste", "Créateur de contenu", "Lecteur"].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Message d'invitation">
              <textarea className="cm-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explique le rôle attendu, le rythme et les prochaines étapes." />
            </Field>
          </>
        )}

        {type === "patronage" && (
          <>
            <Field label="Niveau de parrainage">
              <select className="cm-input" value={level} onChange={(event) => setLevel(event.target.value)}>
                {["Niveau 1", "Niveau 2", "Niveau 3"].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Date de début souhaitée">
              <input className="cm-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="Message personnalisé">
              <textarea className="cm-textarea" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ajoute les avantages, attentes ou conditions utiles." />
            </Field>
          </>
        )}

        {(type === "follow" || type === "friend") && (
          <p className="text-[14px] leading-[22px]" style={{ color: "#B8C4E5" }}>
            Cette action utilise une confirmation directe, sans champ supplémentaire, conformément au workflow du document.
          </p>
        )}

        {error && <div className="text-[13px] font-bold" style={{ color: "#FF5F7E" }}>{error}</div>}
      </div>
    </ModalShell>
  );
}

function ProfileToast({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[70] max-w-[420px] rounded-[16px] px-4 py-3 text-[14px] font-bold shadow-[0_18px_44px_rgba(0,0,0,0.45)]"
      style={{ background: "#101B3F", border: "1px solid rgba(57,255,136,0.45)", color: "#F7FAFF" }}
    >
      {children}
    </div>
  );
}

function DetailsModal({
  open,
  onClose,
  title,
  kind,
  source,
  mode,
  illustration,
  idea,
  announcement,
  option,
  project,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: string;
  source: "own" | "favorite";
  mode: ViewMode;
  illustration?: DbIllustration;
  idea?: DbIdea;
  announcement?: DbAnnouncement;
  option?: SponsorOption;
  project?: StudioProjectLite;
  onEdit: (title: string) => void;
}) {
  const isSponsorship = kind === "Sponsorship option";
  // Ses propres publications (mode "own") → pas de contact/postuler ; on garde
  // le contact pour les favoris et lorsqu'on visite un profil public.
  const canEdit = isSponsorship && source === "own" && mode === "own";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title || kind}
      width={1200}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          {canEdit && (
            <PrimaryButton onClick={() => onEdit(title)} icon={<Edit3 size={16} />}>Modifier</PrimaryButton>
          )}
        </>
      }
    >
      {/* Le contenu reflète le popup de la page correspondante, avec les vraies données. */}
      <div className={isSponsorship ? "" : "grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)]"}>
        {!isSponsorship && (
          <div
            className="grid aspect-[3/4] w-full max-w-[240px] place-items-center overflow-hidden rounded-[18px]"
            style={{
              background: "linear-gradient(160deg, #060D24, #0B1430 50%, #101B3F 100%)",
              border: "1px solid rgba(133,154,206,0.18)",
            }}
          >
            {illustration?.image_url || idea?.image_url || project?.coverDataUrl || project?.coverUrl ? (
              <img src={illustration?.image_url || idea?.image_url || project?.coverDataUrl || project?.coverUrl || ""} alt={title} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={30} color="#5E6A90" />
            )}
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="info">{kind}</Chip>
            {idea?.category && <Chip>{idea.category}</Chip>}
            {announcement?.status_sought && <Chip>Role · {announcement.status_sought}</Chip>}
            {announcement?.language && <Chip>{announcement.language}</Chip>}
          </div>
          <h2 className="cm-sora mt-3 text-[22px] font-bold leading-8" style={{ color: "#F7FAFF" }}>
            {title || `${kind} details`}
          </h2>
          <p className="mt-2 text-[14px] leading-[22px]" style={{ color: "#B8C4E5" }}>
            {illustration?.description ||
              idea?.description ||
              announcement?.hook ||
              option?.description ||
              project?.synopsis ||
              (isSponsorship
                ? "Détail complet du service de parrainage."
                : "Vue complète de cette publication.")}
          </p>
          {isSponsorship && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Format" value={option?.format ?? title} />
              <Stat label="Plateformes" value={option?.platforms.join(" · ") || "—"} />
              <Stat label="Durée" value={option?.duration ?? "—"} />
              <Stat label="Paiement" value={option?.paymentMode ?? "—"} />
              <Stat label="Prix" value={option ? `${option.price} €` : "—"} />
              <Stat
                label="Chapitres"
                value={option?.chaptersMin || option?.chaptersMax ? `${option?.chaptersMin ?? 0}–${option?.chaptersMax ?? "∞"}` : "—"}
              />
            </div>
          )}
          {announcement && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {announcement.genres.map((g) => <Chip key={g}>{g}</Chip>)}
              {announcement.subgenres.slice(0, 4).map((g) => <Chip key={g} tone="info">{g}</Chip>)}
            </div>
          )}
          {project && (
            <div className="mt-5">
              <MetaLabel>Genre et sous-genres</MetaLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.genres.map((genre) => <Chip key={genre}>{genre}</Chip>)}
                {(project.subgenres ?? []).map((subgenre) => <Chip key={subgenre} tone="info">{subgenre}</Chip>)}
                {project.genres.length === 0 && (project.subgenres ?? []).length === 0 && <Chip>Aucun genre renseigné</Chip>}
              </div>
            </div>
          )}
        </div>
      </div>

      {(announcement?.description || idea?.description) && (
        <div className="mt-8">
          <SectionTitle title="Détails" subtitle="Description complète." />
          <div
            className="rounded-[18px] p-5 text-[14px] leading-[22px]"
            style={{ background: "#08112B", border: "1px solid rgba(133,154,206,0.18)", color: "#B8C4E5" }}
          >
            {announcement?.description || idea?.description}
          </div>
        </div>
      )}

      {/* Commentaires réels, comme sur les pages Illustration / Idées */}
      {(illustration || idea) && (
        <div className="mt-8">
          <SectionTitle title="Commentaires" subtitle="Les retours de la communauté." />
          <CommentsPanel
            entityType={illustration ? "illustration" : "idea"}
            entityId={illustration ? illustration.id : idea!.id}
          />
        </div>
      )}
    </ModalShell>
  );
}


