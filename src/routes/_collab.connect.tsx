import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search, Settings, Plus, Paperclip, Send, Smile, MoreHorizontal,
  Info, FolderKanban, Users, Handshake, Circle, Pin, BellOff,
  FileText, Image as ImageIcon, BookOpen, Link2, Megaphone, X,
} from "lucide-react";

export const Route = createFileRoute("/_collab/connect")({
  component: MessagesPage,
});

type TabId = "projet" | "amis" | "parrainage";

type Conversation = {
  id: string;
  name: string;
  chip: string;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
  pinned?: boolean;
  muted?: boolean;
  subtitle: string;
  initials: string;
};

const DATA: Record<TabId, Conversation[]> = {
  projet: [
    { id: "p1", name: "Project conversation", chip: "Project", preview: "Last message preview…", time: "12:42", unread: 3, subtitle: "Linked to project", initials: "PR", pinned: true },
    { id: "p2", name: "Chapter review", chip: "Chapter", preview: "Last message preview…", time: "11:18", subtitle: "Linked to chapter", initials: "CH" },
    { id: "p3", name: "Team room", chip: "Team", preview: "Last message preview…", time: "Yesterday", unread: 1, subtitle: "Linked to project", initials: "TM" },
    { id: "p4", name: "Project conversation", chip: "Project", preview: "Last message preview…", time: "Mon", subtitle: "Linked to project", initials: "PJ" },
    { id: "p5", name: "Chapter draft", chip: "Chapter", preview: "Last message preview…", time: "Sun", muted: true, subtitle: "Linked to chapter", initials: "CD" },
  ],
  amis: [
    { id: "a1", name: "Friend name", chip: "Creator", preview: "Last message preview…", time: "09:04", online: true, unread: 2, subtitle: "Online", initials: "FN" },
    { id: "a2", name: "Friend name", chip: "Dessinateur", preview: "Last message preview…", time: "08:22", online: true, subtitle: "Online", initials: "FD" },
    { id: "a3", name: "Friend name", chip: "Scénariste", preview: "Last message preview…", time: "Yesterday", subtitle: "Offline", initials: "FS" },
    { id: "a4", name: "Friend name", chip: "Friend", preview: "Last message preview…", time: "Tue", subtitle: "Offline", initials: "FR" },
  ],
  parrainage: [
    { id: "s1", name: "Sponsorship discussion", chip: "Creator Offer", preview: "Last message preview…", time: "14:10", unread: 5, subtitle: "Linked to sponsorship announcement", initials: "SO" },
    { id: "s2", name: "Sponsorship discussion", chip: "Project Request", preview: "Last message preview…", time: "10:47", subtitle: "Linked to sponsorship announcement", initials: "PR" },
    { id: "s3", name: "Sponsorship discussion", chip: "Application", preview: "Last message preview…", time: "Yesterday", subtitle: "Linked to sponsorship announcement", initials: "AP" },
    { id: "s4", name: "Sponsorship discussion", chip: "Sponsorship", preview: "Last message preview…", time: "Fri", pinned: true, subtitle: "Linked to sponsorship announcement", initials: "SP" },
  ],
};

const TABS: { id: TabId; label: string; icon: typeof FolderKanban; unread: boolean }[] = [
  { id: "projet", label: "Projet", icon: FolderKanban, unread: true },
  { id: "amis", label: "Amis", icon: Users, unread: true },
  { id: "parrainage", label: "Parrainage", icon: Handshake, unread: true },
];

function MessagesPage() {
  const [tab, setTab] = useState<TabId>("projet");
  const [selectedId, setSelectedId] = useState<string>("p1");
  const [showAttach, setShowAttach] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<{ name: string; type: string }[]>([]);

  const conversations = DATA[tab];
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? conversations[0],
    [conversations, selectedId],
  );

  const listTitle = tab === "projet" ? "Project conversations" : tab === "amis" ? "Friends" : "Sponsorship";
  const searchPh = tab === "projet" ? "Search project conversations…" : tab === "amis" ? "Search friends…" : "Search sponsorship chats…";

  const handleTab = (id: TabId) => {
    setTab(id);
    setSelectedId(DATA[id][0]?.id ?? "");
  };

  return (
    <main className="min-h-screen bg-background px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      {/* Page header */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-9 text-text-primary">Messages</h1>
          <p className="mt-1 text-[13px] font-medium text-text-secondary">
            Manage project discussions, friends, and sponsorship conversations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn ariaLabel="Search messages"><Search className="h-4 w-4" /></IconBtn>
          <IconBtn ariaLabel="Messages settings"><Settings className="h-4 w-4" /></IconBtn>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-neon px-4 text-[14px] font-bold text-[#04111E] transition-colors hover:bg-neon-hover"
          >
            <Plus className="h-4 w-4" />
            New Message
          </button>
        </div>
      </header>

      {/* Messaging layout */}
      <div className="flex h-[calc(100vh-160px)] min-h-[600px] gap-4">
        {/* Vertical tab rail */}
        <nav
          aria-label="Message categories"
          className="hidden shrink-0 flex-col gap-2 rounded-[22px] border border-border-default bg-panel p-2 md:flex"
          style={{ width: 78 }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            const hasUnread = DATA[t.id].some((c) => c.unread);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTab(t.id)}
                aria-current={active ? "page" : undefined}
                aria-label={`${t.label}${hasUnread ? ", unread messages" : ""}`}
                className={[
                  "relative flex h-[86px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all",
                  active
                    ? "border-neon-border bg-neon-soft text-neon shadow-[0_0_0_1px_rgba(57,255,136,0.35),0_0_18px_rgba(57,255,136,0.18)]"
                    : "border-[rgba(133,154,206,0.12)] bg-transparent text-text-secondary hover:border-[rgba(57,255,136,0.25)] hover:bg-white/5",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="label-small">{t.label}</span>
                {hasUnread && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_rgba(57,255,136,0.7)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile segmented tabs */}
        <div className="flex flex-1 flex-col gap-4 md:hidden">
          <div className="flex gap-1 rounded-[22px] border border-border-default bg-panel p-1">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTab(t.id)}
                  className={[
                    "flex-1 rounded-[16px] py-2 text-[12px] font-bold uppercase tracking-wider transition-colors",
                    active ? "bg-neon-soft text-neon" : "text-text-secondary",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <ConversationList
            title={listTitle}
            placeholder={searchPh}
            items={conversations}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            tab={tab}
          />
        </div>

        {/* Conversation list panel (desktop) */}
        <div className="hidden md:block md:w-[300px] lg:w-[360px]">
          <ConversationList
            title={listTitle}
            placeholder={searchPh}
            items={conversations}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            tab={tab}
          />
        </div>

        {/* Active conversation panel */}
        <section
          aria-label="Active conversation"
          className="hidden flex-1 flex-col overflow-hidden rounded-[22px] border border-border-default bg-conversation shadow-panel md:flex"
        >
          {selected ? (
            <ActiveConversation
              conv={selected}
              tab={tab}
              showAttach={showAttach}
              setShowAttach={setShowAttach}
              draft={draft}
              setDraft={setDraft}
              pendingAttachments={pendingAttachments}
              setPendingAttachments={setPendingAttachments}
            />
          ) : (
            <EmptyThread />
          )}
        </section>
      </div>
    </main>
  );
}

function IconBtn({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-border-default bg-elevated text-text-secondary transition-colors hover:border-neon-border hover:text-neon"
    >
      {children}
    </button>
  );
}

function ConversationList({
  title, placeholder, items, selectedId, onSelect, tab,
}: {
  title: string;
  placeholder: string;
  items: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  tab: TabId;
}) {
  const emptyCopy = tab === "projet"
    ? { t: "No project conversations", d: "Project discussions will appear here when you collaborate on manga projects." }
    : tab === "amis"
    ? { t: "No friend messages", d: "Start a conversation with collaborators or creators." }
    : { t: "No sponsorship messages", d: "Sponsorship conversations will appear here after contact or applications." };

  return (
    <aside
      aria-label={title}
      className="flex h-full flex-col overflow-hidden rounded-[22px] border border-border-default bg-panel p-4 shadow-panel"
    >
      <div className="mb-3">
        <h2 className="font-display text-[18px] font-bold leading-7 text-text-primary">{title}</h2>
      </div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-[14px] border border-border-default bg-input-bg pl-9 pr-3 text-[13px] font-medium text-text-primary placeholder:text-text-muted focus:border-neon-border focus:outline-none focus:ring-2 focus:ring-neon/30"
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["All", "Unread", "Pinned"].map((f, i) => (
          <button
            key={f}
            className={[
              "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
              i === 0
                ? "border-neon-border bg-neon-soft text-neon"
                : "border-border-default bg-elevated text-text-secondary hover:border-neon-border/50",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border-default bg-elevated p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-neon-soft text-neon">
              <Circle className="h-4 w-4" />
            </div>
            <h3 className="font-display text-[15px] font-bold text-text-primary">{emptyCopy.t}</h3>
            <p className="mt-1 text-[13px] font-medium text-text-secondary">{emptyCopy.d}</p>
          </div>
        ) : (
          items.map((c) => (
            <ConversationCard
              key={c.id}
              conv={c}
              selected={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ConversationCard({ conv, selected, onClick }: { conv: Conversation; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected}
      aria-label={`${conv.name}${conv.unread ? `, ${conv.unread} unread` : ""}`}
      className={[
        "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
        selected
          ? "border-neon-border bg-[rgba(57,255,136,0.08)] shadow-[0_0_0_1px_rgba(57,255,136,0.35),0_0_18px_rgba(57,255,136,0.14)]"
          : "border-border-default bg-elevated hover:border-border-strong",
      ].join(" ")}
    >
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1c2a5a] to-[#0e1a44] text-[13px] font-bold text-text-primary">
          {conv.initials}
        </div>
        {conv.online && (
          <span
            aria-label="Online"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel bg-neon shadow-[0_0_6px_rgba(57,255,136,0.7)]"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {conv.pinned && <Pin className="h-3 w-3 text-text-muted" aria-label="Pinned" />}
          <h3 className={["truncate text-[14px] leading-5", conv.unread ? "font-extrabold text-text-primary" : "font-bold text-text-primary"].join(" ")}>
            {conv.name}
          </h3>
          {conv.muted && <BellOff className="h-3 w-3 text-text-muted" aria-label="Muted" />}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full border border-border-default bg-[#0a1330] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            {conv.chip}
          </span>
        </div>
        <p className={["mt-1.5 truncate text-[13px] leading-5", conv.unread ? "font-semibold text-text-primary" : "font-medium text-text-muted"].join(" ")}>
          {conv.preview}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">{conv.time}</span>
        {conv.unread ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-neon px-1.5 text-[11px] font-bold text-[#04111E]">
            {conv.unread}
          </span>
        ) : (
          <span className="h-5" />
        )}
      </div>
    </button>
  );
}

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-soft text-neon">
        <Send className="h-6 w-6" />
      </div>
      <h3 className="font-display text-[18px] font-bold text-text-primary">Select a conversation</h3>
      <p className="mt-1 text-[13px] font-medium text-text-secondary">Choose a chat from the list to start messaging.</p>
    </div>
  );
}

type ActiveProps = {
  conv: Conversation;
  tab: TabId;
  showAttach: boolean;
  setShowAttach: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  pendingAttachments: { name: string; type: string }[];
  setPendingAttachments: (v: { name: string; type: string }[]) => void;
};

function ActiveConversation({ conv, tab, showAttach, setShowAttach, draft, setDraft, pendingAttachments, setPendingAttachments }: ActiveProps) {
  const attachmentOptions =
    tab === "projet"
      ? [
          { label: "Attach project", icon: FolderKanban },
          { label: "Attach chapter", icon: BookOpen },
          { label: "Attach manga page", icon: ImageIcon },
          { label: "Upload image", icon: ImageIcon },
          { label: "Upload file", icon: FileText },
          { label: "Add note", icon: FileText },
        ]
      : tab === "parrainage"
      ? [
          { label: "Attach sponsorship announcement", icon: Megaphone },
          { label: "Attach offer details", icon: FileText },
          { label: "Attach media kit", icon: FileText },
          { label: "Attach manga cover", icon: ImageIcon },
          { label: "Attach proposal", icon: FileText },
          { label: "Upload file", icon: FileText },
        ]
      : [
          { label: "Upload image", icon: ImageIcon },
          { label: "Upload file", icon: FileText },
          { label: "Attach project", icon: FolderKanban },
          { label: "Attach chapter", icon: BookOpen },
        ];

  return (
    <>
      {/* Top bar */}
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[rgba(133,154,206,0.14)] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1c2a5a] to-[#0e1a44] text-[13px] font-bold text-text-primary">
            {conv.initials}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[18px] font-bold leading-6 text-text-primary">{conv.name}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              {conv.online && <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(57,255,136,0.7)]" />}
              <p className="truncate text-[12px] font-semibold text-text-muted">{conv.subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn ariaLabel="Search in conversation"><Search className="h-4 w-4" /></IconBtn>
          <IconBtn ariaLabel="Attach project or chapter"><Link2 className="h-4 w-4" /></IconBtn>
          <IconBtn ariaLabel="Conversation info"><Info className="h-4 w-4" /></IconBtn>
          <IconBtn ariaLabel="More actions"><MoreHorizontal className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <DateSep label="Today" />

        <MessageRow side="in" name="Sender name" time="10:12" initials={conv.initials}>
          <p>Message content…</p>
        </MessageRow>

        <MessageRow side="in" name="Sender name" time="10:14" initials={conv.initials}>
          <p>Message content with a linked reference below.</p>
          <AttachmentCard
            icon={tab === "parrainage" ? Megaphone : tab === "projet" ? BookOpen : FileText}
            title="Attachment name"
            meta={tab === "parrainage" ? "Sponsorship announcement · 1.2 MB" : tab === "projet" ? "Chapter · 24 pages" : "File · 480 KB"}
          />
        </MessageRow>

        <MessageRow side="out" time="10:22">
          <p>Message content…</p>
        </MessageRow>

        <MessageRow side="out" time="10:23" read>
          <p>Sharing the reference file for review.</p>
          <AttachmentCard icon={ImageIcon} title="Attachment name" meta="Image · 2.4 MB" />
        </MessageRow>

        <DateSep label="Earlier" />

        <MessageRow side="in" name="Sender name" time="09:47" initials={conv.initials}>
          <p>Message content…</p>
        </MessageRow>
      </div>

      {/* Attachment preview strip */}
      {pendingAttachments.length > 0 && (
        <div className="flex gap-2 border-t border-[rgba(133,154,206,0.14)] bg-panel px-4 py-3">
          {pendingAttachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-[14px] border border-border-default bg-input-bg px-3 py-2">
              <FileText className="h-4 w-4 text-text-secondary" />
              <div className="text-[12px]">
                <div className="font-bold text-text-primary">{a.name}</div>
                <div className="text-text-muted">{a.type}</div>
              </div>
              <button
                aria-label="Remove attachment"
                onClick={() => setPendingAttachments(pendingAttachments.filter((_, x) => x !== i))}
                className="ml-1 rounded-full p-1 text-text-muted hover:bg-white/5 hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="relative shrink-0 border-t border-[rgba(133,154,206,0.14)] bg-panel px-4 py-3.5">
        {showAttach && (
          <div
            role="dialog"
            aria-label="Attachment options"
            className="absolute bottom-full left-4 mb-2 w-[320px] rounded-2xl border border-border-default bg-elevated p-3 shadow-panel"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="label-small text-text-secondary">Attach</span>
              <button aria-label="Close attachment options" onClick={() => setShowAttach(false)} className="rounded-full p-1 text-text-muted hover:text-text-primary">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {attachmentOptions.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.label}
                    onClick={() => {
                      setPendingAttachments([...pendingAttachments, { name: "Attachment name", type: o.label }]);
                      setShowAttach(false);
                    }}
                    className="flex items-center gap-2 rounded-[14px] border border-border-default bg-panel px-3 py-2.5 text-left text-[12px] font-semibold text-text-secondary transition-colors hover:border-neon-border hover:text-neon"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label="Attach"
            onClick={() => setShowAttach(!showAttach)}
            className={[
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border transition-colors",
              showAttach
                ? "border-neon-border bg-neon-soft text-neon"
                : "border-border-default bg-input-bg text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Write a message"
            placeholder="Write a message…"
            rows={1}
            className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-[14px] border border-border-default bg-input-bg px-3.5 py-3 text-[14px] font-medium leading-[22px] text-text-primary placeholder:text-text-muted focus:border-neon-border focus:outline-none focus:ring-2 focus:ring-neon/30"
          />

          <button
            type="button"
            aria-label="Emoji"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-border-default bg-input-bg text-text-secondary hover:text-text-primary"
          >
            <Smile className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="Send message"
            disabled={!draft.trim() && pendingAttachments.length === 0}
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-[14px] bg-neon px-4 text-[14px] font-bold text-[#04111E] transition-colors hover:bg-neon-hover disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function DateSep({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3" aria-label={label}>
      <div className="h-px flex-1 bg-[rgba(133,154,206,0.14)]" />
      <span className="label-small text-text-muted">{label}</span>
      <div className="h-px flex-1 bg-[rgba(133,154,206,0.14)]" />
    </div>
  );
}

function MessageRow({
  side, name, time, initials, read, children,
}: {
  side: "in" | "out";
  name?: string;
  time: string;
  initials?: string;
  read?: boolean;
  children: React.ReactNode;
}) {
  const isOut = side === "out";
  return (
    <div className={["mb-3 flex items-end gap-2", isOut ? "justify-end" : "justify-start"].join(" ")}>
      {!isOut && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1c2a5a] to-[#0e1a44] text-[11px] font-bold text-text-primary">
          {initials}
        </div>
      )}
      <div className={["flex max-w-[85%] flex-col md:max-w-[65%]", isOut ? "items-end" : "items-start"].join(" ")}>
        {!isOut && name && (
          <span className="mb-1 px-1 text-[11px] font-bold text-text-muted">{name}</span>
        )}
        <div
          className={[
            "border px-3.5 py-2.5 text-[14px] font-medium leading-[22px] text-text-primary",
            isOut
              ? "rounded-[16px_16px_6px_16px] border-[rgba(57,255,136,0.28)] bg-bubble-own"
              : "rounded-[16px_16px_16px_6px] border-[rgba(133,154,206,0.14)] bg-bubble",
          ].join(" ")}
        >
          {children}
        </div>
        <div className={["mt-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-text-muted", isOut ? "flex-row-reverse" : ""].join(" ")}>
          <span>{time}</span>
          {isOut && <span className={read ? "text-neon" : ""}>{read ? "Read" : "Sent"}</span>}
        </div>
      </div>
    </div>
  );
}

function AttachmentCard({ icon: Icon, title, meta }: { icon: typeof FileText; title: string; meta: string }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-[14px] border border-border-default bg-input-bg p-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel text-text-secondary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-text-primary">{title}</div>
        <div className="truncate text-[11px] font-semibold text-text-muted">{meta}</div>
      </div>
    </div>
  );
}
