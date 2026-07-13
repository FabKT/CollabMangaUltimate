import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  FileText,
  FolderKanban,
  Handshake,
  Image as ImageIcon,
  Info,
  Link2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Users,
  X,
} from "lucide-react";

type ConversationKind = "project" | "sponsorship" | "friend";

type Conversation = {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle: string;
  initials: string;
  participants: string[];
  linkedLabel?: string;
  unread: number;
  pinned?: boolean;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  author: "me" | "them";
  name: string;
  initials: string;
  body: string;
  createdAt: string;
  attachment?: {
    label: string;
    detail: string;
    icon: "project" | "sponsorship" | "file" | "image";
  };
};

type StoreState = {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
};

const STORAGE_KEY = "collabmanga.messages.home.v1";

const kindMeta: Record<ConversationKind, { label: string; icon: typeof FolderKanban; description: string }> = {
  project: {
    label: "Projets",
    icon: FolderKanban,
    description: "Discussions liees aux projets manga, chapitres, pages et collaborateurs.",
  },
  sponsorship: {
    label: "Parrainages",
    icon: Handshake,
    description: "Echanges autour des campagnes, options, validations et livrables.",
  },
  friend: {
    label: "Amis",
    icon: Users,
    description: "Messages prives avec les createurs, lecteurs et collaborateurs.",
  },
};

const tabs: ConversationKind[] = ["project", "sponsorship", "friend"];

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const seedState: StoreState = {
  conversations: [
    {
      id: "project-nightfall",
      kind: "project",
      title: "Nightfall Chronicles",
      subtitle: "Equipe principale",
      initials: "NC",
      participants: ["Vous", "Aiko Tanaka", "Ren Sato"],
      linkedLabel: "Projet manga",
      unread: 2,
      pinned: true,
      updatedAt: "2026-07-12T12:42:00.000Z",
    },
    {
      id: "project-hollow",
      kind: "project",
      title: "Hollow Bloom",
      subtitle: "Retours chapitre 4",
      initials: "HB",
      participants: ["Vous", "Mika Ito"],
      linkedLabel: "Chapitre en relecture",
      unread: 0,
      updatedAt: "2026-07-11T18:20:00.000Z",
    },
    {
      id: "sponsor-orion",
      kind: "sponsorship",
      title: "Orion Ink - Volume 2",
      subtitle: "Demande en attente",
      initials: "OI",
      participants: ["Vous", "PanelPulse"],
      linkedLabel: "Parrainage pending",
      unread: 1,
      pinned: true,
      updatedAt: "2026-07-12T09:12:00.000Z",
    },
    {
      id: "sponsor-recap",
      kind: "sponsorship",
      title: "Hollow Sun recap",
      subtitle: "Livrables a verifier",
      initials: "HS",
      participants: ["Vous", "Midori Talks"],
      linkedLabel: "Campagne YouTube",
      unread: 0,
      updatedAt: "2026-07-10T15:10:00.000Z",
    },
    {
      id: "friend-aiko",
      kind: "friend",
      title: "Aiko Tanaka",
      subtitle: "Dessinatrice",
      initials: "AT",
      participants: ["Vous", "Aiko Tanaka"],
      linkedLabel: "En ligne",
      unread: 0,
      updatedAt: "2026-07-12T08:34:00.000Z",
    },
    {
      id: "friend-ren",
      kind: "friend",
      title: "Ren Sato",
      subtitle: "Scenariste",
      initials: "RS",
      participants: ["Vous", "Ren Sato"],
      linkedLabel: "Disponible",
      unread: 0,
      updatedAt: "2026-07-09T19:30:00.000Z",
    },
  ],
  messages: {
    "project-nightfall": [
      {
        id: "m-1",
        conversationId: "project-nightfall",
        author: "them",
        name: "Aiko Tanaka",
        initials: "AT",
        body: "J'ai depose les recherches visuelles du chapitre 4. Les deux premieres pages sont pretes pour validation.",
        createdAt: "2026-07-12T12:14:00.000Z",
        attachment: { label: "Chapitre 4", detail: "Brouillon de pages", icon: "project" },
      },
      {
        id: "m-2",
        conversationId: "project-nightfall",
        author: "me",
        name: "Vous",
        initials: "VO",
        body: "Parfait. Je relis la sequence ce soir et je te note les ajustements de rythme.",
        createdAt: "2026-07-12T12:18:00.000Z",
      },
      {
        id: "m-3",
        conversationId: "project-nightfall",
        author: "them",
        name: "Ren Sato",
        initials: "RS",
        body: "Je vais aussi verifier si la transition vers la scene de combat reste claire.",
        createdAt: "2026-07-12T12:42:00.000Z",
      },
    ],
    "project-hollow": [
      {
        id: "m-4",
        conversationId: "project-hollow",
        author: "them",
        name: "Mika Ito",
        initials: "MI",
        body: "Le twist fonctionne mieux avec la derniere version. Il reste juste une bulle trop longue en page 7.",
        createdAt: "2026-07-11T18:20:00.000Z",
      },
    ],
    "sponsor-orion": [
      {
        id: "m-5",
        conversationId: "sponsor-orion",
        author: "them",
        name: "PanelPulse",
        initials: "PP",
        body: "Merci pour la demande. Je peux couvrir la sortie avec une review courte et deux shorts.",
        createdAt: "2026-07-12T09:12:00.000Z",
        attachment: { label: "Options proposees", detail: "Review + shorts", icon: "sponsorship" },
      },
    ],
    "sponsor-recap": [
      {
        id: "m-6",
        conversationId: "sponsor-recap",
        author: "me",
        name: "Vous",
        initials: "VO",
        body: "Je t'envoie les visuels valides et le resume court pour la video.",
        createdAt: "2026-07-10T15:10:00.000Z",
      },
    ],
    "friend-aiko": [
      {
        id: "m-7",
        conversationId: "friend-aiko",
        author: "them",
        name: "Aiko Tanaka",
        initials: "AT",
        body: "Je suis dispo demain matin pour revoir les silhouettes des personnages secondaires.",
        createdAt: "2026-07-12T08:34:00.000Z",
      },
    ],
    "friend-ren": [
      {
        id: "m-8",
        conversationId: "friend-ren",
        author: "them",
        name: "Ren Sato",
        initials: "RS",
        body: "On peut garder l'idee du duel, mais il faudrait renforcer l'enjeu emotionnel avant.",
        createdAt: "2026-07-09T19:30:00.000Z",
      },
    ],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeKind(value: unknown): ConversationKind {
  return tabs.includes(value as ConversationKind) ? (value as ConversationKind) : "friend";
}

function normalizeAttachment(value: unknown): ChatMessage["attachment"] | undefined {
  if (!isRecord(value)) return undefined;
  const rawIcon = asString(value.icon, asString(value.kind));
  const icon: ChatMessage["attachment"]["icon"] =
    rawIcon === "project" || rawIcon === "sponsorship" || rawIcon === "file" || rawIcon === "image"
      ? rawIcon
      : rawIcon === "gif" || rawIcon === "link"
        ? "file"
      : "file";
  return {
    label: asString(value.label, asString(value.name, asString(value.title, asString(value.alt, "Attachment")))),
    detail: asString(value.detail, asString(value.caption, asString(value.description, asString(value.type)))),
    icon,
  };
}

function normalizeConversation(value: unknown, index: number): Conversation {
  const item = isRecord(value) ? value : {};
  return {
    id: asString(item.id, `conversation-${index}`),
    kind: normalizeKind(item.kind),
    title: asString(item.title, "Conversation"),
    subtitle: asString(item.subtitle, asString(item.preview, asString(item.context))),
    initials: asString(item.initials, asString(item.avatarInitials, "CM")).slice(0, 3),
    participants: Array.isArray(item.participants)
      ? item.participants.filter((participant): participant is string => typeof participant === "string")
      : [],
    linkedLabel: asString(item.linkedLabel, asString(item.meta)) || undefined,
    unread: Math.max(0, asNumber(item.unread, 0)),
    pinned: Boolean(item.pinned),
    updatedAt: asString(item.updatedAt, asString(item.timestamp, nowIso())),
  };
}

function normalizeMessage(value: unknown, fallbackConversationId: string, index: number): ChatMessage {
  const item = isRecord(value) ? value : {};
  const rawAuthor = asString(item.author);
  return {
    id: asString(item.id, `message-${fallbackConversationId}-${index}`),
    conversationId: asString(item.conversationId, fallbackConversationId),
    author: rawAuthor === "me" ? "me" : "them",
    name: asString(item.name, rawAuthor === "me" ? "Vous" : "Contact"),
    initials: asString(item.initials, rawAuthor === "me" ? "VO" : "CO").slice(0, 3),
    body: asString(item.body, asString(item.content, asString(item.text))),
    createdAt: asString(item.createdAt, nowIso()),
    attachment: normalizeAttachment(item.attachment),
  };
}

function normalizeMessages(value: unknown): Record<string, ChatMessage[]> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([conversationId, messages]) => [
      conversationId,
      Array.isArray(messages)
        ? messages.map((message, index) => normalizeMessage(message, conversationId, index))
        : [],
    ]),
  );
}

function normalizeStoreState(value: unknown): StoreState {
  if (!isRecord(value)) return seedState;
  const conversations = Array.isArray(value.conversations)
    ? value.conversations.map((conversation, index) => normalizeConversation(conversation, index))
    : seedState.conversations;
  const messages = normalizeMessages(value.messages);
  conversations.forEach((conversation) => {
    messages[conversation.id] ??= [];
  });
  return { conversations, messages };
}

function loadState(): StoreState {
  if (typeof window === "undefined") return seedState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState;
    return normalizeStoreState(JSON.parse(raw));
  } catch {
    return seedState;
  }
}

function saveState(state: StoreState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the UI usable if the browser refuses local persistence.
  }
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function lastMessage(messages: ChatMessage[] | undefined) {
  return messages?.[messages.length - 1] ?? null;
}

export default function MessagesPage() {
  const [store, setStore] = useState<StoreState>(() => loadState());
  const [tab, setTab] = useState<ConversationKind>("project");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => seedState.conversations.find((item) => item.kind === "project")?.id ?? "");
  const [draft, setDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [pendingAttachment, setPendingAttachment] = useState<ChatMessage["attachment"] | null>(null);

  useEffect(() => {
    saveState(store);
  }, [store]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return store.conversations
      .filter((conversation) => conversation.kind === tab)
      .filter((conversation) => {
        if (!term) return true;
        return [
          conversation.title,
          conversation.subtitle,
          conversation.linkedLabel ?? "",
          conversation.participants.join(" "),
        ].join(" ").toLowerCase().includes(term);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [query, store.conversations, tab]);

  const selected = store.conversations.find((conversation) => conversation.id === selectedId) ?? filtered[0] ?? null;
  const messages = selected ? store.messages[selected.id] ?? [] : [];

  useEffect(() => {
    if (!selected && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selected]);

  useEffect(() => {
    if (!selected || selected.unread === 0) return;
    setStore((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === selected.id ? { ...conversation, unread: 0 } : conversation,
      ),
    }));
  }, [selected?.id]);

  const selectTab = (kind: ConversationKind) => {
    setTab(kind);
    setQuery("");
    const first = store.conversations
      .filter((conversation) => conversation.kind === kind)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
    setSelectedId(first?.id ?? "");
  };

  const sendMessage = () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text && !pendingAttachment) return;
    const createdAt = nowIso();
    const message: ChatMessage = {
      id: uid("msg"),
      conversationId: selected.id,
      author: "me",
      name: "Vous",
      initials: "VO",
      body: text || "Piece jointe envoyee.",
      createdAt,
      attachment: pendingAttachment ?? undefined,
    };

    setStore((current) => ({
      conversations: current.conversations.map((conversation) =>
        conversation.id === selected.id
          ? {
              ...conversation,
              updatedAt: createdAt,
              subtitle: "Dernier message envoye",
            }
          : conversation,
      ),
      messages: {
        ...current.messages,
        [selected.id]: [...(current.messages[selected.id] ?? []), message],
      },
    }));
    setDraft("");
    setPendingAttachment(null);
  };

  const createConversation = (input: {
    kind: ConversationKind;
    title: string;
    subtitle: string;
    firstMessage: string;
    linkedLabel?: string;
  }) => {
    const id = uid(input.kind);
    const createdAt = nowIso();
    const initials = input.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "CM";
    const conversation: Conversation = {
      id,
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      initials,
      participants: ["Vous", input.title],
      linkedLabel: input.linkedLabel,
      unread: 0,
      updatedAt: createdAt,
    };
    const firstMessage: ChatMessage = {
      id: uid("msg"),
      conversationId: id,
      author: "me",
      name: "Vous",
      initials: "VO",
      body: input.firstMessage,
      createdAt,
    };

    setStore((current) => ({
      conversations: [conversation, ...current.conversations],
      messages: { ...current.messages, [id]: [firstMessage] },
    }));
    setTab(input.kind);
    setSelectedId(id);
    setNewOpen(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background px-4 py-4 text-text-primary md:px-6 md:py-6 lg:px-8 lg:py-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-9">Messages</h1>
          <p className="mt-1 max-w-2xl text-[13px] font-medium text-text-secondary">
            Centralise les discussions de projets, les parrainages et les messages avec tes amis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Notifications">
            <Bell className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-neon px-4 text-[14px] font-bold text-[#04111E] transition-colors hover:bg-neon-hover"
          >
            <Plus className="h-4 w-4" />
            Nouveau message
          </button>
        </div>
      </header>

      <section
        className={[
          "grid h-[calc(100vh-154px)] min-h-[620px] grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]",
          detailsOpen ? "xl:grid-cols-[380px_minmax(0,1fr)_320px]" : "xl:grid-cols-[380px_minmax(0,1fr)]",
        ].join(" ")}
      >
        <aside className="flex min-h-0 flex-col rounded-[22px] border border-border-default bg-panel">
          <div className="border-b border-border-default p-3">
            <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-border-default bg-input-bg p-1">
              {tabs.map((item) => {
                const active = tab === item;
                const Icon = kindMeta[item].icon;
                const unread = store.conversations.filter((conversation) => conversation.kind === item).reduce((sum, item) => sum + item.unread, 0);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectTab(item)}
                    className={[
                      "relative flex h-12 items-center justify-center gap-2 rounded-[12px] text-[12px] font-bold transition",
                      active ? "bg-neon-soft text-neon" : "text-text-secondary hover:text-text-primary",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{kindMeta[item].label}</span>
                    {unread > 0 && (
                      <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-neon px-1 text-[10px] leading-4 text-[#04111E]">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Rechercher dans ${kindMeta[tab].label.toLowerCase()}...`}
                className="h-11 w-full rounded-[14px] border border-border-default bg-input-bg pl-9 pr-3 text-[14px] text-text-primary outline-none transition focus:border-neon focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <EmptyList kind={tab} />
            ) : (
              <div className="space-y-2">
                {filtered.map((conversation) => (
                  <ConversationCard
                    key={conversation.id}
                    conversation={conversation}
                    active={selected?.id === conversation.id}
                    last={lastMessage(store.messages[conversation.id])}
                    onClick={() => setSelectedId(conversation.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-border-default bg-container">
          {selected ? (
            <>
              <ChatHeader conversation={selected} onToggleDetails={() => setDetailsOpen((value) => !value)} />
              <MessageStream messages={messages} />
              <Composer
                draft={draft}
                onDraftChange={setDraft}
                onSend={sendMessage}
                attachment={pendingAttachment}
                onAttachment={setPendingAttachment}
                onClearAttachment={() => setPendingAttachment(null)}
                kind={selected.kind}
              />
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] border border-border-default bg-neon-soft text-neon">
                  <Send className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-display text-[22px] font-bold">Aucune conversation selectionnee</h2>
                <p className="mt-2 max-w-md text-[14px] leading-6 text-text-secondary">
                  Choisis une discussion dans la liste ou cree un nouveau message.
                </p>
              </div>
            </div>
          )}
        </section>

        {selected && detailsOpen && (
          <aside className="hidden min-h-0 overflow-y-auto rounded-[22px] border border-border-default bg-panel p-4 xl:block">
            <ConversationDetails conversation={selected} />
          </aside>
        )}
      </section>

      {newOpen && (
        <NewConversationDialog
          initialKind={tab}
          onClose={() => setNewOpen(false)}
          onCreate={createConversation}
        />
      )}
    </main>
  );
}

function ConversationCard({
  conversation,
  active,
  last,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  last: ChatMessage | null;
  onClick: () => void;
}) {
  const Icon = kindMeta[conversation.kind].icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-[18px] border p-3 text-left transition",
        active
          ? "border-neon-border bg-neon-soft shadow-[0_0_0_1px_rgba(57,255,136,0.20)]"
          : "border-transparent bg-transparent hover:border-border-default hover:bg-input-bg/70",
      ].join(" ")}
    >
      <div className="relative grid h-11 w-11 place-items-center rounded-[14px] border border-border-default bg-surface font-display text-[13px] font-bold text-neon">
        {conversation.initials}
        {conversation.kind === "friend" && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-neon" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-bold text-text-primary">{conversation.title}</span>
          {conversation.pinned && <Check className="h-3.5 w-3.5 shrink-0 text-neon" />}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
          <Icon className="h-3.5 w-3.5" />
          {conversation.linkedLabel ?? kindMeta[conversation.kind].label}
        </div>
        <p className="mt-1 truncate text-[13px] text-text-secondary">
          {last?.body ?? conversation.subtitle}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-[11px] font-semibold text-text-muted">{formatTime(conversation.updatedAt)}</span>
        {conversation.unread > 0 && (
          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-neon px-1.5 text-[11px] font-bold text-[#04111E]">
            {conversation.unread}
          </span>
        )}
      </div>
    </button>
  );
}

function ChatHeader({ conversation, onToggleDetails }: { conversation: Conversation; onToggleDetails: () => void }) {
  const Icon = kindMeta[conversation.kind].icon;
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-default bg-panel/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-border-default bg-input-bg font-display text-[13px] font-bold text-neon">
          {conversation.initials}
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[18px] font-bold">{conversation.title}</h2>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-secondary">
            <Icon className="h-3.5 w-3.5 text-neon" />
            <span className="truncate">{conversation.subtitle}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IconButton label="Details" onClick={onToggleDetails}>
          <Info className="h-4 w-4" />
        </IconButton>
        <IconButton label="More">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}

function MessageStream({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.author === "me";
  return (
    <article className={`flex gap-3 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-border-default bg-input-bg font-display text-[12px] font-bold text-neon">
          {message.initials}
        </div>
      )}
      <div className={`max-w-[min(680px,82%)] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`mb-1 flex items-center gap-2 text-[11px] text-text-muted ${mine ? "flex-row-reverse" : ""}`}>
          <span className="font-bold text-text-secondary">{message.name}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div
          className={[
            "rounded-[18px] border px-4 py-3 text-[14px] leading-6",
            mine
              ? "border-neon-border bg-neon-soft text-text-primary"
              : "border-border-default bg-panel text-text-secondary",
          ].join(" ")}
        >
          <p>{message.body}</p>
          {message.attachment && <AttachmentPreview attachment={message.attachment} compact />}
        </div>
      </div>
    </article>
  );
}

function Composer({
  draft,
  onDraftChange,
  onSend,
  attachment,
  onAttachment,
  onClearAttachment,
  kind,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  attachment: ChatMessage["attachment"] | null;
  onAttachment: (attachment: ChatMessage["attachment"]) => void;
  onClearAttachment: () => void;
  kind: ConversationKind;
}) {
  const attachProject = kind === "sponsorship"
    ? { label: "Annonce de parrainage", detail: "Lien de campagne", icon: "sponsorship" as const }
    : { label: "Projet manga", detail: "Lien de projet", icon: "project" as const };

  return (
    <footer className="border-t border-border-default bg-panel/80 p-3">
      <div className="mx-auto max-w-4xl">
        {attachment && (
          <div className="mb-2 flex items-center justify-between rounded-[14px] border border-border-default bg-input-bg px-3 py-2">
            <AttachmentPreview attachment={attachment} compact />
            <button
              type="button"
              onClick={onClearAttachment}
              className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface hover:text-text-primary"
              aria-label="Retirer la piece jointe"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-[18px] border border-border-default bg-input-bg p-2">
          <div className="flex gap-1">
            <IconButton label="Joindre un lien" onClick={() => onAttachment(attachProject)}>
              <Link2 className="h-4 w-4" />
            </IconButton>
            <IconButton label="Joindre un fichier" onClick={() => onAttachment({ label: "Document", detail: "Fichier ajoute", icon: "file" })}>
              <Paperclip className="h-4 w-4" />
            </IconButton>
            <IconButton label="Joindre une image" onClick={() => onAttachment({ label: "Image", detail: "Reference visuelle", icon: "image" })}>
              <ImageIcon className="h-4 w-4" />
            </IconButton>
          </div>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder="Ecrire un message..."
            className="max-h-36 min-h-11 resize-none rounded-[14px] border-0 bg-transparent px-2 py-3 text-[14px] leading-5 text-text-primary outline-none placeholder:text-text-muted"
          />
          <div className="flex items-center gap-1">
            <IconButton label="Emoji">
              <Smile className="h-4 w-4" />
            </IconButton>
            <button
              type="button"
              onClick={onSend}
              className="grid h-11 w-11 place-items-center rounded-[14px] bg-neon text-[#04111E] transition hover:bg-neon-hover"
              aria-label="Envoyer le message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ConversationDetails({ conversation }: { conversation: Conversation }) {
  const Icon = kindMeta[conversation.kind].icon;
  return (
    <div>
      <div className="grid place-items-center rounded-[18px] border border-border-default bg-input-bg p-5 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-neon-soft font-display text-lg font-bold text-neon">
          {conversation.initials}
        </div>
        <h3 className="mt-3 font-display text-[18px] font-bold">{conversation.title}</h3>
        <p className="mt-1 text-[13px] text-text-secondary">{conversation.subtitle}</p>
      </div>
      <InfoRow icon={Icon} label="Type" value={kindMeta[conversation.kind].label} />
      <InfoRow icon={FileText} label="Lien" value={conversation.linkedLabel ?? "Aucun lien specifique"} />
      <InfoRow icon={Users} label="Participants" value={conversation.participants.join(", ")} />
      <div className="mt-4 rounded-[18px] border border-border-default bg-input-bg p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">Usage actuel</div>
        <p className="mt-2 text-[13px] leading-6 text-text-secondary">
          {kindMeta[conversation.kind].description}
        </p>
      </div>
    </div>
  );
}

function NewConversationDialog({
  initialKind,
  onClose,
  onCreate,
}: {
  initialKind: ConversationKind;
  onClose: () => void;
  onCreate: (input: { kind: ConversationKind; title: string; subtitle: string; firstMessage: string; linkedLabel?: string }) => void;
}) {
  const [kind, setKind] = useState<ConversationKind>(initialKind);
  const [title, setTitle] = useState("");
  const [linked, setLinked] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (!title.trim()) {
      setError("Ajoute un destinataire, un projet ou un parrainage.");
      return;
    }
    if (!message.trim()) {
      setError("Ecris un premier message.");
      return;
    }
    const subtitle = kind === "project" ? "Conversation de projet" : kind === "sponsorship" ? "Conversation de parrainage" : "Message prive";
    onCreate({
      kind,
      title: title.trim(),
      subtitle,
      firstMessage: message.trim(),
      linkedLabel: linked.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-[24px] border border-border-default bg-elevated p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[20px] font-bold">Nouveau message</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              Cree une discussion de projet, de parrainage ou avec un ami.
            </p>
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label-small text-text-secondary">Type</label>
            <div className="cm-popup-tabs mt-2 w-full" role="tablist" aria-label="Type de message">
              {tabs.map((item) => {
                const active = kind === item;
                const Icon = kindMeta[item].icon;
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-active={active}
                    onClick={() => setKind(item)}
                    className="cm-popup-tab flex-1"
                  >
                    <Icon className="h-4 w-4" />
                    {kindMeta[item].label}
                  </button>
                );
              })}
            </div>
          </div>
          <TextField
            label={kind === "friend" ? "Ami ou profil" : kind === "project" ? "Nom du projet" : "Nom du parrainage"}
            value={title}
            onChange={setTitle}
            placeholder={kind === "friend" ? "Aiko Tanaka" : kind === "project" ? "Nightfall Chronicles" : "Campagne Volume 2"}
          />
          <TextField
            label="Lien optionnel"
            value={linked}
            onChange={setLinked}
            placeholder={kind === "project" ? "Chapitre, page, projet..." : kind === "sponsorship" ? "Annonce, option, campagne..." : "Projet commun..."}
          />
          <div>
            <label className="label-small text-text-secondary">Premier message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ecris ton message..."
              className="mt-2 min-h-[112px] w-full resize-none rounded-[16px] border border-border-default bg-input-bg px-3 py-3 text-[14px] text-text-primary outline-none transition focus:border-neon focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]"
            />
          </div>
          {error && (
            <div className="rounded-[14px] border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] px-3 py-2 text-[13px] font-bold text-[#FF5F7E]">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[14px] border border-border-default px-4 text-[14px] font-bold text-text-secondary transition hover:text-text-primary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            className="h-11 rounded-[14px] bg-neon px-4 text-[14px] font-bold text-[#04111E] transition hover:bg-neon-hover"
          >
            Creer la discussion
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="label-small text-text-secondary">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-[16px] border border-border-default bg-input-bg px-3 text-[14px] text-text-primary outline-none transition focus:border-neon focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)]"
      />
    </div>
  );
}

function AttachmentPreview({ attachment, compact = false }: { attachment: NonNullable<ChatMessage["attachment"]>; compact?: boolean }) {
  const Icon = attachment.icon === "project" ? FolderKanban : attachment.icon === "sponsorship" ? Handshake : attachment.icon === "image" ? ImageIcon : FileText;
  return (
    <div className={`mt-3 flex items-center gap-3 rounded-[14px] border border-border-default bg-input-bg ${compact ? "px-3 py-2" : "p-3"}`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-neon-soft text-neon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-text-primary">{attachment.label}</div>
        <div className="truncate text-[12px] text-text-muted">{attachment.detail}</div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: string }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-[16px] border border-border-default bg-input-bg p-3">
      <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-neon-soft text-neon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">{label}</div>
        <div className="mt-1 text-[13px] font-semibold text-text-primary">{value}</div>
      </div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-[13px] border border-border-default bg-input-bg text-text-secondary transition hover:border-neon-border hover:text-neon"
    >
      {children}
    </button>
  );
}

function EmptyList({ kind }: { kind: ConversationKind }) {
  return (
    <div className="grid h-full place-items-center px-4 py-10 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[16px] border border-border-default bg-input-bg text-neon">
          <Search className="h-5 w-5" />
        </div>
        <h3 className="mt-3 font-display text-[16px] font-bold">Aucune discussion</h3>
        <p className="mt-1 text-[13px] leading-5 text-text-secondary">
          Aucun resultat dans {kindMeta[kind].label.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}
