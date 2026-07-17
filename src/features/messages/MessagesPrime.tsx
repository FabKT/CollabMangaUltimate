import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  currentUserId,
  listConversations,
  listMessages,
  searchProfiles,
  sendMessage,
  startConversationWith,
  subscribeMessages,
  type DbProfile,
} from "@/lib/db";
import { loadStudioProjects, saveStudioProjects } from "@/lib/studio-projects";
import { getSnapshot } from "@/features/sponsorships/store";
import { SponsorshipModal } from "@/features/sponsorships/SponsorshipModal";
import { appendThreadMessage, listThreadMessages, threadKey } from "@/lib/local-threads";
import {
  Home, Hash, Plus, Compass, Search, Users, FolderKanban, Handshake,
  Send, Paperclip, Image as ImageIcon, Smile, MoreVertical, FileText,
  Lock, Globe2, Sparkles, ChevronLeft, BookOpen, Megaphone, Palette,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default MessagesPage;

/* --------------------------------- data ---------------------------------- */

type BaseTab = "amis" | "projets" | "parrainages";
type ServerType = "public" | "private" | "project" | "sponsorship" | "community";
type RailKey = "base" | string;

interface ServerDef {
  id: string;
  name: string;
  type: ServerType;
  initials: string;
  unread?: boolean;
  channels: { title: string; items: string[] }[];
}

const SERVERS: ServerDef[] = [
  {
    id: "srv-public", name: "Manga Café", type: "public", initials: "MC", unread: true,
    channels: [
      { title: "General", items: ["general", "introductions", "questions"] },
      { title: "Manga", items: ["recommendations", "chapter-talk", "theories"] },
      { title: "Media", items: ["images", "gifs", "references"] },
    ],
  },
  {
    id: "srv-private", name: "Inner Circle", type: "private", initials: "IC",
    channels: [
      { title: "General", items: ["general", "planning"] },
      { title: "Media", items: ["assets", "references"] },
    ],
  },
  {
    id: "srv-project", name: "Kaiju Sunset", type: "project", initials: "KS", unread: true,
    channels: [
      { title: "Project", items: ["project-chat", "chapters", "notes", "tasks"] },
      { title: "Creation", items: ["character-design", "illustrations", "worldbuilding", "feedback"] },
      { title: "Media", items: ["assets", "pages", "references"] },
    ],
  },
  {
    id: "srv-sponsor", name: "Nova Sponsors", type: "sponsorship", initials: "NS",
    channels: [
      { title: "Sponsorship", items: ["discussion", "proposal", "deliverables", "agreement-notes"] },
      { title: "Media", items: ["files", "images", "references"] },
    ],
  },
  {
    id: "srv-community", name: "Shonen Guild", type: "community", initials: "SG",
    channels: [
      { title: "General", items: ["general", "lounge"] },
      { title: "Manga", items: ["weekly-reads", "reviews"] },
    ],
  },
];

/** Conversation privée (mappée depuis Supabase). */
type Friend = { id: string; name: string; preview: string; time: string; unread: number; online: boolean };
/** Message affiché dans le fil. */
type UiMessage = {
  id: string;
  user: string;
  time: string;
  text: string;
  self?: boolean;
  grouped?: boolean;
  attachment?: "image";
  imageUrl?: string;
  mention?: boolean;
};

// Conversations liées : projets (Studio) et parrainages (hub) — types dynamiques.
type ProjectConv = { id: string; name: string; label: string; preview: string; time: string; unread: number };
type SponsorConv = { id: string; name: string; chip: string; preview: string; time: string; unread: number };

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/* --------------------------- small helpers/style ------------------------- */

const rowBase =
  "flex items-center gap-3 rounded-lg cursor-pointer transition-colors select-none";

function ChipType({ type }: { type: ServerType }) {
  const map: Record<ServerType, { label: string; icon: ReactNode }> = {
    public: { label: "Public", icon: <Globe2 className="h-3 w-3" /> },
    private: { label: "Privé", icon: <Lock className="h-3 w-3" /> },
    project: { label: "Projet", icon: <FolderKanban className="h-3 w-3" /> },
    sponsorship: { label: "Parrainage", icon: <Handshake className="h-3 w-3" /> },
    community: { label: "Communauté", icon: <Users className="h-3 w-3" /> },
  };
  const it = map[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
      style={{ borderColor: "var(--cm-border)", color: "var(--cm-text-2)" }}
    >
      {it.icon}
      {it.label}
    </span>
  );
}

function Avatar({ label, online, size = 40 }: { label: string; online?: boolean; size?: number }) {
  const initials = label.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-sm font-extrabold"
        style={{
          background: "linear-gradient(135deg,#1a2550,#0e1738)",
          color: "var(--cm-text)",
          border: "1px solid var(--cm-border)",
        }}
      >
        {initials}
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

function MessagesPage() {
  const rail: RailKey = "base";
  const [baseTab, setBaseTab] = useState<BaseTab>("amis");
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const activeChannel = null;
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        setProjectConvs(rows.map((p) => ({ id: p.id, name: p.title, label: "# discussion", preview: "Espace de discussion du projet", time: "", unread: 0 }))),
      )
      .catch(() => setProjectConvs([]));
    setSponsorConvs(
      getSnapshot().map((s) => ({ id: s.id, name: s.name, chip: s.creator, preview: s.project, time: "", unread: 0 })),
    );
  };
  useEffect(refreshLinked, []);

  const refreshConversations = () => {
    void listConversations()
      .then((rows) =>
        setFriends(
          rows.map((c) => ({
            id: c.id,
            name: c.others[0]?.display_name || c.others[0]?.username || "Conversation",
            preview: c.lastMessage?.content || "Nouvelle conversation",
            time: c.lastMessage ? timeLabel(c.lastMessage.created_at) : timeLabel(c.created_at),
            unread: 0,
            online: false,
          })),
        ),
      )
      .catch(() => setFriends([]));
  };

  useEffect(() => {
    void currentUserId().then(setUid).catch(() => setUid(null));
    refreshConversations();
  }, []);

  const activeFriend = friends.find((f) => f.id === activeConv) ?? null;

  const toUi = (m: { id: string; sender_id: string; content: string; image_url: string | null; created_at: string }): UiMessage => ({
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
      // Fils locaux liés à un projet / parrainage.
      const key = threadKey(baseTab === "projets" ? "project" : "sponsorship", activeConv);
      setMessages(
        listThreadMessages(key).map((m) => ({
          id: m.id,
          user: m.author,
          time: timeLabel(m.createdAt),
          text: m.content,
          self: m.author === "Toi",
        })),
      );
      return;
    }
    if (!activeConv || baseTab !== "amis") {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void listMessages(activeConv)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map(toUi));
      })
      .catch(() => setMessages([]));
    const unsubscribe = subscribeMessages(activeConv, (m) => {
      setMessages((current) => (current.some((x) => x.id === m.id) ? current : [...current, toUi(m)]));
      refreshConversations();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv, baseTab, uid]);

  const handleSend = (text: string) => {
    if (!activeConv || !text.trim()) return;
    if (baseTab === "projets" || baseTab === "parrainages") {
      const key = threadKey(baseTab === "projets" ? "project" : "sponsorship", activeConv);
      const m = appendThreadMessage(key, "Toi", text.trim());
      setMessages((current) => [...current, { id: m.id, user: "Toi", time: timeLabel(m.createdAt), text: m.content, self: true }]);
      return;
    }
    void sendMessage(activeConv, text.trim())
      .then((m) => {
        setMessages((current) => (current.some((x) => x.id === m.id) ? current : [...current, toUi(m)]));
        refreshConversations();
      })
      .catch(() => {});
  };

  const activeServer = null;

  const selectBaseTab = (t: BaseTab) => {
    setBaseTab(t);
    setActiveConv(null);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="h-screen w-full min-w-0 overflow-hidden"
        style={{ background: "var(--cm-bg)", color: "var(--cm-text)", fontFamily: "var(--font-manrope)" }}
      >
        <div
          className="grid h-full w-full overflow-hidden"
          style={{
            gridTemplateColumns: "320px 1fr",
            background: "var(--cm-container)",
          }}
        >
          <ConversationMenu
            rail={rail}
            activeServer={activeServer}
            baseTab={baseTab}
            onBaseTab={selectBaseTab}
            activeConv={activeConv}
            activeChannel={activeChannel}
            onConv={(id) => { setActiveConv(id); }}
            onChannel={() => {}}
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
            rail={rail}
            activeServer={activeServer}
            baseTab={baseTab}
            activeConv={activeConv}
            activeChannel={activeChannel}
            onOpenDetails={() => setDetailsOpen(true)}
            friends={friends}
            projects={projectConvs}
            sponsors={sponsorConvs}
            messages={messages}
            onSend={handleSend}
            onConv={(id) => setActiveConv(id)}
          />
        </div>

        <NewMessageModal
          open={newMessageOpen}
          onOpenChange={setNewMessageOpen}
          onStarted={(convId) => {
            refreshConversations();
            setBaseTab("amis");
            setActiveConv(convId);
          }}
        />
        <DetailsModal open={detailsOpen} onOpenChange={setDetailsOpen} name={activeFriend?.name} />
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
    </TooltipProvider>
  );
}

/** Création rapide d'un projet depuis l'onglet Projets de la messagerie. */
function QuickProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const existing = await loadStudioProjects<Record<string, unknown>>();
      const id = `prj-${Date.now()}`;
      await saveStudioProjects([
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
      onCreated(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>Créer un projet</DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>
            Le projet sera créé dans le Studio et sa discussion ouverte ici.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nom du projet</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du manga" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
          </div>
          <div className="grid gap-1.5">
            <Label>Synopsis</Label>
            <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="Résumé court…" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} style={{ color: "var(--cm-text-2)" }}>Annuler</Button>
          <Button onClick={() => void create()} disabled={saving} style={{ background: "var(--cm-neon)", color: "#04111E" }}>
            {saving ? "Création…" : "Créer le projet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Column 1: Rail ------------------------------ */

function ServerRail({
  active, onSelect, onCreateServer,
}: { active: RailKey; onSelect: (id: RailKey) => void; onCreateServer: () => void }) {
  return (
    <aside
      className="cm-scroll flex h-full flex-col items-center gap-2.5 overflow-y-auto py-3"
      style={{
        background: "var(--cm-rail)",
        borderRight: "1px solid var(--cm-divider)",
        padding: "12px 8px",
      }}
      aria-label="Server rail"
    >
      <RailIcon
        id="base"
        label="Base"
        selected={active === "base"}
        onClick={() => onSelect("base")}
        icon={<Home className="h-5 w-5" />}
      />
      <RailDivider />
      {SERVERS.map((s) => (
        <RailIcon
          key={s.id}
          id={s.id}
          label={`${s.name} · ${s.type}`}
          selected={active === s.id}
          onClick={() => onSelect(s.id)}
          unread={s.unread}
          badge={s.initials}
          type={s.type}
        />
      ))}
      <RailDivider />
      <RailIcon
        id="add"
        label="Créer un serveur"
        onClick={onCreateServer}
        icon={<Plus className="h-5 w-5" />}
        neutralAccent
      />
      <RailIcon
        id="explore"
        label="Explorer les serveurs"
        onClick={() => {}}
        icon={<Compass className="h-5 w-5" />}
        neutralAccent
      />
    </aside>
  );
}

function RailDivider() {
  return <div className="my-1 h-px w-8" style={{ background: "var(--cm-divider)" }} />;
}

function RailIcon({
  label, selected, onClick, icon, badge, unread, neutralAccent, type,
}: {
  id: string;
  label: string;
  selected?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  badge?: string;
  unread?: boolean;
  neutralAccent?: boolean;
  type?: ServerType;
}) {
  const style: CSSProperties = selected
    ? {
        background: "var(--cm-active)",
        border: "1px solid var(--cm-neon-border)",
        color: "var(--cm-neon)",
        boxShadow: "0 0 0 1px rgba(57,255,136,0.15), 0 6px 20px -10px rgba(57,255,136,0.55)",
      }
    : {
        background: "var(--cm-elevated)",
        border: "1px solid var(--cm-border)",
        color: neutralAccent ? "var(--cm-neon)" : "var(--cm-text-2)",
      };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={selected ? "true" : undefined}
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold transition-all hover:brightness-110"
          style={style}
        >
          {selected && (
            <span
              className="absolute -left-2 h-6 w-1 rounded-r"
              style={{ background: "var(--cm-neon)" }}
              aria-hidden
            />
          )}
          {icon ?? badge}
          {unread && (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full"
              style={{ background: "var(--cm-neon)", boxShadow: "0 0 8px var(--cm-neon)" }}
              aria-label="Non lu"
            />
          )}
          {type === "private" && (
            <Lock className="absolute bottom-1 right-1 h-3 w-3" style={{ color: "var(--cm-muted)" }} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

/* -------------------- Column 2: Conversation Menu ------------------------ */

function ConversationMenu(props: {
  rail: RailKey;
  activeServer: ServerDef | null;
  baseTab: BaseTab;
  onBaseTab: (t: BaseTab) => void;
  activeConv: string | null;
  activeChannel: string | null;
  onConv: (id: string) => void;
  onChannel: (c: string) => void;
  onNewMessage: () => void;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
}) {
  const { rail, activeServer, baseTab, onBaseTab, activeConv, activeChannel, onConv, onChannel, onNewMessage, friends, projects, sponsors } = props;

  return (
    <nav
      className="flex h-full flex-col overflow-hidden"
      style={{ background: "var(--cm-menu)", borderRight: "1px solid var(--cm-divider)" }}
      aria-label="Conversation menu"
    >
      {rail === "base" ? (
        <BaseMenu
          baseTab={baseTab}
          onBaseTab={onBaseTab}
          activeConv={activeConv}
          onConv={onConv}
          onNewMessage={onNewMessage}
          friends={friends}
          projects={projects}
          sponsors={sponsors}
        />
      ) : activeServer ? (
        <ServerMenu
          server={activeServer}
          activeChannel={activeChannel}
          onChannel={onChannel}
        />
      ) : null}
    </nav>
  );
}

function SearchRow({ placeholder }: { placeholder: string }) {
  return (
    <div className="p-3" style={{ borderBottom: "1px solid var(--cm-divider)" }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cm-muted)" }} />
        <Input
          placeholder={placeholder}
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
  label, icon, active, onClick,
}: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
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
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--cm-hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r" style={{ background: "var(--cm-neon)" }} />
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
          fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase",
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
  baseTab, onBaseTab, activeConv, onConv, onNewMessage, friends, projects, sponsors,
}: {
  baseTab: BaseTab; onBaseTab: (t: BaseTab) => void;
  activeConv: string | null; onConv: (id: string) => void; onNewMessage: () => void;
  friends: Friend[]; projects: ProjectConv[]; sponsors: SponsorConv[];
}) {
  return (
    <>
      <SearchRow placeholder="Rechercher ou démarrer une conversation" />
      <div className="px-2 pt-2">
        <VerticalTab label="Amis" icon={<Users className="h-5 w-5" />} active={baseTab === "amis"} onClick={() => onBaseTab("amis")} />
        <VerticalTab label="Projets" icon={<FolderKanban className="h-5 w-5" />} active={baseTab === "projets"} onClick={() => onBaseTab("projets")} />
        <VerticalTab label="Parrainages" icon={<Handshake className="h-5 w-5" />} active={baseTab === "parrainages"} onClick={() => onBaseTab("parrainages")} />
      </div>
      <div className="my-2 mx-3 h-px" style={{ background: "var(--cm-divider)" }} />

      <div className="cm-scroll flex-1 overflow-y-auto px-2 pb-3">
        {baseTab === "amis" && (
          <>
            <SectionTitle action={<PlusBtn onClick={onNewMessage} label="Nouvelle conversation" />}>
              Messages privés
            </SectionTitle>
            {friends.length === 0 && (
              <p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>
                Aucune conversation — clique sur + pour en démarrer une.
              </p>
            )}
            {friends.map((f) => (
              <ConvRow
                key={f.id}
                active={activeConv === f.id}
                onClick={() => onConv(f.id)}
                avatar={<Avatar label={f.name} online={f.online} size={36} />}
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
            <SectionTitle action={<PlusBtn onClick={onNewMessage} label="Nouvelle discussion projet" />}>
              Discussions projets
            </SectionTitle>
            {projects.length === 0 && (<p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>Aucun projet — clique sur + pour en créer un.</p>)}
            {projects.map((p) => (
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
            <SectionTitle action={<PlusBtn onClick={onNewMessage} label="Nouvelle discussion parrainage" />}>
              Discussions parrainages
            </SectionTitle>
            {sponsors.length === 0 && (<p className="px-3 py-2 text-[13px]" style={{ color: "var(--cm-muted)" }}>Aucun parrainage — clique sur + pour en créer un.</p>)}
            {sponsors.map((s) => (
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
  const initials = label.split(" ").map((w) => w[0]).slice(0, 2).join("");
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
      <span className="flex items-center gap-1">{icon}<span>{initials}</span></span>
    </div>
  );
}

function ConvRow({
  active, onClick, avatar, title, subtitle, preview, time, unread,
}: {
  active: boolean; onClick: () => void; avatar: ReactNode; title: string;
  subtitle?: string; preview?: string; time?: string; unread?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`${rowBase} w-full text-left`}
      style={{
        height: 56, padding: "6px 12px", borderRadius: 8,
        background: active ? "var(--cm-active)" : "transparent",
        color: active ? "var(--cm-neon)" : "var(--cm-text-2)",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--cm-hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate"
            style={{
              fontSize: 14, fontWeight: unread ? 800 : 700, lineHeight: "20px",
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

function ServerMenu({
  server, activeChannel, onChannel,
}: { server: ServerDef; activeChannel: string | null; onChannel: (c: string) => void }) {
  return (
    <>
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--cm-divider)" }}
      >
        <div className="min-w-0">
          <div className="truncate" style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700, color: "var(--cm-text)" }}>
            {server.name}
          </div>
          <div className="mt-1"><ChipType type={server.type} /></div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Options du serveur"
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: "var(--cm-text-2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
            <DropdownMenuItem>Inviter des membres</DropdownMenuItem>
            <DropdownMenuItem>Paramètres du serveur</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem style={{ color: "var(--cm-danger)" }}>Quitter le serveur</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SearchRow placeholder="Rechercher dans le serveur…" />

      <div className="cm-scroll flex-1 overflow-y-auto px-2 pb-3">
        {server.channels.map((grp, i) => (
          <div key={grp.title}>
            {i > 0 && <div className="my-2 mx-3 h-px" style={{ background: "var(--cm-divider)" }} />}
            <SectionTitle action={<PlusBtn onClick={() => {}} label="Créer un salon" />}>
              {grp.title}
            </SectionTitle>
            {grp.items.map((c) => {
              const active = activeChannel === c;
              return (
                <button
                  key={c}
                  onClick={() => onChannel(c)}
                  aria-current={active ? "true" : undefined}
                  className={`${rowBase} w-full`}
                  style={{
                    height: 36, padding: "0 12px", borderRadius: 8,
                    background: active ? "var(--cm-active)" : "transparent",
                    color: active ? "var(--cm-neon)" : "var(--cm-text-2)",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--cm-hover)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <Hash className="h-4 w-4" />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/* -------------------- Column 3: Active conversation ---------------------- */

function ChatArea({
  rail, activeServer, baseTab, activeConv, activeChannel, onOpenDetails, friends, projects, sponsors, messages, onSend, onConv,
}: {
  rail: RailKey;
  activeServer: ServerDef | null;
  baseTab: BaseTab;
  activeConv: string | null;
  activeChannel: string | null;
  onOpenDetails: () => void;
  friends: Friend[];
  projects: ProjectConv[];
  sponsors: SponsorConv[];
  messages: UiMessage[];
  onSend: (text: string) => void;
  onConv?: (id: string) => void;
}) {
  const context = useMemo(
    () => resolveContext({ rail, activeServer, baseTab, activeConv, activeChannel, friends, projects, sponsors }),
    [rail, activeServer, baseTab, activeConv, activeChannel, friends, projects, sponsors],
  );

  return (
    <section
      className="flex h-full min-w-0 flex-col overflow-hidden"
      style={{ background: "var(--cm-chat)" }}
      aria-label="Active conversation"
    >
      <TopBar context={context} onOpenDetails={onOpenDetails} />
      <MessageThread context={context} friends={friends} projects={projects} sponsors={sponsors} messages={messages} onConv={onConv} />
      {context.canCompose && <Composer placeholder={context.placeholder} onSend={onSend} />}
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
  rail: RailKey; activeServer: ServerDef | null; baseTab: BaseTab;
  activeConv: string | null; activeChannel: string | null; friends: Friend[]; projects: ProjectConv[]; sponsors: SponsorConv[];
}): Ctx {
  const { rail, activeServer, baseTab, activeConv, activeChannel, friends, projects, sponsors } = args;

  if (rail === "base") {
    if (activeConv) {
      const src = baseTab === "amis" ? friends : baseTab === "projets" ? projects : sponsors;
      const item = src.find((x) => x.id === activeConv);
      if (item) {
        const contextLabel =
          baseTab === "amis" ? "Message direct"
          : baseTab === "projets" ? "Conversation de projet"
          : "Discussion parrainage · lié à une annonce";
        return {
          title: item.name,
          subtitle: contextLabel,
          icon: baseTab === "amis" ? <Avatar label={item.name} online size={28} />
            : <ThumbTile label={item.name} icon={baseTab === "projets" ? <BookOpen className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />} />,
          placeholder:
            baseTab === "amis" ? `Message ${item.name}…`
            : baseTab === "projets" ? "Message à la conversation de projet…"
            : "Message à la discussion parrainage…",
          kind: "conversation",
          canCompose: true,
        };
      }
    }
    if (baseTab === "amis") return { title: "Amis", subtitle: "Conversations privées", icon: <Users className="h-5 w-5" />, placeholder: "", kind: "amis-overview", canCompose: false };
    if (baseTab === "projets") return { title: "Projets", subtitle: "Discussions de projet", icon: <FolderKanban className="h-5 w-5" />, placeholder: "", kind: "projets-overview", canCompose: false };
    return { title: "Parrainages", subtitle: "Discussions parrainages", icon: <Handshake className="h-5 w-5" />, placeholder: "", kind: "parrainages-overview", canCompose: false };
  }

  if (activeServer && activeChannel) {
    return {
      title: `# ${activeChannel}`,
      subtitle: activeServer.name,
      icon: <Hash className="h-5 w-5" />,
      placeholder: `Message #${activeChannel}…`,
      kind: "conversation",
      canCompose: true,
    };
  }

  return {
    title: activeServer?.name ?? "Serveur",
    subtitle: "Sélectionne un salon dans la liste",
    icon: <Sparkles className="h-5 w-5" />,
    placeholder: "",
    kind: "empty",
    canCompose: false,
  };
}

function TopBar({ context, onOpenDetails }: { context: Ctx; onOpenDetails: () => void }) {
  return (
    <header
      className="flex shrink-0 items-center justify-between px-5"
      style={{
        height: 64,
        background: "var(--cm-topbar)",
        borderBottom: "1px solid var(--cm-divider)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--cm-elevated)", color: "var(--cm-text-2)" }}>
          {context.icon}
        </div>
        <h1
          className="truncate"
          style={{ fontFamily: "var(--font-sora)", fontSize: 18, fontWeight: 700, lineHeight: "26px", color: "var(--cm-text)" }}
        >
          {context.title}
        </h1>
        <span className="h-1 w-1 rounded-full" style={{ background: "var(--cm-muted)" }} aria-hidden />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--cm-muted)" }}>
          {context.subtitle}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <IconBtn label="Recherche"><Search className="h-4 w-4" /></IconBtn>
        <IconBtn label="Médias et fichiers"><ImageIcon className="h-4 w-4" /></IconBtn>
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
          <DropdownMenuContent align="end" style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
            <DropdownMenuItem onClick={onOpenDetails}>Voir les détails</DropdownMenuItem>
            <DropdownMenuItem>Médias partagés</DropdownMenuItem>
            <DropdownMenuItem>Rechercher dans la conversation</DropdownMenuItem>
            <DropdownMenuItem>Mettre en sourdine</DropdownMenuItem>
            <DropdownMenuItem>Marquer comme non lu</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem style={{ color: "var(--cm-danger)" }}>Signaler / Bloquer</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
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

function MessageThread({ context, friends, projects, sponsors, messages, onConv }: { context: Ctx; friends: Friend[]; projects?: ProjectConv[]; sponsors?: SponsorConv[]; messages: UiMessage[]; onConv?: (id: string) => void }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, context.kind]);
  return (
    <div className="cm-scroll flex-1 overflow-y-auto" style={{ background: "var(--cm-chat)", padding: 24 }}>
      {context.kind === "empty" && (
        <EmptyState
          title="Sélectionne une conversation"
          text="Choisis un ami, une discussion de projet, une discussion de parrainage ou un salon dans le menu de gauche."
        />
      )}

      {context.kind === "amis-overview" && <FriendsOverview friends={friends} onConv={onConv} />}
      {context.kind === "projets-overview" && <ProjectsOverview projects={projects} onConv={onConv} />}
      {context.kind === "parrainages-overview" && <SponsorsOverview sponsors={sponsors} onConv={onConv} />}

      {context.kind === "conversation" && <MessagesList messages={messages} />}
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
          style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)", color: "var(--cm-neon)" }}
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 20, fontWeight: 700, color: "var(--cm-text)" }}>{title}</h2>
        <p className="mt-2" style={{ fontSize: 14, color: "var(--cm-text-2)" }}>{text}</p>
      </div>
    </div>
  );
}

function FriendsOverview({ friends, onConv }: { friends: Friend[]; onConv?: (id: string) => void }) {
  const filters = ["Tous", "En attente", "Ajouter un ami"] as const;
  const [f, setF] = useState<(typeof filters)[number]>("Tous");
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtres amis">
        {filters.map((x) => {
          const active = f === x;
          const isCTA = x === "Ajouter un ami";
          return (
            <button
              key={x}
              role="tab"
              aria-selected={active}
              onClick={() => setF(x)}
              className="rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
              style={
                isCTA
                  ? { background: "var(--cm-neon)", color: "#04111E" }
                  : active
                  ? { background: "var(--cm-active)", color: "var(--cm-neon)" }
                  : { background: "transparent", color: "var(--cm-text-2)" }
              }
            >
              {x}
            </button>
          );
        })}
      </div>
      <div className="rounded-xl" style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}>
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
              <Avatar label={fr.name} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>{fr.name}</div>
                <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Membre CollabManga</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" style={{ color: "var(--cm-text-2)" }} onClick={() => onConv?.(fr.id)}>Message</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsOverview({ projects = [], onConv }: { projects?: ProjectConv[]; onConv?: (id: string) => void }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {projects.length === 0 && (
        <EmptyState title="Aucun projet" text="Crée un projet avec le + de la colonne de gauche : sa discussion apparaîtra ici." />
      )}
      {projects.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}>
          <div className="flex items-center gap-3">
            <ThumbTile label={p.name} icon={<Palette className="h-4 w-4" />} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{p.label} · {p.preview}</div>
            </div>
          </div>
          <Button size="sm" style={{ background: "var(--cm-neon)", color: "#04111E" }} onClick={() => onConv?.(p.id)}>Ouvrir</Button>
        </div>
      ))}
    </div>
  );
}

function SponsorsOverview({ sponsors = [], onConv }: { sponsors?: SponsorConv[]; onConv?: (id: string) => void }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {sponsors.length === 0 && (
        <EmptyState title="Aucun parrainage" text="Crée un parrainage avec le + de la colonne de gauche : sa discussion apparaîtra ici." />
      )}
      {sponsors.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border)" }}>
          <div className="flex items-center gap-3">
            <ThumbTile label={s.name} icon={<Megaphone className="h-4 w-4" />} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--cm-text)" }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>{s.chip} · {s.preview}</div>
            </div>
          </div>
          <Button size="sm" variant="ghost" style={{ color: "var(--cm-text-2)" }} onClick={() => onConv?.(s.id)}>Ouvrir</Button>
        </div>
      ))}
    </div>
  );
}

function MessagesList({ messages }: { messages: UiMessage[] }) {
  return (
    <div className="mx-auto max-w-4xl">
      {messages.length === 0 ? (
        <EmptyState title="Aucun message" text="Écris le premier message de cette conversation." />
      ) : (
        messages.map((m) => <MessageRow key={m.id} m={m} />)
      )}
    </div>
  );
}

function MessageRow({ m }: { m: UiMessage }) {
  return (
    <div className="mb-4 flex gap-3">
      {m.grouped ? (
        <div className="w-10 shrink-0" aria-hidden />
      ) : (
        <Avatar label={m.user} size={40} />
      )}
      <div className="min-w-0 flex-1">
        {!m.grouped && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span style={{ fontSize: 14, fontWeight: 800, color: m.self ? "var(--cm-neon)" : "var(--cm-text)" }}>{m.user}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cm-muted)" }}>{m.time}</span>
          </div>
        )}
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

function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(120, el.scrollHeight) + "px";
  };

  const submit = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
    autoGrow();
  };

  return (
    <div
      className="shrink-0 px-5 py-3.5"
      style={{ background: "var(--cm-topbar)", borderTop: "1px solid var(--cm-divider)" }}
    >
      <div className="flex items-end gap-2">
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Ajouter une pièce jointe"
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: "var(--cm-input)", color: "var(--cm-text-2)", border: "1px solid var(--cm-border)" }}
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top" align="start" sideOffset={8}
            className="w-64 p-1.5"
            style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", borderRadius: 16 }}
          >
            {[
              { icon: <ImageIcon className="h-4 w-4" />, label: "Envoyer une image" },
              { icon: <FileText className="h-4 w-4" />, label: "Envoyer un fichier" },
              { icon: <Smile className="h-4 w-4" />, label: "Ajouter un GIF" },
              { icon: <FolderKanban className="h-4 w-4" />, label: "Joindre un projet" },
              { icon: <BookOpen className="h-4 w-4" />, label: "Joindre un chapitre" },
              { icon: <ImageIcon className="h-4 w-4" />, label: "Joindre une page manga" },
              { icon: <Megaphone className="h-4 w-4" />, label: "Joindre une annonce parrainage" },
              { icon: <Palette className="h-4 w-4" />, label: "Joindre une illustration" },
              { icon: <Handshake className="h-4 w-4" />, label: "Joindre une proposition" },
            ].map((opt) => (
              <button
                key={opt.label}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left"
                style={{ color: "var(--cm-text)", fontSize: 14, fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => setAttachOpen(false)}
              >
                <span style={{ color: "var(--cm-text-2)" }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => { setValue(e.target.value); autoGrow(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
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

        <IconBtn label="Ajouter un GIF"><Smile className="h-4 w-4" /></IconBtn>
        <IconBtn label="Ajouter une image"><ImageIcon className="h-4 w-4" /></IconBtn>

        <button
          aria-label="Envoyer le message"
          className="flex h-11 items-center justify-center rounded-xl px-4 font-bold transition-colors"
          style={{ background: "var(--cm-neon)", color: "#04111E", minWidth: 44 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cm-neon-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--cm-neon)")}
          onClick={submit}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- modals --------------------------------- */

function ModalShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: "var(--cm-text)" }}>{children}</div>
  );
}

function CreateServerModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [type, setType] = useState<ServerType>("public");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
        <ModalShell>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>Créer un serveur</DialogTitle>
            <DialogDescription style={{ color: "var(--cm-text-2)" }}>
              Organise tes discussions autour d'un projet, d'une communauté ou d'un parrainage.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nom du serveur</Label>
              <Input placeholder="Ex. Kaiju Sunset" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["public", "private", "project", "sponsorship"] as ServerType[]).map((t) => {
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="rounded-lg px-3 py-1.5 text-sm font-bold"
                      style={active
                        ? { background: "var(--cm-active)", color: "var(--cm-neon)", border: "1px solid var(--cm-neon-border)" }
                        : { background: "transparent", color: "var(--cm-text-2)", border: "1px solid var(--cm-border)" }}
                    >
                      {t === "public" ? "Public" : t === "private" ? "Privé" : t === "project" ? "Projet" : "Parrainage"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Décris ton serveur…" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
            </div>
            {type === "project" && (
              <div className="grid gap-1.5">
                <Label>Projet lié</Label>
                <Input placeholder="Sélectionne un projet CollabManga" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
              </div>
            )}
            {type === "sponsorship" && (
              <div className="grid gap-1.5">
                <Label>Annonce de parrainage liée</Label>
                <Input placeholder="Sélectionne une annonce" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Salons texte par défaut</Label>
              <Input defaultValue="general, notes, media" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} style={{ color: "var(--cm-text-2)" }}>Annuler</Button>
            <Button onClick={() => onOpenChange(false)} style={{ background: "var(--cm-neon)", color: "#04111E" }}>Créer le serveur</Button>
          </DialogFooter>
        </ModalShell>
      </DialogContent>
    </Dialog>
  );
}

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setSelected(null); setFirstMessage(""); setError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) { setResults([]); return; }
    const t = window.setTimeout(() => {
      void searchProfiles(q).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const start = async () => {
    if (!selected) { setError("Choisis un membre dans les résultats."); return; }
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
      <DialogContent style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>Nouvelle conversation</DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>Cherche un membre CollabManga pour démarrer la discussion.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Rechercher un utilisateur</Label>
            <Input
              placeholder="Nom ou @pseudo"
              value={selected ? `@${selected.username}` : query}
              onChange={(e) => { setSelected(null); setQuery(e.target.value); }}
              style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}
            />
            {!selected && results.length > 0 && (
              <div className="grid gap-1 rounded-xl p-1.5" style={{ background: "var(--cm-input)", border: "1px solid var(--cm-border)" }}>
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
            <p className="text-sm font-semibold" style={{ color: "var(--cm-danger)" }}>{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} style={{ color: "var(--cm-text-2)" }}>Annuler</Button>
          <Button onClick={() => void start()} disabled={starting} style={{ background: "var(--cm-neon)", color: "#04111E" }}>
            {starting ? "Démarrage…" : "Démarrer la conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsModal({ open, onOpenChange, name }: { open: boolean; onOpenChange: (v: boolean) => void; name?: string }) {
  const displayName = name || "Conversation";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--cm-elevated)", border: "1px solid var(--cm-border-strong)", color: "var(--cm-text)" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-sora)" }}>Détails de la conversation</DialogTitle>
          <DialogDescription style={{ color: "var(--cm-text-2)" }}>Aperçu du contexte lié à cette conversation.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          <Avatar label={displayName} size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--cm-muted)" }}>Membre CollabManga</div>
          </div>
        </div>
        <div className="grid gap-2">
          <Button style={{ background: "var(--cm-neon)", color: "#04111E" }}>Voir le profil</Button>
          <Button variant="ghost" style={{ color: "var(--cm-text)" }}>Inviter dans un projet</Button>
          <Button variant="ghost" style={{ color: "var(--cm-danger)" }}>Bloquer / Signaler</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} style={{ color: "var(--cm-text-2)" }}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
