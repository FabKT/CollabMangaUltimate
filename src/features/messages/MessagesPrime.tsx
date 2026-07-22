import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  currentUserId,
  listConversations,
  listMessages,
  searchProfiles,
  sendMessage,
  startConversationWith,
  subscribeConversationList,
  subscribeMessages,
  type DbProfile,
} from "@/lib/db";
import { loadStudioProjects, saveStudioProjects } from "@/lib/studio-projects";
import { listSponsorships } from "@/features/sponsorships/store";
import { SponsorshipModal } from "@/features/sponsorships/SponsorshipModal";
import {
  appendThreadMessage,
  listThreadMessages,
  subscribeThreadMessages,
  threadKey,
} from "@/lib/local-threads";
import {
  Plus,
  Search,
  Users,
  FolderKanban,
  Handshake,
  Send,
  Paperclip,
  Image as ImageIcon,
  MoreVertical,
  Sparkles,
  ChevronLeft,
  BookOpen,
  Megaphone,
  Palette,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default MessagesPage;

/* --------------------------------- data ---------------------------------- */

type BaseTab = "amis" | "projets" | "parrainages";
/** Conversation privée (mappée depuis Supabase). */
type Friend = {
  id: string;
  profileId?: string;
  username?: string;
  avatarUrl?: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
};
/** Message affiché dans le fil. */
type UiMessage = {
  id: string;
  user: string;
  time: string;
  text: string;
  self?: boolean;
  attachment?: "image";
  imageUrl?: string;
};

// Conversations liées : projets (Studio) et parrainages (hub) — types dynamiques.
type ProjectConv = {
  id: string;
  name: string;
  label: string;
  preview: string;
  time: string;
  unread: number;
};
type SponsorConv = {
  id: string;
  name: string;
  chip: string;
  preview: string;
  time: string;
  unread: number;
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/* --------------------------- small helpers/style ------------------------- */

const rowBase = "flex items-center gap-3 rounded-lg cursor-pointer transition-colors select-none";

function Avatar({
  label,
  imageUrl,
  online,
  size = 40,
}: {
  label: string;
  imageUrl?: string;
  online?: boolean;
  size?: number;
}) {
  const initials = label
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-sm font-extrabold"
        style={{
          background: "linear-gradient(135deg,#1a2550,#0e1738)",
          color: "var(--cm-text)",
          border: "1px solid var(--cm-border)",
        }}
      >
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
      </div>
      {online !== undefined && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
          style={{
            background: online ? "var(--cm-neon)" : "var(--cm-disabled)",
            border: "2px solid var(--cm-menu)",
          }}
          aria-label={online ? "En ligne" : "Hors ligne"}
        />
      )}
    </div>
  );
}

/* ------------------------------ main page -------------------------------- */

function MessagesPage({
  initialConversationId,
  initialSponsorshipId,
}: {
  initialConversationId?: string;
  initialSponsorshipId?: string;
}) {
  const navigate = useNavigate();
  const [baseTab, setBaseTab] = useState<BaseTab>("amis");
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [conversationQuery, setConversationQuery] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  // ---- données réelles (Supabase) ----
  const [uid, setUid] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  // Conversations liées : projets Studio + parrainages du hub.
  const [projectConvs, setProjectConvs] = useState<ProjectConv[]>([]);
  const [sponsorConvs, setSponsorConvs] = useState<SponsorConv[]>([]);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);

  const refreshLinked = () => {
    void loadStudioProjects<{ id: string; title: string }>()
      .then((rows) =>
        setProjectConvs(
          rows.map((p) => ({
            id: p.id,
            name: p.title,
            label: "# discussion",
            preview: "Espace de discussion du projet",
            time: "",
            unread: 0,
          })),
        ),
      )
      .catch(() => setProjectConvs([]));
    void listSponsorships()
      .then((rows) =>
        setSponsorConvs(
          rows.map((s) => ({
            id: s.id,
            name: s.name,
            chip: s.creator,
            preview: s.project,
            time: "",
            unread: 0,
          })),
        ),
      )
      .catch(() => setSponsorConvs([]));
  };
  useEffect(refreshLinked, []);

  const refreshConversations = async (showLoading = true) => {
    if (showLoading) setLoadingConversations(true);
    setConversationError(null);
    try {
      const rows = await listConversations();
      setFriends(
        rows.map((c) => {
          const other = c.others[0];
          return {
            id: c.id,
            profileId: other?.id,
            username: other?.username,
            avatarUrl: other?.avatar_url ?? undefined,
            name: other?.display_name || other?.username || "Conversation",
            preview: c.lastMessage?.content || "Nouvelle conversation",
            time: c.lastMessage ? timeLabel(c.lastMessage.created_at) : timeLabel(c.created_at),
            unread: 0,
          };
        }),
      );
    } catch (error) {
      setFriends([]);
      setConversationError(
        error instanceof Error ? error.message : "Impossible de charger les conversations.",
      );
    } finally {
      if (showLoading) setLoadingConversations(false);
    }
  };

  useEffect(() => {
    void currentUserId()
      .then(setUid)
      .catch(() => setUid(null));
    void refreshConversations();
    return subscribeConversationList(() => { void refreshConversations(false); });
  }, []);

  useEffect(() => {
    if (!initialConversationId) return;
    setBaseTab("amis");
    setActiveConv(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!initialSponsorshipId) return;
    setBaseTab("parrainages");
    setActiveConv(initialSponsorshipId);
  }, [initialSponsorshipId]);

  const activeFriend = friends.find((f) => f.id === activeConv) ?? null;
  const activeProject = projectConvs.find((project) => project.id === activeConv) ?? null;
  const activeSponsor = sponsorConvs.find((sponsor) => sponsor.id === activeConv) ?? null;

  const toUi = (m: {
    id: string;
    sender_id: string;
    content: string;
    image_url: string | null;
    created_at: string;
  }): UiMessage => ({
    id: m.id,
    user: m.sender_id === uid ? "Toi" : activeFriend?.name || "Membre",
    time: timeLabel(m.created_at),
    text: m.content,
    self: m.sender_id === uid,
    attachment: m.image_url ? ("image" as const) : undefined,
    imageUrl: m.image_url ?? undefined,
  });

  // Chargement + abonnement Realtime du fil actif.
  useEffect(() => {
    if (activeConv && (baseTab === "projets" || baseTab === "parrainages")) {
      const key = threadKey(baseTab === "projets" ? "project" : "sponsorship", activeConv);
      let cancelled = false;
      void listThreadMessages(key)
        .then((rows) => {
          if (cancelled) return;
          setMessages(
            rows.map((m) => ({
              id: m.id,
              user: m.authorId === uid ? "Toi" : m.author,
              time: timeLabel(m.createdAt),
              text: m.content,
              self: m.authorId === uid,
            })),
          );
        })
        .catch((error) => {
          if (!cancelled) {
            setMessages([]);
            setThreadError(
              error instanceof Error ? error.message : "Impossible de charger les messages.",
            );
          }
        });
      const unsubscribe = subscribeThreadMessages(key, (m) => {
        setMessages((current) =>
          current.some((item) => item.id === m.id)
            ? current
            : [
                ...current,
                {
                  id: m.id,
                  user: m.authorId === uid ? "Toi" : m.author,
                  time: timeLabel(m.createdAt),
                  text: m.content,
                  self: m.authorId === uid,
                },
              ],
        );
      });
      setThreadError(null);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
    if (!activeConv || baseTab !== "amis") {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setThreadError(null);
    void listMessages(activeConv)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map(toUi));
      })
      .catch((error) => {
        if (!cancelled) {
          setMessages([]);
          setThreadError(
            error instanceof Error ? error.message : "Impossible de charger les messages.",
          );
        }
      });
    const unsubscribe = subscribeMessages(activeConv, (m) => {
      setMessages((current) =>
        current.some((x) => x.id === m.id) ? current : [...current, toUi(m)],
      );
      void refreshConversations(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv, baseTab, uid, activeFriend?.name]);

  const handleSend = async (text: string, file?: File | null) => {
    const content = text.trim() || (file ? "Image" : "");
    if (!activeConv || !content) return;
    setThreadError(null);
    if (baseTab === "projets" || baseTab === "parrainages") {
      try {
        const key = threadKey(baseTab === "projets" ? "project" : "sponsorship", activeConv);
        const message = await appendThreadMessage(key, content);
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [
                ...current,
                {
                  id: message.id,
                  user: "Toi",
                  time: timeLabel(message.createdAt),
                  text: message.content,
                  self: true,
                },
              ],
        );
        return;
      } catch (error) {
        setThreadError(error instanceof Error ? error.message : "Impossible d'envoyer le message.");
        throw error;
      }
    }
    try {
      const message = await sendMessage(activeConv, content, file);
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, toUi(message)],
      );
      await refreshConversations(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer le message.";
      setThreadError(message);
      throw error;
    }
  };

  const selectBaseTab = (t: BaseTab) => {
    setBaseTab(t);
    setActiveConv(null);
    setConversationQuery("");
    setThreadError(null);
  };

  return (
    <div
      className="h-[calc(100dvh-53px)] w-full min-w-0 overflow-hidden md:h-screen"
      style={{
        background: "var(--cm-bg)",
        color: "var(--cm-text)",
        fontFamily: "var(--font-manrope)",
      }}
    >
      <div
        className="grid h-full w-full grid-cols-1 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]"
        style={{ background: "var(--cm-container)" }}
      >
        <ConversationMenu
          baseTab={baseTab}
          onBaseTab={selectBaseTab}
          activeConv={activeConv}
          onConv={(id) => {
            setActiveConv(id);
          }}
          query={conversationQuery}
          onQuery={setConversationQuery}
          loading={loadingConversations}
          error={conversationError}
          onNewMessage={() => {
            // Le « + » dépend de l'onglet actif : ami → recherche, projet → création, parrainage → flux hub.
            if (baseTab === "projets") setCreateProjectOpen(true);
            else if (baseTab === "parrainages") setSponsorModalOpen(true);
            else setNewMessageOpen(true);
          }}
          friends={friends}
          projects={projectConvs}
          sponsors={sponsorConvs}
        />

        <ChatArea
          baseTab={baseTab}
          activeConv={activeConv}
          onBack={() => setActiveConv(null)}
          onOpenDetails={() => setDetailsOpen(true)}
          friends={friends}
          projects={projectConvs}
          sponsors={sponsorConvs}
          messages={messages}
          error={threadError}
          onSend={handleSend}
          onConv={(id) => setActiveConv(id)}
        />
      </div>

      <NewMessageModal
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
        onStarted={(convId) => {
          void refreshConversations(false);
          setBaseTab("amis");
          setActiveConv(convId);
        }}
      />
      <DetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        kind={baseTab}
        friend={activeFriend}
        title={activeFriend?.name || activeProject?.name || activeSponsor?.name}
        subtitle={
          activeProject?.preview ||
          (activeSponsor ? `${activeSponsor.chip} · ${activeSponsor.preview}` : undefined)
        }
        onViewProfile={
          activeFriend?.profileId
            ? () => {
                setDetailsOpen(false);
                void navigate({
                  to: "/profile/$profileId",
                  params: { profileId: activeFriend.profileId! },
                });
              }
            : undefined
        }
      />
      {createProjectOpen && (
        <QuickProjectModal
          onClose={() => setCreateProjectOpen(false)}
          onCreated={(id) => {
            setCreateProjectOpen(false);
            refreshLinked();
            setBaseTab("projets");
            setActiveConv(id);
          }}
        />
      )}
      <SponsorshipModal
        open={sponsorModalOpen}
        onClose={() => {
          setSponsorModalOpen(false);
          refreshLinked();
        }}
      />
    </div>
  );
}

/** Création rapide d'un projet depuis l'onglet Projets de la messagerie. */
function QuickProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) {
      setError("Donne un nom au projet.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const existing = await loadStudioProjects<Record<string, unknown>>();
      const id = `prj-${crypto.randomUUID()}`;
      const saved = await saveStudioProjects([
        {
          id,
          title: name.trim(),
          synopsis: synopsis.trim() || "Synopsis à compléter.",
          status: "Draft",
          chaptersCount: 0,
          validatedPages: 0,
          totalPages: 0,
          updated: "À l'instant",
          genres: [],
          chapters: [],
          notes: [],
          sponsorships: [],
          recruits: [],
          collaborators: [{ id: "co-owner", name: "Vous", role: "Scénariste", level: "chef" }],
        },
        ...existing,
      ]);
      if (!saved) throw new Error("Le projet n'a pas pu être enregistré sur cet appareil.");
      onCreated(id);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Impossible de créer le projet.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        style={{
          background: "var(--cm-elevated)",
          border: "1px solid var(--cm-border-strong)",
          color: "var(--cm-text)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>Créer un projet</DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>
            Le projet sera créé dans le Studio et sa discussion ouverte ici.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nom du projet</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du manga"
              style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Synopsis</Label>
            <Textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Résumé court…"
              style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
            />
          </div>
          {error && (
            <p className="text-sm font-semibold" style={{ color: "var(--cm-danger)" }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} style={{ color: "var(--cm-text-2)" }}>
            Annuler
          </Button>
          <Button
            onClick={() => void create()}
            disabled={saving}
            style={{ background: "var(--cm-neon)", color: "#04111E" }}
          >
            {saving ? "Création…" : "Créer le projet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Conversation menu ---------------------------- */

function ConversationMenu(props: {
  baseTab: BaseTab;
  onBaseTab: (t: BaseTab) => void;
  activeConv: string | null;
  onConv: (id: string) => void;
  onNewMessage: () => void;
  query: string;
  onQuery: (query: string) => void;
  loading: boolean;
  error: string | null;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
}) {
  const {
    baseTab,
    onBaseTab,
    activeConv,
    onConv,
    onNewMessage,
    query,
    onQuery,
    loading,
    error,
    friends,
    projects,
    sponsors,
  } = props;

  return (
    <nav
      className={`${activeConv ? "hidden md:flex" : "flex"} h-full min-w-0 flex-col overflow-hidden`}
      style={{ background: "var(--cm-menu)", borderRight: "1px solid var(--cm-divider)" }}
      aria-label="Conversation menu"
    >
      <BaseMenu
        baseTab={baseTab}
        onBaseTab={onBaseTab}
        activeConv={activeConv}
        onConv={onConv}
        onNewMessage={onNewMessage}
        query={query}
        onQuery={onQuery}
        loading={loading}
        error={error}
        friends={friends}
        projects={projects}
        sponsors={sponsors}
      />
    </nav>
  );
}

function SearchRow({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="p-3" style={{ borderBottom: "1px solid var(--cm-divider)" }}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--cm-muted)" }}
        />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full pl-9 text-sm"
          style={{
            background: "var(--cm-input)",
            border: "1px solid var(--cm-border)",
            color: "var(--cm-text)",
            borderRadius: 10,
          }}
        />
      </div>
    </div>
  );
}

function VerticalTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${rowBase} relative w-full`}
      style={{
        height: 46,
        padding: "0 14px",
        background: active ? "var(--cm-active)" : "transparent",
        color: active ? "var(--cm-neon)" : "var(--cm-text-2)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--cm-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r"
          style={{ background: "var(--cm-neon)" }}
        />
      )}
      <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 800, lineHeight: "22px" }}>{label}</span>
    </button>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--cm-muted)",
        }}
      >
        {children}
      </span>
      {action}
    </div>
  );
}

function PlusBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
      style={{ color: "var(--cm-text-2)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function BaseMenu({
  baseTab,
  onBaseTab,
  activeConv,
  onConv,
  onNewMessage,
  query,
  onQuery,
  loading,
  error,
  friends,
  projects,
  sponsors,
}: {
  baseTab: BaseTab;
  onBaseTab: (t: BaseTab) => void;
  activeConv: string | null;
  onConv: (id: string) => void;
  onNewMessage: () => void;
  query: string;
  onQuery: (query: string) => void;
  loading: boolean;
  error: string | null;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const matches = (value: string) =>
    !normalizedQuery || value.toLocaleLowerCase("fr").includes(normalizedQuery);
  const visibleFriends = friends.filter((friend) => matches(`${friend.name} ${friend.preview}`));
  const visibleProjects = projects.filter((project) =>
    matches(`${project.name} ${project.preview}`),
  );
  const visibleSponsors = sponsors.filter((sponsor) =>
    matches(`${sponsor.name} ${sponsor.chip} ${sponsor.preview}`),
  );
  const noResults =
    normalizedQuery &&
    ((baseTab === "amis" && visibleFriends.length === 0) ||
      (baseTab === "projets" && visibleProjects.length === 0) ||
      (baseTab === "parrainages" && visibleSponsors.length === 0));

  return (
    <>
      <SearchRow placeholder="Rechercher une conversation" value={query} onChange={onQuery} />
      <div className="px-2 pt-2">
        <VerticalTab
          label="Amis"
          icon={<Users className="h-5 w-5" />}
          active={baseTab === "amis"}
          onClick={() => onBaseTab("amis")}
        />
        <VerticalTab
          label="Projets"
          icon={<FolderKanban className="h-5 w-5" />}
          active={baseTab === "projets"}
          onClick={() => onBaseTab("projets")}
        />
        <VerticalTab
          label="Parrainages"
          icon={<Handshake className="h-5 w-5" />}
          active={baseTab === "parrainages"}
          onClick={() => onBaseTab("parrainages")}
        />
      </div>
      <div className="my-2 mx-3 h-px" style={{ background: "var(--cm-divider)" }} />

      <div className="cm-scroll flex-1 overflow-y-auto px-2 pb-3">
        {loading && baseTab === "amis" && (
          <div
            className="flex items-center gap-2 px-3 py-3 text-[13px]"
            style={{ color: "var(--cm-muted)" }}
          >
            <LoaderCircle className="h-4 w-4 animate-spin" /> Chargement des conversations…
          </div>
        )}
        {error && baseTab === "amis" && (
          <p
            className="mx-2 rounded-lg px-3 py-2 text-[13px]"
            style={{ background: "rgba(255,95,126,.08)", color: "var(--cm-danger)" }}
          >
            {error}
          </p>
        )}
        {noResults && (
          <p className="px-3 py-3 text-[13px]" style={{ color: "var(--cm-muted)" }}>
            Aucune conversation ne correspond à cette recherche.
          </p>
        )}
        {baseTab === "amis" && (
          <>
            <SectionTitle action={<PlusBtn onClick={onNewMessage} label="Nouvelle conversation" />}>
              Messages privés
            </SectionTitle>
            {!loading && !error && friends.length === 0 && (
              <p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>
                Aucune conversation — clique sur + pour en démarrer une.
              </p>
            )}
            {visibleFriends.map((f) => (
              <ConvRow
                key={f.id}
                active={activeConv === f.id}
                onClick={() => onConv(f.id)}
                avatar={
                  <Avatar label={f.name} imageUrl={f.avatarUrl} online={f.online} size={36} />
                }
                title={f.name}
                preview={f.preview}
                time={f.time}
                unread={f.unread}
              />
            ))}
          </>
        )}

        {baseTab === "projets" && (
          <>
            <SectionTitle
              action={<PlusBtn onClick={onNewMessage} label="Nouvelle discussion projet" />}
            >
              Discussions projets
            </SectionTitle>
            {projects.length === 0 && (
              <p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>
                Aucun projet — clique sur + pour en créer un.
              </p>
            )}
            {visibleProjects.map((p) => (
              <ConvRow
                key={p.id}
                active={activeConv === p.id}
                onClick={() => onConv(p.id)}
                avatar={<ThumbTile label={p.name} icon={<BookOpen className="h-4 w-4" />} />}
                title={p.name}
                subtitle={p.label}
                preview={p.preview}
                time={p.time}
                unread={p.unread}
              />
            ))}
          </>
        )}

        {baseTab === "parrainages" && (
          <>
            <SectionTitle
              action={<PlusBtn onClick={onNewMessage} label="Nouvelle discussion parrainage" />}
            >
              Discussions parrainages
            </SectionTitle>
            {sponsors.length === 0 && (
              <p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>
                Aucun parrainage — clique sur + pour en créer un.
              </p>
            )}
            {visibleSponsors.map((s) => (
              <ConvRow
                key={s.id}
                active={activeConv === s.id}
                onClick={() => onConv(s.id)}
                avatar={<ThumbTile label={s.name} icon={<Megaphone className="h-4 w-4" />} />}
                title={s.name}
                subtitle={s.chip}
                preview={s.preview}
                time={s.time}
                unread={s.unread}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function ThumbTile({ label, icon }: { label: string; icon: ReactNode }) {
  const initials = label
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold"
      style={{
        background: "linear-gradient(135deg,#152052,#0b1330)",
        border: "1px solid var(--cm-border)",
        color: "var(--cm-text-2)",
      }}
      aria-label={label}
    >
      <span className="flex items-center gap-1">
        {icon}
        <span>{initials}</span>
      </span>
    </div>
  );
}

function ConvRow({
  active,
  onClick,
  avatar,
  title,
  subtitle,
  preview,
  time,
  unread,
}: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  preview?: string;
  time?: string;
  unread?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`${rowBase} w-full text-left`}
      style={{
        height: 56,
        padding: "6px 12px",
        borderRadius: 8,
        background: active ? "var(--cm-active)" : "transparent",
        color: active ? "var(--cm-neon)" : "var(--cm-text-2)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--cm-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate"
            style={{
              fontSize: 14,
              fontWeight: unread ? 800 : 700,
              lineHeight: "20px",
              color: active ? "var(--cm-neon)" : "var(--cm-text)",
            }}
          >
            {title}
          </span>
          {time && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted)" }}>{time}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 500, lineHeight: "20px", color: "var(--cm-muted)" }}
          >
            {subtitle ? <span style={{ color: "var(--cm-text-2)" }}>{subtitle} · </span> : null}
            {preview}
          </span>
          {unread && unread > 0 ? (
            <span
              className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
              style={{ background: "var(--cm-neon)", color: "#04111E" }}
              aria-label={`${unread} non lus`}
            >
              {unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/* -------------------------- Active conversation -------------------------- */

function ChatArea({
  baseTab,
  activeConv,
  onBack,
  onOpenDetails,
  friends,
  projects,
  sponsors,
  messages,
  error,
  onSend,
  onConv,
}: {
  baseTab: BaseTab;
  activeConv: string | null;
  onBack: () => void;
  onOpenDetails: () => void;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
  messages: UiMessage[];
  error: string | null;
  onSend: (text: string, file?: File | null) => Promise<void>;
  onConv?: (id: string) => void;
}) {
  const [threadQuery, setThreadQuery] = useState("");
  const [mediaOnly, setMediaOnly] = useState(false);
  const context = useMemo(
    () => resolveContext({ baseTab, activeConv, friends, projects, sponsors }),
    [baseTab, activeConv, friends, projects, sponsors],
  );
  const filteredMessages = useMemo(() => {
    const query = threadQuery.trim().toLocaleLowerCase("fr");
    return messages.filter((message) => {
      if (mediaOnly && message.attachment !== "image") return false;
      return !query || `${message.user} ${message.text}`.toLocaleLowerCase("fr").includes(query);
    });
  }, [mediaOnly, messages, threadQuery]);

  useEffect(() => {
    setThreadQuery("");
    setMediaOnly(false);
  }, [activeConv]);

  return (
    <section
      className={`${activeConv ? "flex" : "hidden md:flex"} h-full min-w-0 flex-col overflow-hidden`}
      style={{ background: "var(--cm-chat)" }}
      aria-label="Active conversation"
    >
      <TopBar
        context={context}
        hasActiveConversation={Boolean(activeConv)}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        query={threadQuery}
        onQuery={setThreadQuery}
        mediaOnly={mediaOnly}
        onMediaOnly={setMediaOnly}
      />
      <MessageThread
        context={context}
        friends={friends}
        projects={projects}
        sponsors={sponsors}
        messages={filteredMessages}
        error={error}
        filtering={Boolean(threadQuery || mediaOnly)}
        onConv={onConv}
      />
      {context.canCompose && (
        <Composer
          placeholder={context.placeholder}
          allowImage={baseTab === "amis"}
          onSend={onSend}
        />
      )}
    </section>
  );
}

type Ctx = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  placeholder: string;
  kind: "empty" | "amis-overview" | "projets-overview" | "parrainages-overview" | "conversation";
  canCompose: boolean;
};

function resolveContext(args: {
  baseTab: BaseTab;
  activeConv: string | null;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
}): Ctx {
  const { baseTab, activeConv, friends, projects, sponsors } = args;

  if (activeConv) {
    const src = baseTab === "amis" ? friends : baseTab === "projets" ? projects : sponsors;
    const item = src.find((candidate) => candidate.id === activeConv);
    if (item) {
      const contextLabel =
        baseTab === "amis"
          ? "Message direct"
          : baseTab === "projets"
            ? "Conversation de projet"
            : "Discussion de parrainage";
      return {
        title: item.name,
        subtitle: contextLabel,
        icon:
          baseTab === "amis" ? (
            <Avatar label={item.name} imageUrl={(item as Friend).avatarUrl} online size={28} />
          ) : (
            <ThumbTile
              label={item.name}
              icon={
                baseTab === "projets" ? (
                  <BookOpen className="h-3.5 w-3.5" />
                ) : (
                  <Megaphone className="h-3.5 w-3.5" />
                )
              }
            />
          ),
        placeholder:
          baseTab === "amis"
            ? `Message ${item.name}…`
            : baseTab === "projets"
              ? "Message à la conversation de projet…"
              : "Message à la discussion de parrainage…",
        kind: "conversation",
        canCompose: true,
      };
    }
  }
  if (baseTab === "amis")
    return {
      title: "Amis",
      subtitle: "Conversations privées",
      icon: <Users className="h-5 w-5" />,
      placeholder: "",
      kind: "amis-overview",
      canCompose: false,
    };
  if (baseTab === "projets")
    return {
      title: "Projets",
      subtitle: "Discussions de projet",
      icon: <FolderKanban className="h-5 w-5" />,
      placeholder: "",
      kind: "projets-overview",
      canCompose: false,
    };
  return {
    title: "Parrainages",
    subtitle: "Discussions de parrainage",
    icon: <Handshake className="h-5 w-5" />,
    placeholder: "",
    kind: "parrainages-overview",
    canCompose: false,
  };
}

function TopBar({
  context,
  hasActiveConversation,
  onBack,
  onOpenDetails,
  query,
  onQuery,
  mediaOnly,
  onMediaOnly,
}: {
  context: Ctx;
  hasActiveConversation: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  query: string;
  onQuery: (query: string) => void;
  mediaOnly: boolean;
  onMediaOnly: (active: boolean) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header
      className="flex shrink-0 items-center justify-between px-5"
      style={{
        height: 64,
        background: "var(--cm-topbar)",
        borderBottom: "1px solid var(--cm-divider)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {hasActiveConversation && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md md:hidden"
            style={{ color: "var(--cm-text-2)" }}
            aria-label="Retour aux conversations"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--cm-elevated)", color: "var(--cm-text-2)" }}
        >
          {context.icon}
        </div>
        <h1
          className="truncate"
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: 18,
            fontWeight: 700,
            lineHeight: "26px",
            color: "var(--cm-text)",
          }}
        >
          {context.title}
        </h1>
        <span
          className="hidden h-1 w-1 rounded-full sm:block"
          style={{ background: "var(--cm-muted)" }}
          aria-hidden
        />
        <span
          className="hidden truncate sm:block"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-muted)" }}
        >
          {context.subtitle}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-1">
        {searchOpen && context.kind === "conversation" && (
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Rechercher…"
            className="h-9 w-32 sm:w-48"
            style={{
              background: "var(--cm-input)",
              border: "1px solid var(--cm-border)",
              color: "var(--cm-text)",
            }}
          />
        )}
        {context.kind === "conversation" && (
          <IconBtn
            label={searchOpen ? "Fermer la recherche" : "Rechercher dans la conversation"}
            onClick={() => {
              setSearchOpen((current) => !current);
              if (searchOpen) onQuery("");
            }}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </IconBtn>
        )}
        {context.kind === "conversation" && (
          <IconBtn
            label={mediaOnly ? "Afficher tous les messages" : "Afficher les images"}
            onClick={() => onMediaOnly(!mediaOnly)}
          >
            <ImageIcon
              className="h-4 w-4"
              style={{ color: mediaOnly ? "var(--cm-neon)" : undefined }}
            />
          </IconBtn>
        )}
        {context.kind === "conversation" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Plus d'options"
                className="flex h-9 w-9 items-center justify-center rounded-md"
                style={{ color: "var(--cm-text-2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              style={{
                background: "var(--cm-elevated)",
                border: "1px solid var(--cm-border-strong)",
                color: "var(--cm-text)",
              }}
            >
              <DropdownMenuItem onClick={onOpenDetails}>Voir les détails</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMediaOnly(true)}>Médias partagés</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                Rechercher dans la conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md transition-colors"
      style={{ color: "var(--cm-text-2)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function MessageThread({
  context,
  friends,
  projects,
  sponsors,
  messages,
  error,
  filtering,
  onConv,
}: {
  context: Ctx;
  friends: Friend[];
  projects?: ProjectConv[];
  sponsors?: SponsorConv[];
  messages: UiMessage[];
  error: string | null;
  filtering: boolean;
  onConv?: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, context.kind]);
  return (
    <div
      className="cm-scroll flex-1 overflow-y-auto p-4 md:p-6"
      style={{ background: "var(--cm-chat)" }}
    >
      {context.kind === "empty" && (
        <EmptyState
          title="Sélectionne une conversation"
          text="Choisis un ami, une discussion de projet ou une discussion de parrainage dans le menu de gauche."
        />
      )}

      {context.kind === "amis-overview" && <FriendsOverview friends={friends} onConv={onConv} />}
      {context.kind === "projets-overview" && (
        <ProjectsOverview projects={projects} onConv={onConv} />
      )}
      {context.kind === "parrainages-overview" && (
        <SponsorsOverview sponsors={sponsors} onConv={onConv} />
      )}

      {context.kind === "conversation" && error && (
        <p
          className="mx-auto mb-3 max-w-4xl rounded-lg px-3 py-2 text-sm"
          style={{ background: "rgba(255,95,126,.08)", color: "var(--cm-danger)" }}
        >
          {error}
        </p>
      )}
      {context.kind === "conversation" && (
        <MessagesList messages={messages} filtering={filtering} />
      )}
      <div ref={endRef} />
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: "var(--cm-elevated)",
            border: "1px solid var(--cm-border)",
            color: "var(--cm-neon)",
          }}
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <h2
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--cm-text)",
          }}
        >
          {title}
        </h2>
        <p className="mt-2" style={{ fontSize: 14, color: "var(--cm-text-2)" }}>
          {text}
        </p>
      </div>
    </div>
  );
}

function FriendsOverview({
  friends,
  onConv,
}: {
  friends: Friend[];
  onConv?: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="rounded-xl"
        style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}
      >
        {friends.length === 0 && (
          <p className="px-4 py-4 text-[13px]" style={{ color: "var(--cm-muted)" }}>
            Aucune conversation pour l'instant.
          </p>
        )}
        {friends.map((fr, i) => (
          <div
            key={fr.id}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--cm-divider)" }}
          >
            <div className="flex items-center gap-3">
              <Avatar label={fr.name} imageUrl={fr.avatarUrl} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>
                  {fr.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Membre CollabManga</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              style={{ color: "var(--cm-text-2)" }}
              onClick={() => onConv?.(fr.id)}
            >
              Message
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsOverview({
  projects = [],
  onConv,
}: {
  projects?: ProjectConv[];
  onConv?: (id: string) => void;
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {projects.length === 0 && (
        <EmptyState
          title="Aucun projet"
          text="Crée un projet avec le + de la colonne de gauche : sa discussion apparaîtra ici."
        />
      )}
      {projects.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-xl p-4"
          style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}
        >
          <div className="flex items-center gap-3">
            <ThumbTile label={p.name} icon={<Palette className="h-4 w-4" />} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                {p.label} · {p.preview}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            style={{ background: "var(--cm-neon)", color: "#04111E" }}
            onClick={() => onConv?.(p.id)}
          >
            Ouvrir
          </Button>
        </div>
      ))}
    </div>
  );
}

function SponsorsOverview({
  sponsors = [],
  onConv,
}: {
  sponsors?: SponsorConv[];
  onConv?: (id: string) => void;
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {sponsors.length === 0 && (
        <EmptyState
          title="Aucun parrainage"
          text="Crée un parrainage avec le + de la colonne de gauche : sa discussion apparaîtra ici."
        />
      )}
      {sponsors.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-xl p-4"
          style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}
        >
          <div className="flex items-center gap-3">
            <ThumbTile label={s.name} icon={<Megaphone className="h-4 w-4" />} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
                {s.chip} · {s.preview}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            style={{ color: "var(--cm-text-2)" }}
            onClick={() => onConv?.(s.id)}
          >
            Ouvrir
          </Button>
        </div>
      ))}
    </div>
  );
}

function MessagesList({ messages, filtering }: { messages: UiMessage[]; filtering: boolean }) {
  return (
    <div className="mx-auto max-w-4xl">
      {messages.length === 0 ? (
        <EmptyState
          title={filtering ? "Aucun résultat" : "Aucun message"}
          text={
            filtering
              ? "Aucun message ne correspond aux filtres actifs."
              : "Écris le premier message de cette conversation."
          }
        />
      ) : (
        messages.map((m) => <MessageRow key={m.id} m={m} />)
      )}
    </div>
  );
}

function MessageRow({ m }: { m: UiMessage }) {
  return (
    <div className="mb-4 flex gap-3">
      <Avatar label={m.user} size={40} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-baseline gap-2">
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: m.self ? "var(--cm-neon)" : "var(--cm-text)",
            }}
          >
            {m.user}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted)" }}>{m.time}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px", color: "var(--cm-text)" }}>
          {m.text}
        </div>
        {m.attachment === "image" && (
          <div
            className="mt-2 flex max-w-[360px] items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(135deg,#132258,#0a1230)",
              border: "1px solid var(--cm-border)",
              minHeight: m.imageUrl ? undefined : 192,
            }}
          >
            {m.imageUrl ? (
              <img src={m.imageUrl} alt="" className="max-h-72 w-full object-contain" />
            ) : (
              <ImageIcon className="h-8 w-8" style={{ color: "var(--cm-muted)" }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Composer -------------------------------- */

function Composer({
  placeholder,
  allowImage,
  onSend,
}: {
  placeholder: string;
  allowImage: boolean;
  onSend: (text: string, file?: File | null) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(120, el.scrollHeight) + "px";
  };

  const submit = async () => {
    if ((!value.trim() && !imageFile) || sending) return;
    setSending(true);
    try {
      await onSend(value, imageFile);
      setValue("");
      setImageFile(null);
      window.requestAnimationFrame(autoGrow);
    } catch {
      // Le message et l'image restent dans le composer pour permettre un nouvel essai.
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="shrink-0 px-5 py-3.5"
      style={{ background: "var(--cm-topbar)", borderTop: "1px solid var(--cm-divider)" }}
    >
      {imageFile && (
        <div
          className="mb-2 flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{
            background: "var(--cm-input)",
            border: "1px solid var(--cm-border)",
            color: "var(--cm-text-2)",
          }}
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{imageFile.name}</span>
          <button
            type="button"
            onClick={() => setImageFile(null)}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            aria-label="Retirer l'image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {allowImage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Ajouter une image"
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "var(--cm-input)",
                color: "var(--cm-text-2)",
                border: "1px solid var(--cm-border)",
              }}
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </>
        )}

        <div className="flex-1">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder || "Écris un message…"}
            aria-label="Zone de saisie du message"
            rows={1}
            className="w-full resize-none outline-none"
            style={{
              background: "var(--cm-input)",
              border: "1px solid var(--cm-border)",
              borderRadius: 14,
              minHeight: 44,
              maxHeight: 120,
              padding: "12px 14px",
              color: "var(--cm-text)",
              fontSize: 14,
              fontFamily: "var(--font-manrope)",
              lineHeight: "20px",
            }}
          />
        </div>

        <button
          type="button"
          aria-label="Envoyer le message"
          className="flex h-11 items-center justify-center rounded-xl px-4 font-bold transition-colors"
          style={{ background: "var(--cm-neon)", color: "#04111E", minWidth: 44 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-neon-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--cm-neon)")}
          onClick={() => void submit()}
          disabled={sending || (!value.trim() && !imageFile)}
        >
          {sending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- modals --------------------------------- */

function NewMessageModal({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStarted: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DbProfile[]>([]);
  const [selected, setSelected] = useState<DbProfile | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setFirstMessage("");
      setError(null);
      setSearching(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    const t = window.setTimeout(() => {
      void Promise.all([searchProfiles(q), currentUserId()])
        .then(([profiles, ownId]) => setResults(profiles.filter((profile) => profile.id !== ownId)))
        .catch((searchError) => {
          setResults([]);
          setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const start = async () => {
    if (!selected) {
      setError("Choisis un membre dans les résultats.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const convId = await startConversationWith(selected.id);
      if (firstMessage.trim()) await sendMessage(convId, firstMessage.trim());
      onStarted(convId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de démarrer la conversation.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background: "var(--cm-elevated)",
          border: "1px solid var(--cm-border-strong)",
          color: "var(--cm-text)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>
            Nouvelle conversation
          </DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>
            Cherche un membre CollabManga pour démarrer la discussion.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Rechercher un utilisateur</Label>
            <Input
              placeholder="Nom ou @pseudo"
              value={selected ? `@${selected.username}` : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
              }}
              style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
            />
            {!selected && results.length > 0 && (
              <div
                className="grid gap-1 rounded-xl p-1.5"
                style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
              >
                {results.map((p) => (
                  <button
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                    style={{ color: "var(--cm-text)", fontSize: 14, fontWeight: 600 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => setSelected(p)}
                  >
                    <Avatar label={p.display_name || p.username} size={28} />
                    <span>{p.display_name || p.username}</span>
                    <span style={{ color: "var(--cm-muted)", fontSize: 12 }}>@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
            {!selected && searching && (
              <div
                className="flex items-center gap-2 px-2 py-2 text-xs"
                style={{ color: "var(--cm-muted)" }}
              >
                <LoaderCircle className="h-4 w-4 animate-spin" /> Recherche…
              </div>
            )}
            {!selected &&
              !searching &&
              query.trim().replace(/^@/, "").length >= 2 &&
              results.length === 0 &&
              !error && (
                <p className="px-2 py-2 text-xs" style={{ color: "var(--cm-muted)" }}>
                  Aucun utilisateur trouvé.
                </p>
              )}
          </div>
          <div className="grid gap-1.5">
            <Label>Premier message</Label>
            <Textarea
              placeholder="Écris ton premier message…"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
            />
          </div>
          {error && (
            <p className="text-sm font-semibold" style={{ color: "var(--cm-danger)" }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            style={{ color: "var(--cm-text-2)" }}
          >
            Annuler
          </Button>
          <Button
            onClick={() => void start()}
            disabled={starting || !selected}
            style={{ background: "var(--cm-neon)", color: "#04111E" }}
          >
            {starting ? "Démarrage…" : "Démarrer la conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsModal({
  open,
  onOpenChange,
  kind,
  friend,
  title,
  subtitle,
  onViewProfile,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  kind: BaseTab;
  friend?: Friend | null;
  title?: string;
  subtitle?: string;
  onViewProfile?: () => void;
}) {
  const displayName = title || "Conversation";
  const typeLabel =
    kind === "amis"
      ? "Message direct"
      : kind === "projets"
        ? "Conversation de projet"
        : "Discussion de parrainage";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{
          background: "var(--cm-elevated)",
          border: "1px solid var(--cm-border-strong)",
          color: "var(--cm-text)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>
            Détails de la conversation
          </DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>{typeLabel}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          <Avatar label={displayName} imageUrl={friend?.avatarUrl} size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>
              {subtitle || (friend?.username ? `@${friend.username}` : typeLabel)}
            </div>
          </div>
        </div>
        {onViewProfile && (
          <Button
            onClick={onViewProfile}
            style={{ background: "var(--cm-neon)", color: "#04111E" }}
          >
            Voir le profil
          </Button>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            style={{ color: "var(--cm-text-2)" }}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
