import { useMemo, useRef, useState } from "react";
import {
  Bell,
  FileText,
  Filter,
  Gift,
  Hash,
  Home,
  Image as ImageIcon,
  Info,
  Layers,
  Link2,
  Lock,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Sticker,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types & sample data                                                        */
/* -------------------------------------------------------------------------- */

type BaseTab = "amis" | "projets" | "parrainages";
type ServerType = "public" | "private" | "project" | "sponsorship" | "community";

type ServerEntry = {
  id: string;
  name: string;
  type: ServerType;
  initials: string;
  unread?: number;
};

type ConversationKind = "dm" | "project" | "sponsorship" | "channel";

type Conversation = {
  id: string;
  kind: ConversationKind;
  title: string;
  preview: string;
  timestamp: string;
  unread?: number;
  online?: boolean;
  avatarInitials: string;
  meta?: string;
  context: string;
};

type Message = {
  id: string;
  author: string;
  initials: string;
  time: string;
  text?: string;
  attachment?:
    | { kind: "image"; alt: string; caption?: string }
    | { kind: "gif"; alt: string }
    | { kind: "file"; name: string; type: string; size: string }
    | { kind: "link"; title: string; type: string; description: string };
  mention?: string;
};

const SERVERS: ServerEntry[] = [
  { id: "srv-public", name: "Mangaka Public", type: "public", initials: "MP", unread: 3 },
  { id: "srv-private", name: "Studio Kuro", type: "private", initials: "SK" },
  { id: "srv-project", name: "Project — Nightfall", type: "project", initials: "NF", unread: 12 },
  { id: "srv-sponsor", name: "Sponsorship Hub", type: "sponsorship", initials: "SH" },
  { id: "srv-community", name: "Ink Community", type: "community", initials: "IC" },
];

const AMIS: Conversation[] = [
  {
    id: "dm-aiko",
    kind: "dm",
    title: "Aiko Tanaka",
    preview: "Sent you the revised cover panel",
    timestamp: "12:04",
    unread: 2,
    online: true,
    avatarInitials: "AT",
    context: "Direct message",
  },
  {
    id: "dm-ren",
    kind: "dm",
    title: "Ren Sato",
    preview: "Okay, let's sync tomorrow.",
    timestamp: "Yesterday",
    online: false,
    avatarInitials: "RS",
    context: "Direct message",
  },
  {
    id: "dm-mika",
    kind: "dm",
    title: "Mika Ito",
    preview: "Loved the linework 🖤",
    timestamp: "Mon",
    online: true,
    avatarInitials: "MI",
    context: "Direct message",
  },
];

const PROJETS: Conversation[] = [
  {
    id: "prj-nightfall",
    kind: "project",
    title: "Nightfall Chronicles",
    preview: "Yui: draft for chapter 4 uploaded",
    timestamp: "10:41",
    unread: 5,
    avatarInitials: "NC",
    meta: "# chapters",
    context: "Project conversation",
  },
  {
    id: "prj-hollow",
    kind: "project",
    title: "Hollow Bloom",
    preview: "You: pushed panel sketches",
    timestamp: "Tue",
    avatarInitials: "HB",
    meta: "# feedback",
    context: "Project conversation",
  },
];

const PARRAINAGES: Conversation[] = [
  {
    id: "spn-orion",
    kind: "sponsorship",
    title: "Orion Ink — Volume 2",
    preview: "Contract draft ready for review",
    timestamp: "09:12",
    unread: 1,
    avatarInitials: "OI",
    meta: "YouTube · Long-form",
    context: "Linked to announcement",
  },
  {
    id: "spn-lumen",
    kind: "sponsorship",
    title: "Lumen Studio Collab",
    preview: "Deliverables signed off",
    timestamp: "Mon",
    avatarInitials: "LS",
    meta: "Instagram · Reels",
    context: "Linked to announcement",
  },
];

type ChannelGroup = { title: string; channels: { id: string; name: string; unread?: number }[] };

const SERVER_CHANNELS: Record<ServerType, ChannelGroup[]> = {
  public: [
    { title: "General", channels: [{ id: "c1", name: "general", unread: 3 }, { id: "c2", name: "introductions" }, { id: "c3", name: "questions" }] },
    { title: "Manga", channels: [{ id: "c4", name: "recommendations" }, { id: "c5", name: "chapter-talk" }, { id: "c6", name: "theories" }] },
    { title: "Media", channels: [{ id: "c7", name: "images" }, { id: "c8", name: "gifs" }, { id: "c9", name: "references" }] },
  ],
  private: [
    { title: "General", channels: [{ id: "p1", name: "studio" }, { id: "p2", name: "planning" }] },
    { title: "Media", channels: [{ id: "p3", name: "references" }] },
  ],
  project: [
    { title: "Project", channels: [{ id: "pj1", name: "project-chat", unread: 4 }, { id: "pj2", name: "chapters" }, { id: "pj3", name: "notes" }, { id: "pj4", name: "tasks" }] },
    { title: "Creation", channels: [{ id: "pj5", name: "character-design" }, { id: "pj6", name: "illustrations" }, { id: "pj7", name: "worldbuilding" }, { id: "pj8", name: "feedback" }] },
    { title: "Media", channels: [{ id: "pj9", name: "assets" }, { id: "pj10", name: "pages" }, { id: "pj11", name: "references" }] },
  ],
  sponsorship: [
    { title: "Sponsorship", channels: [{ id: "s1", name: "discussion" }, { id: "s2", name: "proposal" }, { id: "s3", name: "deliverables" }, { id: "s4", name: "agreement-notes" }] },
    { title: "Media", channels: [{ id: "s5", name: "files" }, { id: "s6", name: "images" }, { id: "s7", name: "references" }] },
  ],
  community: [
    { title: "General", channels: [{ id: "cm1", name: "lounge" }, { id: "cm2", name: "showcase" }] },
  ],
};

const SAMPLE_MESSAGES: Message[] = [
  {
    id: "m1",
    author: "Aiko Tanaka",
    initials: "AT",
    time: "Today at 11:52",
    text: "Just pushed the revised cover panel — the lighting feels a lot closer to the mood board now.",
  },
  {
    id: "m2",
    author: "Aiko Tanaka",
    initials: "AT",
    time: "Today at 11:53",
    attachment: { kind: "image", alt: "Cover panel revision", caption: "cover-v3.png" },
  },
  {
    id: "m3",
    author: "You",
    initials: "YO",
    time: "Today at 12:01",
    text: "This is huge. Let's mark this as the reference and move to inking.",
    mention: "@Aiko",
  },
  {
    id: "m4",
    author: "You",
    initials: "YO",
    time: "Today at 12:02",
    attachment: {
      kind: "link",
      title: "Nightfall Chronicles — Chapter 4",
      type: "Project chapter",
      description: "Draft synced with the team. Ready for panel review.",
    },
  },
  {
    id: "m5",
    author: "Ren Sato",
    initials: "RS",
    time: "Today at 12:04",
    attachment: { kind: "file", name: "chapter-04-script.pdf", type: "PDF", size: "1.4 MB" },
  },
];

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function typeChip(type: ServerType) {
  const map: Record<ServerType, { label: string; className: string }> = {
    public: { label: "Public", className: "bg-[color:var(--info)]/10 text-[color:var(--info)]" },
    private: { label: "Private", className: "bg-white/5 text-[color:var(--text-secondary)]" },
    project: { label: "Project", className: "bg-[color:var(--neon)]/10 text-[color:var(--neon)]" },
    sponsorship: { label: "Sponsorship", className: "bg-[color:var(--warning)]/10 text-[color:var(--warning)]" },
    community: { label: "Community", className: "bg-white/5 text-[color:var(--text-secondary)]" },
  };
  const c = map[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread`}
      className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[color:var(--neon)] px-1.5 text-[11px] font-extrabold text-[#04111E]"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Server rail                                                                */
/* -------------------------------------------------------------------------- */

function ServerRail({
  selected,
  onSelect,
  onCreateServer,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onCreateServer: () => void;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Server selection"
        className="flex h-full w-[72px] flex-col items-center gap-2.5 overflow-y-auto border-r border-[color:var(--cm-divider)] bg-[color:var(--rail)] px-2 py-3"
      >
        <RailIcon
          id="base"
          label="Base"
          selected={selected === "base"}
          onClick={() => onSelect("base")}
        >
          <Home className="h-5 w-5" />
        </RailIcon>

        <div className="my-1 h-px w-8 bg-[color:var(--cm-divider)]" />

        {SERVERS.map((s) => (
          <RailIcon
            key={s.id}
            id={s.id}
            label={s.name}
            selected={selected === s.id}
            onClick={() => onSelect(s.id)}
            unread={s.unread}
            typeIcon={s.type}
          >
            <span className="font-display text-[13px] font-bold">{s.initials}</span>
          </RailIcon>
        ))}

        <div className="my-1 h-px w-8 bg-[color:var(--cm-divider)]" />

        <RailIcon id="add" label="Add server" onClick={onCreateServer} accent>
          <Plus className="h-5 w-5" />
        </RailIcon>
        <RailIcon id="explore" label="Explore servers" onClick={() => {}}>
          <Sparkles className="h-5 w-5" />
        </RailIcon>
      </aside>
    </TooltipProvider>
  );
}

function RailIcon({
  id,
  label,
  selected,
  onClick,
  children,
  unread,
  typeIcon,
  accent,
}: {
  id: string;
  label: string;
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  unread?: number;
  typeIcon?: ServerType;
  accent?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          {selected && (
            <span
              aria-hidden
              className="absolute -left-2 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--neon)]"
            />
          )}
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={selected}
            className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all",
              "border-[color:var(--cm-border)] bg-[color:var(--elevated)] text-[color:var(--text-secondary)]",
              "hover:border-[color:var(--cm-border-strong)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]",
              selected &&
                "border-[color:var(--cm-neon-border)] bg-[color:var(--cm-active)] text-[color:var(--neon)] shadow-[0_0_18px_-4px_rgba(57,255,136,0.4)]",
              accent && "text-[color:var(--neon)]",
            )}
            data-id={id}
          >
            {children}
            {typeIcon === "private" && (
              <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[color:var(--rail)] p-0.5 text-[color:var(--text-muted)]" />
            )}
            {unread ? (
              <span
                aria-label={`${unread} unread`}
                className="absolute -bottom-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-[color:var(--rail)] bg-[color:var(--neon)] px-1 text-[10px] font-extrabold text-[#04111E]"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="border-[color:var(--cm-border)] bg-[color:var(--elevated)] text-[color:var(--text-primary)]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversation menu — Base                                                   */
/* -------------------------------------------------------------------------- */

const BASE_TABS: { id: BaseTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "amis", label: "Amis", icon: Users },
  { id: "projets", label: "Projets", icon: Layers },
  { id: "parrainages", label: "Parrainages", icon: Gift },
];

function BaseMenu({
  tab,
  onTabChange,
  selectedConv,
  onSelectConv,
  onNewMessage,
}: {
  tab: BaseTab;
  onTabChange: (t: BaseTab) => void;
  selectedConv: string | null;
  onSelectConv: (c: Conversation | null) => void;
  onNewMessage: () => void;
}) {
  const list = tab === "amis" ? AMIS : tab === "projets" ? PROJETS : PARRAINAGES;
  const sectionTitle =
    tab === "amis"
      ? "Messages privés"
      : tab === "projets"
        ? "Discussions projets"
        : "Discussions parrainages";

  return (
    <>
      <div className="border-b border-[color:var(--cm-divider)] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <Input
            placeholder="Search or start a conversation"
            className="h-10 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] pl-9 text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 px-2 pt-2">
        {BASE_TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onTabChange(id);
                onSelectConv(null);
              }}
              aria-pressed={active}
              className={cn(
                "relative flex h-[46px] items-center gap-3 rounded-lg px-3.5 text-left transition-colors",
                "text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]",
                active && "bg-[color:var(--cm-active)] text-[color:var(--neon)]",
              )}
              style={{ font: "800 15px/22px Manrope, sans-serif" }}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--neon)]"
                />
              )}
              <Icon className={cn("h-4 w-4", active ? "text-[color:var(--neon)]" : "text-[color:var(--text-muted)]")} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mx-3 my-2 border-t border-[color:var(--cm-divider)]" />

      <div className="flex items-center justify-between px-4 pb-1 pt-1">
        <span
          className="text-[color:var(--text-muted)]"
          style={{ font: "800 11px/16px Manrope, sans-serif", letterSpacing: "0.07em", textTransform: "uppercase" }}
        >
          {sectionTitle}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onNewMessage}
          className="h-6 w-6 text-[color:var(--text-muted)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
          aria-label="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 pb-2">
        <div className="flex flex-col gap-0.5">
          {list.map((c) => (
            <ConversationRow
              key={c.id}
              conv={c}
              selected={selectedConv === c.id}
              onClick={() => onSelectConv(c)}
            />
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function ConversationRow({
  conv,
  selected,
  onClick,
}: {
  conv: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex h-14 items-center gap-2.5 rounded-lg px-3 text-left transition-colors",
        "text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]",
        selected && "bg-[color:var(--cm-active)] text-[color:var(--neon)]",
      )}
    >
      <div className="relative">
        <Avatar className="h-9 w-9 border border-[color:var(--cm-border)]">
          <AvatarFallback className="bg-[color:var(--elevated)] text-[12px] font-bold text-[color:var(--text-primary)]">
            {conv.avatarInitials}
          </AvatarFallback>
        </Avatar>
        {conv.kind === "dm" && (
          <span
            aria-label={conv.online ? "Online" : "Offline"}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--menu)]",
              conv.online ? "bg-[color:var(--neon)]" : "bg-[color:var(--text-disabled)]",
            )}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[color:var(--text-primary)]",
              conv.unread ? "font-extrabold" : "font-bold",
            )}
            style={{ font: `${conv.unread ? 800 : 700} 14px/20px Manrope, sans-serif` }}
          >
            {conv.title}
          </span>
          <span className="ml-auto shrink-0 text-[color:var(--text-muted)]" style={{ font: "600 11px/16px Manrope, sans-serif" }}>
            {conv.timestamp}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="truncate text-[color:var(--text-muted)]"
            style={{ font: "500 13px/20px Manrope, sans-serif" }}
          >
            {conv.meta ? `${conv.meta} · ` : ""}
            {conv.preview}
          </span>
          {conv.unread ? <UnreadBadge count={conv.unread} /> : null}
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversation menu — Server                                                 */
/* -------------------------------------------------------------------------- */

function ServerMenu({
  server,
  selectedChannel,
  onSelectChannel,
  onOpenDetails,
}: {
  server: ServerEntry;
  selectedChannel: string | null;
  onSelectChannel: (id: string, name: string) => void;
  onOpenDetails: () => void;
}) {
  const groups = SERVER_CHANNELS[server.type];

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[color:var(--cm-divider)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[color:var(--text-primary)]"
              style={{ font: "700 15px/22px Sora, sans-serif" }}
            >
              {server.name}
            </span>
          </div>
          <div className="mt-1">{typeChip(server.type)}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenDetails}
          className="h-8 w-8 text-[color:var(--text-muted)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
          aria-label="Server options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-[color:var(--cm-divider)] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <Input
            placeholder="Search in server…"
            className="h-10 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] pl-9 text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        {groups.map((g, idx) => (
          <div key={g.title} className={idx > 0 ? "mt-2 border-t border-[color:var(--cm-divider)] pt-2" : ""}>
            <div
              className="px-3 pb-1.5 pt-2 text-[color:var(--text-muted)]"
              style={{ font: "800 11px/16px Manrope, sans-serif", letterSpacing: "0.07em", textTransform: "uppercase" }}
            >
              {g.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {g.channels.map((c) => {
                const active = selectedChannel === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectChannel(c.id, c.name)}
                    aria-pressed={active}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-lg px-3 text-left transition-colors",
                      "text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]",
                      active && "bg-[color:var(--cm-active)] text-[color:var(--neon)]",
                    )}
                  >
                    <Hash className={cn("h-4 w-4", active ? "text-[color:var(--neon)]" : "text-[color:var(--text-muted)]")} />
                    <span style={{ font: "700 14px/20px Manrope, sans-serif" }}>{c.name}</span>
                    {c.unread ? <UnreadBadge count={c.unread} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </ScrollArea>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Chat area                                                                  */
/* -------------------------------------------------------------------------- */

type ActiveContext = {
  title: string;
  context: string;
  icon: React.ReactNode;
  kind: "dm" | "project" | "sponsorship" | "channel" | "overview-amis" | "overview-projets" | "overview-parrainages" | "none";
  detailsKind?: "dm" | "project" | "sponsorship" | "server";
  placeholder?: string;
};

function ChatArea({
  active,
  onOpenDetails,
}: {
  active: ActiveContext;
  onOpenDetails: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<{ id: string; name: string; kind: "image" | "file" | "gif" }[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = draft.trim().length > 0 || attachments.length > 0;

  const send = () => {
    if (!canSend) return;
    setDraft("");
    setAttachments([]);
  };

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-[color:var(--chat)]">
      {/* Top bar */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[color:var(--cm-divider)] bg-[color:var(--topbar)] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--elevated)] text-[color:var(--text-secondary)]">
            {active.icon}
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-[color:var(--text-primary)]"
              style={{ font: "700 18px/26px Sora, sans-serif" }}
            >
              {active.title}
            </h1>
            <div className="flex items-center gap-2 text-[color:var(--text-muted)]" style={{ font: "500 13px/18px Manrope, sans-serif" }}>
              <span className="truncate">{active.context}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Search"><Search className="h-4 w-4" /></IconBtn>
          <IconBtn label="Media & files"><ImageIcon className="h-4 w-4" /></IconBtn>
          <IconBtn label="More" onClick={onOpenDetails}><MoreHorizontal className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {active.kind === "none" && <EmptyState title="Select a conversation" text="Choose a friend, project discussion, sponsorship discussion, or server channel from the left menu." icon={<MessageSquarePlus className="h-6 w-6" />} />}
        {active.kind === "overview-amis" && <FriendsOverview />}
        {active.kind === "overview-projets" && <OverviewList items={PROJETS} title="Recent project discussions" />}
        {active.kind === "overview-parrainages" && <OverviewList items={PARRAINAGES} title="Recent sponsorship discussions" />}
        {(active.kind === "dm" || active.kind === "project" || active.kind === "sponsorship" || active.kind === "channel") && (
          <MessageThread />
        )}
      </div>

      {/* Composer */}
      {(active.kind === "dm" || active.kind === "project" || active.kind === "sponsorship" || active.kind === "channel") && (
        <div className="shrink-0 border-t border-[color:var(--cm-divider)] bg-[color:var(--topbar)] px-5 py-3.5">
          {attachments.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="relative flex h-16 min-w-[140px] items-center gap-2 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)] px-3 text-[color:var(--text-primary)]"
                >
                  {a.kind === "image" ? <ImageIcon className="h-4 w-4 text-[color:var(--neon)]" /> : <FileText className="h-4 w-4 text-[color:var(--info)]" />}
                  <span className="truncate text-sm">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    aria-label={`Remove ${a.name}`}
                    className="ml-1 rounded-md p-1 text-[color:var(--text-muted)] hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Popover open={attachOpen} onOpenChange={setAttachOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl bg-[color:var(--input-bg)] text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
                  aria-label="Attach"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-64 border-[color:var(--cm-border-strong)] bg-[color:var(--elevated)] p-2 text-[color:var(--text-primary)]"
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setAttachments((prev) => [
                        ...prev,
                        { id: `${Date.now()}`, name: f.name, kind: f.type.startsWith("image/") ? "image" : "file" },
                      ]);
                    }
                    setAttachOpen(false);
                  }}
                />
                {[
                  { label: "Upload image", icon: ImageIcon, action: () => fileRef.current?.click() },
                  { label: "Upload file", icon: FileText, action: () => fileRef.current?.click() },
                  { label: "Add GIF", icon: Sticker, action: () => setAttachments((p) => [...p, { id: `${Date.now()}`, name: "trending.gif", kind: "gif" }]) },
                  { label: "Attach project", icon: Layers, action: () => setAttachOpen(false) },
                  { label: "Attach chapter", icon: FileText, action: () => setAttachOpen(false) },
                  { label: "Attach manga page", icon: ImageIcon, action: () => setAttachOpen(false) },
                  { label: "Attach sponsorship announcement", icon: Gift, action: () => setAttachOpen(false) },
                  { label: "Attach illustration", icon: ImageIcon, action: () => setAttachOpen(false) },
                  { label: "Attach proposition", icon: Link2, action: () => setAttachOpen(false) },
                ].map(({ label, icon: Icon, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
                  >
                    <Icon className="h-4 w-4 text-[color:var(--text-muted)]" />
                    {label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={active.placeholder ?? "Message…"}
              aria-label="Message"
              className="min-h-[44px] max-h-[120px] resize-none rounded-2xl border-[color:var(--cm-border)] bg-[color:var(--input-bg)] px-3.5 py-3 text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus-visible:ring-[color:var(--cm-neon-border)]"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-[color:var(--input-bg)] text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
              aria-label="Add GIF"
              onClick={() => setAttachments((p) => [...p, { id: `${Date.now()}`, name: "reaction.gif", kind: "gif" }])}
            >
              <Sticker className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-[color:var(--input-bg)] text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
              aria-label="Add image"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send message"
              className="h-11 min-w-11 shrink-0 rounded-2xl bg-[color:var(--neon)] px-3 text-[#04111E] hover:bg-[color:var(--neon-hover)] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="h-9 w-9 text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]"
    >
      {children}
    </Button>
  );
}

function EmptyState({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)] text-[color:var(--neon)]">
        {icon}
      </div>
      <h2 className="text-[color:var(--text-primary)]" style={{ font: "700 20px/28px Sora, sans-serif" }}>
        {title}
      </h2>
      <p className="mt-2 text-[color:var(--text-secondary)]" style={{ font: "500 14px/22px Manrope, sans-serif" }}>
        {text}
      </p>
    </div>
  );
}

function FriendsOverview() {
  const [filter, setFilter] = useState<"online" | "all" | "pending">("online");
  const filters: { id: typeof filter; label: string }[] = [
    { id: "online", label: "Online" },
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
              filter === f.id
                ? "bg-[color:var(--cm-active)] text-[color:var(--neon)]"
                : "text-[color:var(--text-secondary)] hover:bg-white/[0.045] hover:text-[color:var(--text-primary)]",
            )}
          >
            {f.label}
          </button>
        ))}
        <Button
          type="button"
          className="ml-auto h-8 rounded-lg bg-[color:var(--neon)] px-3 text-[#04111E] hover:bg-[color:var(--neon-hover)]"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Friend
        </Button>
      </div>
      <div className="rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)]">
        {AMIS.filter((c) => (filter === "online" ? c.online : filter === "all" ? true : false)).map(
          (c, i, arr) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i < arr.length - 1 && "border-b border-[color:var(--cm-divider)]",
              )}
            >
              <Avatar className="h-9 w-9 border border-[color:var(--cm-border)]">
                <AvatarFallback className="bg-[color:var(--container)] text-[12px] font-bold text-[color:var(--text-primary)]">
                  {c.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-bold text-[color:var(--text-primary)]">{c.title}</div>
                <div className="text-xs text-[color:var(--text-muted)]">
                  {c.online ? "Online" : "Offline"}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <IconBtn label="Message"><MessageSquarePlus className="h-4 w-4" /></IconBtn>
                <IconBtn label="More"><MoreHorizontal className="h-4 w-4" /></IconBtn>
              </div>
            </div>
          ),
        )}
        {filter === "pending" && (
          <div className="p-6 text-center text-sm text-[color:var(--text-muted)]">No pending requests.</div>
        )}
      </div>
    </div>
  );
}

function OverviewList({ items, title }: { items: Conversation[]; title: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[color:var(--text-primary)]" style={{ font: "700 16px/22px Sora, sans-serif" }}>
          {title}
        </h2>
        <Button variant="ghost" className="text-[color:var(--text-secondary)] hover:bg-white/[0.045]">
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
      </div>
      <div className="rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)]">
        {items.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i < items.length - 1 && "border-b border-[color:var(--cm-divider)]",
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--container)] text-xs font-bold text-[color:var(--text-primary)]">
              {c.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-[color:var(--text-primary)]">{c.title}</div>
              <div className="truncate text-xs text-[color:var(--text-muted)]">
                {c.meta ? `${c.meta} · ` : ""}
                {c.preview}
              </div>
            </div>
            <Button className="h-8 rounded-lg bg-[color:var(--cm-active)] px-3 text-[color:var(--neon)] hover:bg-[color:var(--cm-active)]/80">
              Open
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageThread() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="relative my-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-[color:var(--cm-neon-border)]/50" />
        <span className="rounded-md bg-[color:var(--cm-active)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--neon)]">
          New messages
        </span>
        <div className="h-px flex-1 bg-[color:var(--cm-neon-border)]/50" />
      </div>

      {SAMPLE_MESSAGES.map((m) => (
        <MessageRow key={m.id} m={m} />
      ))}
    </div>
  );
}

function MessageRow({ m }: { m: Message }) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-10 w-10 border border-[color:var(--cm-border)]">
        <AvatarFallback className="bg-[color:var(--elevated)] text-[13px] font-bold text-[color:var(--text-primary)]">
          {m.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[color:var(--text-primary)]" style={{ font: "800 14px/20px Manrope, sans-serif" }}>
            {m.author}
          </span>
          <span className="text-[color:var(--text-muted)]" style={{ font: "600 11px/16px Manrope, sans-serif" }}>
            {m.time}
          </span>
        </div>
        {m.text && (
          <p className="text-[color:var(--text-primary)]" style={{ font: "500 14px/22px Manrope, sans-serif" }}>
            {m.mention && (
              <span className="mr-1 rounded-md bg-[color:var(--cm-active)] px-1 py-[1px] text-[color:var(--neon)]">
                {m.mention}
              </span>
            )}
            {m.text}
          </p>
        )}
        {m.attachment?.kind === "image" && (
          <div className="mt-2 max-w-[360px] overflow-hidden rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)]">
            <div className="flex h-56 items-center justify-center bg-gradient-to-br from-[#0E193A] via-[#101B3F] to-[#050B1D] text-[color:var(--text-muted)]">
              <ImageIcon className="h-8 w-8" />
            </div>
            {m.attachment.caption && (
              <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">{m.attachment.caption}</div>
            )}
          </div>
        )}
        {m.attachment?.kind === "file" && (
          <div className="mt-2 flex max-w-[360px] items-center gap-3 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)] px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--container)] text-[color:var(--info)]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-[color:var(--text-primary)]">{m.attachment.name}</div>
              <div className="text-xs text-[color:var(--text-muted)]">
                {m.attachment.type} · {m.attachment.size}
              </div>
            </div>
          </div>
        )}
        {m.attachment?.kind === "link" && (
          <div className="mt-2 max-w-[420px] rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--elevated)] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md bg-[color:var(--cm-active)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--neon)]">
                {m.attachment.type}
              </span>
            </div>
            <div className="font-bold text-[color:var(--text-primary)]">{m.attachment.title}</div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{m.attachment.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modals                                                                     */
/* -------------------------------------------------------------------------- */

function DetailsModal({
  open,
  onOpenChange,
  kind,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "dm" | "project" | "sponsorship" | "server";
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--cm-border-strong)] bg-[color:var(--elevated)] text-[color:var(--text-primary)]">
        <DialogHeader>
          <DialogTitle style={{ font: "700 18px/26px Sora, sans-serif" }}>{title}</DialogTitle>
          <DialogDescription className="text-[color:var(--text-secondary)]">
            {kind === "dm" && "Direct message details"}
            {kind === "project" && "Project conversation details"}
            {kind === "sponsorship" && "Sponsorship conversation details"}
            {kind === "server" && "Server details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-[color:var(--text-secondary)]">
          {kind === "dm" && (
            <>
              <Row label="Role" value="Dessinateur" />
              <Row label="Languages" value="French · English · JP" />
              <Row label="Availability" value="Weekdays · GMT+1" />
            </>
          )}
          {kind === "project" && (
            <>
              <Row label="Status" value="In production" />
              <Row label="Team" value="6 members" />
              <Row label="Chapters" value="4 published · 2 in draft" />
            </>
          )}
          {kind === "sponsorship" && (
            <>
              <Row label="Budget" value="€ 2,400" />
              <Row label="Platform" value="YouTube · Instagram" />
              <Row label="Type" value="Long-form video" />
              <Row label="Duration" value="6 weeks" />
              <Row label="Status" value="Awaiting signature" />
            </>
          )}
          {kind === "server" && (
            <>
              <Row label="Type" value="Project server" />
              <Row label="Members" value="12" />
              <Row label="Channels" value="11 text channels" />
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost" className="text-[color:var(--text-secondary)]">
              Close
            </Button>
          </DialogClose>
          <div className="flex gap-2">
            {kind === "dm" && (
              <>
                <Button variant="ghost" className="text-[color:var(--text-secondary)]">Block</Button>
                <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">View Profile</Button>
              </>
            )}
            {kind === "project" && (
              <>
                <Button variant="ghost" className="text-[color:var(--text-secondary)]">View Notes</Button>
                <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">Open Project</Button>
              </>
            )}
            {kind === "sponsorship" && (
              <>
                <Button variant="ghost" className="text-[color:var(--text-secondary)]">View Proposal</Button>
                <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">View Announcement</Button>
              </>
            )}
            {kind === "server" && (
              <>
                <Button variant="ghost" className="text-[color:var(--text-secondary)]">Leave Server</Button>
                <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">Invite Members</Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--container)] px-3 py-2">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[color:var(--text-primary)]">{value}</span>
    </div>
  );
}

function CreateServerModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--cm-border-strong)] bg-[color:var(--elevated)] text-[color:var(--text-primary)]">
        <DialogHeader>
          <DialogTitle style={{ font: "700 18px/26px Sora, sans-serif" }}>Create a server</DialogTitle>
          <DialogDescription className="text-[color:var(--text-secondary)]">
            Organize conversations around a community, project, or sponsorship.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[color:var(--text-secondary)]">Server name</Label>
            <Input placeholder="Ex. Nightfall Studio" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
          <div>
            <Label className="text-[color:var(--text-secondary)]">Server type</Label>
            <Select defaultValue="public">
              <SelectTrigger className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="project">Project server</SelectItem>
                <SelectItem value="sponsorship">Sponsorship server</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[color:var(--text-secondary)]">Description</Label>
            <Textarea placeholder="Short description" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
          <div>
            <Label className="text-[color:var(--text-secondary)]">Default text channels</Label>
            <Input defaultValue="general, planning, media" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="text-[color:var(--text-secondary)]">Cancel</Button>
          </DialogClose>
          <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">
            Create server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewMessageModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--cm-border-strong)] bg-[color:var(--elevated)] text-[color:var(--text-primary)]">
        <DialogHeader>
          <DialogTitle style={{ font: "700 18px/26px Sora, sans-serif" }}>New message</DialogTitle>
          <DialogDescription className="text-[color:var(--text-secondary)]">
            Start a conversation with a collaborator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[color:var(--text-secondary)]">To</Label>
            <Input placeholder="Search user" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
          <div>
            <Label className="text-[color:var(--text-secondary)]">Linked project (optional)</Label>
            <Input placeholder="Search project" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
          <div>
            <Label className="text-[color:var(--text-secondary)]">First message</Label>
            <Textarea placeholder="Say hi…" className="mt-1 border-[color:var(--cm-border)] bg-[color:var(--input-bg)] text-[color:var(--text-primary)]" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="text-[color:var(--text-secondary)]">Cancel</Button>
          </DialogClose>
          <Button className="bg-[color:var(--neon)] text-[#04111E] hover:bg-[color:var(--neon-hover)]">
            Start Conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function MessagesPage() {
  const [selectedServer, setSelectedServer] = useState<string>("base");
  const [baseTab, setBaseTab] = useState<BaseTab>("amis");
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; name: string } | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  const server = SERVERS.find((s) => s.id === selectedServer);
  const isBase = selectedServer === "base";

  const active: ActiveContext = useMemo(() => {
    if (!isBase && server) {
      if (selectedChannel) {
        return {
          title: `# ${selectedChannel.name}`,
          context: server.name,
          icon: <Hash className="h-4 w-4" />,
          kind: "channel",
          detailsKind: "server",
          placeholder: `Message #${selectedChannel.name}…`,
        };
      }
      return {
        title: server.name,
        context: "Select a channel to start chatting",
        icon: <Hash className="h-4 w-4" />,
        kind: "none",
      };
    }

    if (selectedConv) {
      const detailsKind = selectedConv.kind === "dm" ? "dm" : selectedConv.kind === "project" ? "project" : "sponsorship";
      return {
        title: selectedConv.kind === "dm" ? selectedConv.title : selectedConv.title,
        context: selectedConv.context,
        icon:
          selectedConv.kind === "dm" ? <Users className="h-4 w-4" /> :
          selectedConv.kind === "project" ? <Layers className="h-4 w-4" /> :
          <Gift className="h-4 w-4" />,
        kind: selectedConv.kind,
        detailsKind,
        placeholder:
          selectedConv.kind === "dm"
            ? `Message ${selectedConv.title}…`
            : selectedConv.kind === "project"
              ? "Message project conversation…"
              : "Message sponsorship discussion…",
      };
    }

    if (baseTab === "amis") {
      return { title: "Amis", context: "Private conversations", icon: <Users className="h-4 w-4" />, kind: "overview-amis" };
    }
    if (baseTab === "projets") {
      return { title: "Projets", context: "Project discussions", icon: <Layers className="h-4 w-4" />, kind: "overview-projets" };
    }
    return { title: "Parrainages", context: "Sponsorship discussions", icon: <Gift className="h-4 w-4" />, kind: "overview-parrainages" };
  }, [isBase, server, selectedChannel, selectedConv, baseTab]);

  return (
    <main
      className="h-screen w-full min-w-0 overflow-hidden bg-[color:var(--page)] text-[color:var(--text-primary)]"
      style={{ fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        className="grid h-full w-full overflow-hidden bg-[color:var(--container)]"
        style={{ gridTemplateColumns: "72px 320px 1fr" }}
      >
        <ServerRail
          selected={selectedServer}
          onSelect={(id) => {
            setSelectedServer(id);
            setSelectedConv(null);
            setSelectedChannel(null);
          }}
          onCreateServer={() => setCreateServerOpen(true)}
        />

        <div className="flex h-full flex-col overflow-hidden border-r border-[color:var(--cm-divider)] bg-[color:var(--menu)]">
          {isBase ? (
            <BaseMenu
              tab={baseTab}
              onTabChange={setBaseTab}
              selectedConv={selectedConv?.id ?? null}
              onSelectConv={setSelectedConv}
              onNewMessage={() => setNewMessageOpen(true)}
            />
          ) : server ? (
            <ServerMenu
              server={server}
              selectedChannel={selectedChannel?.id ?? null}
              onSelectChannel={(id, name) => setSelectedChannel({ id, name })}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          ) : null}
        </div>

        <ChatArea active={active} onOpenDetails={() => setDetailsOpen(true)} />
      </div>

      <DetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        kind={active.detailsKind ?? "server"}
        title={active.title}
      />
      <CreateServerModal open={createServerOpen} onOpenChange={setCreateServerOpen} />
      <NewMessageModal open={newMessageOpen} onOpenChange={setNewMessageOpen} />

      {/* Hidden decorative icons to satisfy tree-shake for consistent bundle */}
      <div className="hidden">
        <Bell />
        <Info />
      </div>
    </main>
  );
}
