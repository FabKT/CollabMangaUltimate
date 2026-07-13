import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  loadWorkflowState,
  markAllWorkflowNotificationsRead,
  setWorkflowNotificationRead,
  subscribeWorkflowState,
  type WorkflowNotification,
} from "@/lib/user-workflows";
import {
  Bell,
  Search,
  Settings2,
  CheckCheck,
  Trash2,
  MessageSquare,
  FolderKanban,
  Handshake,
  Users,
  BookOpen,
  Sparkles,
  ShieldAlert,
  Star,
  Archive,
  Reply,
  ExternalLink,
  Check,
  X,
  Calendar,
  FileImage,
  UserPlus,
  Info,
  ChevronDown,
  Paperclip,
  CircleAlert,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/_collab/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CollabManga" },
      {
        name: "description",
        content:
          "CollabManga notification center: messages, project updates, sponsorships, friends and manga activity.",
      },
    ],
  }),
  component: NotificationsPage,
});

// ---------- Types & mock data ---------------------------------------------

type Category = "message" | "project" | "sponsorship" | "friend" | "manga" | "system";
type Status = "unread" | "read";
type Importance = "normal" | "important" | "action";

type ActionKind = "primary" | "secondary" | "ghost" | "danger";
type ActionSpec = { label: string; kind: ActionKind };

type RelatedEntity =
  | { kind: "project"; title: string; subtitle: string; status: string }
  | { kind: "manga"; title: string; subtitle: string; status: string }
  | { kind: "chapter"; title: string; subtitle: string; status: string }
  | { kind: "sponsorship"; title: string; subtitle: string; status: string; price?: string; videoType?: string; duration?: string }
  | { kind: "conversation"; title: string; subtitle: string; status: string }
  | { kind: "profile"; title: string; subtitle: string; status: string }
  | { kind: "note"; title: string; subtitle: string; status: string }
  | { kind: "ai"; title: string; subtitle: string; status: string };

type Notification = {
  id: string;
  category: Category;
  typeLabel: string;
  title: string;
  preview: string;
  description: string;
  actor: string;
  time: string;
  status: Status;
  importance: Importance;
  archived?: boolean;
  entity?: RelatedEntity;
  meta?: { label: string; value: string }[];
  actions: ActionSpec[];
  secondaryActions?: ActionSpec[];
};

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    category: "message",
    typeLabel: "Direct message",
    title: "New message received",
    preview: "You have a new direct message in your inbox.",
    description:
      "A collaborator sent you a new direct message. Open the conversation to reply or continue the discussion.",
    actor: "Collaborator",
    time: "2 min",
    status: "unread",
    importance: "action",
    entity: { kind: "conversation", title: "Direct conversation", subtitle: "Private thread", status: "Active" },
    meta: [
      { label: "Conversation", value: "Direct" },
      { label: "Attachments", value: "None" },
    ],
    actions: [
      { label: "Open conversation", kind: "primary" },
      { label: "Reply", kind: "secondary" },
    ],
    secondaryActions: [
      { label: "Mark as read", kind: "ghost" },
      { label: "Archive", kind: "ghost" },
    ],
  },
  {
    id: "n2",
    category: "project",
    typeLabel: "Project invitation",
    title: "Project invitation",
    preview: "You've been invited to join a manga project as a collaborator.",
    description:
      "A project owner invited you to join their manga project with a proposed role. Review the project scope, team, and role before accepting.",
    actor: "Project owner",
    time: "18 min",
    status: "unread",
    importance: "action",
    entity: { kind: "project", title: "Manga project", subtitle: "Original serialized project", status: "In production" },
    meta: [
      { label: "Proposed role", value: "Dessinateur" },
      { label: "Team size", value: "4 members" },
    ],
    actions: [
      { label: "Accept invitation", kind: "primary" },
      { label: "Decline", kind: "danger" },
    ],
    secondaryActions: [{ label: "View project", kind: "secondary" }],
  },
  {
    id: "n3",
    category: "sponsorship",
    typeLabel: "Sponsorship proposal",
    title: "Sponsorship proposal received",
    preview: "A content creator sent a sponsorship offer for your project.",
    description:
      "A content creator submitted a sponsorship proposal for one of your published manga projects. Review the offer, video type, and budget before responding.",
    actor: "Content creator",
    time: "1 h",
    status: "unread",
    importance: "important",
    entity: {
      kind: "sponsorship",
      title: "Sponsorship announcement",
      subtitle: "Creator offer to project",
      status: "Pending review",
      price: "Budget on request",
      videoType: "Long-form review",
      duration: "8–12 min",
    },
    meta: [
      { label: "Type", value: "Creator offer" },
      { label: "Deadline", value: "In 6 days" },
    ],
    actions: [
      { label: "View proposal", kind: "primary" },
      { label: "Accept", kind: "secondary" },
      { label: "Decline", kind: "danger" },
    ],
    secondaryActions: [{ label: "Open sponsorship chat", kind: "ghost" }],
  },
  {
    id: "n4",
    category: "project",
    typeLabel: "Page validated",
    title: "Manga page validated",
    preview: "A page candidate was validated on one of your chapters.",
    description:
      "A candidate image for a manga page has been validated by a reviewer on your project. Open the chapter to see the finalized page.",
    actor: "Reviewer",
    time: "3 h",
    status: "unread",
    importance: "normal",
    entity: { kind: "chapter", title: "Chapter draft", subtitle: "Page 12 of the current chapter", status: "Validated" },
    meta: [
      { label: "Page", value: "12" },
      { label: "Status", value: "Validated" },
    ],
    actions: [
      { label: "Open chapter page", kind: "primary" },
      { label: "View validated image", kind: "secondary" },
    ],
  },
  {
    id: "n5",
    category: "friend",
    typeLabel: "Friend request",
    title: "Friend request received",
    preview: "A user wants to connect with you on CollabManga.",
    description:
      "A user sent you a friend request. Accept to add them to your network and enable direct collaboration suggestions.",
    actor: "New user",
    time: "5 h",
    status: "unread",
    importance: "action",
    entity: { kind: "profile", title: "User profile", subtitle: "Manga creator · Dessinateur", status: "New" },
    meta: [{ label: "Mutual friends", value: "3" }],
    actions: [
      { label: "Accept friend request", kind: "primary" },
      { label: "Decline", kind: "danger" },
    ],
    secondaryActions: [{ label: "View profile", kind: "secondary" }],
  },
  {
    id: "n6",
    category: "manga",
    typeLabel: "New chapter",
    title: "New chapter published",
    preview: "A manga you follow just released a new chapter.",
    description:
      "A creator you follow has published a new chapter in one of their ongoing manga. Open it to start reading right away.",
    actor: "Followed creator",
    time: "8 h",
    status: "read",
    importance: "normal",
    entity: { kind: "manga", title: "Followed manga", subtitle: "Ongoing serialization", status: "New chapter" },
    meta: [
      { label: "Chapter", value: "Latest" },
      { label: "Language", value: "FR" },
    ],
    actions: [
      { label: "Read chapter", kind: "primary" },
      { label: "View manga", kind: "secondary" },
    ],
  },
  {
    id: "n7",
    category: "message",
    typeLabel: "Attachment received",
    title: "Attachment received in a project chat",
    preview: "A collaborator shared a file in a project conversation.",
    description:
      "A new attachment was uploaded in a project conversation you're part of. Open the conversation to preview and download.",
    actor: "Collaborator",
    time: "10 h",
    status: "read",
    importance: "normal",
    entity: { kind: "conversation", title: "Project conversation", subtitle: "Team thread", status: "Active" },
    meta: [
      { label: "File type", value: "Image" },
      { label: "Linked to", value: "Chapter draft" },
    ],
    actions: [
      { label: "Open attachment", kind: "primary" },
      { label: "Open conversation", kind: "secondary" },
    ],
  },
  {
    id: "n8",
    category: "project",
    typeLabel: "Calendar reminder",
    title: "Deadline reminder on a project note",
    preview: "A note linked to one of your projects is due soon.",
    description:
      "A calendar-linked project note is approaching its deadline. Open the note or your project calendar to review the task.",
    actor: "Calendar",
    time: "Yesterday",
    status: "read",
    importance: "important",
    entity: { kind: "note", title: "Project note", subtitle: "Linked to project calendar", status: "Due soon" },
    meta: [
      { label: "Priority", value: "High" },
      { label: "Deadline", value: "Tomorrow" },
    ],
    actions: [
      { label: "Open calendar", kind: "primary" },
      { label: "Open note", kind: "secondary" },
    ],
    secondaryActions: [{ label: "Mark as done", kind: "ghost" }],
  },
  {
    id: "n9",
    category: "sponsorship",
    typeLabel: "Proposal accepted",
    title: "Sponsorship proposal accepted",
    preview: "A sponsorship proposal you were involved in has been accepted.",
    description:
      "The related sponsorship proposal has been accepted. Continue the collaboration in the sponsorship chat and align on next steps.",
    actor: "Sponsorship partner",
    time: "Yesterday",
    status: "read",
    importance: "normal",
    entity: {
      kind: "sponsorship",
      title: "Sponsorship announcement",
      subtitle: "Project request",
      status: "Accepted",
    },
    meta: [
      { label: "Type", value: "Project request" },
      { label: "Next step", value: "Kickoff chat" },
    ],
    actions: [
      { label: "Open sponsorship chat", kind: "primary" },
      { label: "View announcement", kind: "secondary" },
    ],
  },
  {
    id: "n10",
    category: "manga",
    typeLabel: "New comment",
    title: "New comment on your manga",
    preview: "A reader left a comment on one of your published chapters.",
    description:
      "A reader posted a new comment on one of your manga chapters. Open the discussion thread to reply or moderate.",
    actor: "Reader",
    time: "2 d",
    status: "read",
    importance: "normal",
    entity: { kind: "manga", title: "Your manga", subtitle: "Published chapter", status: "Active" },
    meta: [{ label: "Thread", value: "Chapter comments" }],
    actions: [
      { label: "Open comments", kind: "primary" },
      { label: "Reply", kind: "secondary" },
    ],
  },
  {
    id: "n11",
    category: "system",
    typeLabel: "AI generation",
    title: "AI generation completed",
    preview: "An AI generation you started has finished processing.",
    description:
      "An AI generation task linked to one of your chapters completed successfully. Open the result to review and integrate it.",
    actor: "AI service",
    time: "2 d",
    status: "read",
    importance: "normal",
    entity: { kind: "ai", title: "AI generation result", subtitle: "Linked to a chapter draft", status: "Completed" },
    meta: [
      { label: "Generation", value: "Image" },
      { label: "Status", value: "Ready" },
    ],
    actions: [
      { label: "Open result", kind: "primary" },
      { label: "View history", kind: "secondary" },
    ],
  },
  {
    id: "n12",
    category: "system",
    typeLabel: "Account security",
    title: "Account security check",
    preview: "A security event was recorded on your account.",
    description:
      "A recent account security event was recorded. Review your account settings and active sessions if you don't recognize the activity.",
    actor: "Security",
    time: "3 d",
    status: "read",
    importance: "important",
    meta: [
      { label: "Event", value: "New sign-in" },
      { label: "Device", value: "Unknown" },
    ],
    actions: [{ label: "Review account settings", kind: "primary" }],
    secondaryActions: [{ label: "Dismiss", kind: "ghost" }],
  },
];

// ---------- Config --------------------------------------------------------

const TABS: { id: "all" | Category; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "message", label: "Message" },
  { id: "project", label: "Mes projet" },
  { id: "sponsorship", label: "Parrainage" },
  { id: "friend", label: "Amis" },
  { id: "manga", label: "Manga" },
];

const FILTERS = ["All", "Unread", "Read", "Important", "Archived"] as const;
type FilterKey = (typeof FILTERS)[number];

const CATEGORY_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  message: MessageSquare,
  project: FolderKanban,
  sponsorship: Handshake,
  friend: Users,
  manga: BookOpen,
  system: Sparkles,
};

const CATEGORY_LABEL: Record<Category, string> = {
  message: "Message",
  project: "Mes projet",
  sponsorship: "Parrainage",
  friend: "Amis",
  manga: "Manga",
  system: "Système",
};

// ---------- Page ----------------------------------------------------------

function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"all" | Category>("all");
  const [filter, setFilter] = useState<FilterKey>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("n2");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [workflowNotifications, setWorkflowNotifications] = useState<WorkflowNotification[]>([]);

  useEffect(() => {
    const refresh = () => setWorkflowNotifications(loadWorkflowState().notifications);
    refresh();
    return subscribeWorkflowState(refresh);
  }, []);

  const notifications = useMemo(
    () => [...workflowNotifications.map(workflowToNotification), ...NOTIFICATIONS],
    [workflowNotifications],
  );

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab !== "all" && n.category !== activeTab) return false;
      if (filter === "Unread" && n.status !== "unread") return false;
      if (filter === "Read" && n.status !== "read") return false;
      if (filter === "Important" && n.importance !== "important" && n.importance !== "action") return false;
      if (filter === "Archived" && !n.archived) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.preview.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeTab, filter, notifications, search]);

  const unreadCountByTab = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const n of notifications) {
      if (n.status === "unread") {
        map.all = (map.all ?? 0) + 1;
        map[n.category] = (map[n.category] ?? 0) + 1;
      }
    }
    return map;
  }, [notifications]);

  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <PageTitle />

        <div className="mt-6 md:mt-8">
          <TabBar
            tabs={TABS}
            active={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              setSelectedId(null);
            }}
            unread={unreadCountByTab}
          />
        </div>

        <section className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-2">
          <ListPanel
            notifications={filtered}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setSelectedId(id);
              setWorkflowNotificationRead(id, true);
              setWorkflowNotifications(loadWorkflowState().notifications);
              setMobileDetailOpen(true);
            }}
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
          />

          <div className="hidden lg:block">
            <DetailPanel notification={selected} />
          </div>
        </section>
      </div>

      {/* Mobile detail overlay */}
      {mobileDetailOpen && selected && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg lg:hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border-default)] px-4 py-3">
            <button
              onClick={() => setMobileDetailOpen(false)}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-secondary hover:text-text"
            >
              <X className="h-4 w-4" /> Close
            </button>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
              Notification
            </span>
            <span className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-slim p-4">
            <DetailPanel notification={selected} embedded />
          </div>
        </div>
      )}
    </main>
  );
}

// ---------- Page title ----------------------------------------------------

function workflowToNotification(n: WorkflowNotification): Notification {
  return {
    id: n.id,
    category: n.category,
    typeLabel: n.type,
    title: n.title,
    preview: n.content,
    description: n.content,
    actor: n.actor,
    time: relativeTime(n.createdAt),
    status: n.read ? "read" : "unread",
    importance: n.actions.some((action) => action.kind === "primary" || action.kind === "danger")
      ? "action"
      : "normal",
    entity: workflowEntity(n),
    meta: n.meta,
    actions: n.actions,
    secondaryActions: n.secondaryActions,
  };
}

function workflowEntity(n: WorkflowNotification): RelatedEntity {
  const base = {
    title: n.entityTitle,
    subtitle: n.entitySubtitle || n.entityType,
    status: n.entityStatus || "Nouveau",
  };
  if (n.entityType === "profile") return { kind: "profile", ...base };
  if (n.entityType === "note") return { kind: "note", ...base };
  if (n.category === "sponsorship") return { kind: "sponsorship", ...base };
  if (n.entityType === "chapter") return { kind: "chapter", ...base };
  if (n.entityType === "manga") return { kind: "manga", ...base };
  return { kind: "project", ...base };
}

function relativeTime(iso: string) {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function PageTitle() {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="max-w-2xl">
        <h1
          className="font-display text-[28px] font-bold leading-9 text-text"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Notifications
        </h1>
        <p className="mt-2 text-[14px] font-medium leading-[22px] text-text-secondary">
          Track messages, project updates, sponsorship proposals, friend activity, and manga updates.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          icon={<CheckCheck className="h-4 w-4" />}
          onClick={() => {
            markAllWorkflowNotificationsRead();
          }}
        >
          Mark all as read
        </SecondaryButton>
        <SecondaryButton icon={<Trash2 className="h-4 w-4" />}>Clear read</SecondaryButton>
        <IconButton aria-label="Notification settings">
          <Settings2 className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}

// ---------- Tabs ----------------------------------------------------------

function TabBar({
  tabs,
  active,
  onChange,
  unread,
}: {
  tabs: { id: "all" | Category; label: string }[];
  active: "all" | Category;
  onChange: (id: "all" | Category) => void;
  unread: Record<string, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Notification categories"
      className="scrollbar-slim -mx-1 flex gap-2 overflow-x-auto px-1"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        const count = unread[t.id] ?? 0;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={[
              "inline-flex h-[38px] shrink-0 items-center gap-2 rounded-full border px-[14px] text-[13px] font-bold leading-[18px] transition-colors",
              isActive
                ? "border-[color:var(--color-neon-border)] bg-[color:var(--color-neon-soft)] text-[color:var(--color-neon)]"
                : "border-[color:var(--color-border-default)] bg-elevated text-text-secondary hover:border-[rgba(57,255,136,0.30)] hover:text-text",
            ].join(" ")}
          >
            <span>{t.label}</span>
            {count > 0 && (
              <span
                className={[
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                  isActive
                    ? "bg-[color:var(--color-neon)] text-[#04111E]"
                    : "bg-[rgba(133,154,206,0.14)] text-text-secondary",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- List panel ----------------------------------------------------

function ListPanel({
  notifications,
  selectedId,
  onSelect,
  search,
  onSearch,
  filter,
  onFilter,
}: {
  notifications: Notification[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (v: string) => void;
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
}) {
  return (
    <div
      className="flex h-[calc(100vh-260px)] min-h-[560px] flex-col rounded-[22px] border border-[color:var(--color-border-default)] bg-panel p-4 shadow-[var(--shadow-panel)]"
      aria-label="Notification list"
    >
      {/* Search */}
      <label className="relative block">
        <span className="sr-only">Search notifications</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search notifications…"
          className="h-11 w-full rounded-[14px] border border-[color:var(--color-border-default)] bg-input pl-11 pr-4 text-[14px] font-medium text-text placeholder:text-text-muted focus:border-[color:var(--color-neon)] focus:shadow-[0_0_0_3px_rgba(57,255,136,0.10)] focus:outline-none"
        />
      </label>

      {/* Filters + sort */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                onClick={() => onFilter(f)}
                className={[
                  "inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold transition-colors",
                  active
                    ? "border-[color:var(--color-neon-border)] bg-[color:var(--color-neon-soft)] text-[color:var(--color-neon)]"
                    : "border-[color:var(--color-border-default)] bg-input text-text-secondary hover:text-text",
                ].join(" ")}
              >
                {f}
              </button>
            );
          })}
        </div>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--color-border-default)] bg-input px-3 text-[12px] font-semibold text-text-secondary hover:text-text">
          Newest first
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="scrollbar-slim mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications in this category"
            text="Try another tab or clear filters."
          />
        ) : (
          notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              selected={n.id === selectedId}
              onClick={() => onSelect(n.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  notification,
  selected,
  onClick,
}: {
  notification: Notification;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = CATEGORY_ICON[notification.category];
  const unread = notification.status === "unread";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected}
      className={[
        "group relative flex w-full items-start gap-3 rounded-[16px] border p-4 text-left transition-all",
        selected
          ? "border-[color:var(--color-neon-border)] bg-[rgba(57,255,136,0.08)] shadow-[var(--shadow-neon)]"
          : "border-[color:var(--color-border-default)] bg-elevated hover:border-[color:var(--color-border-strong)]",
      ].join(" ")}
    >
      {unread && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--color-neon)]"
        />
      )}

      <div
        className={[
          "grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border",
          selected
            ? "border-[color:var(--color-neon-border)] bg-[color:var(--color-neon-soft)] text-[color:var(--color-neon)]"
            : "border-[color:var(--color-border-default)] bg-panel text-text-secondary",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={[
                "truncate text-[14px] leading-5",
                unread ? "font-extrabold text-text" : "font-bold text-text-secondary",
              ].join(" ")}
            >
              {notification.title}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-text-muted">
              {notification.preview}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
              {notification.time}
            </span>
            {unread && (
              <span
                className="h-2 w-2 rounded-full bg-[color:var(--color-neon)] shadow-[0_0_8px_rgba(57,255,136,0.6)]"
                aria-label="Unread"
              />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------- Detail panel --------------------------------------------------

function DetailPanel({
  notification,
  embedded = false,
}: {
  notification: Notification | null;
  embedded?: boolean;
}) {
  const wrapper = embedded
    ? "rounded-[22px] border border-[color:var(--color-border-default)] bg-details p-6"
    : "flex h-[calc(100vh-260px)] min-h-[560px] flex-col rounded-[22px] border border-[color:var(--color-border-default)] bg-details p-6 shadow-[var(--shadow-panel)]";

  if (!notification) {
    return (
      <aside className={wrapper} aria-label="Notification details">
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="Select a notification"
          text="Choose a notification from the list to view details and available actions."
          centered
        />
      </aside>
    );
  }

  return (
    <aside className={wrapper} aria-label="Notification details">
      <div className="scrollbar-slim -mr-2 flex-1 overflow-y-auto pr-2">
        {/* Top area */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{CATEGORY_LABEL[notification.category]}</Chip>
          <Chip tone={notification.status === "unread" ? "neon" : "neutral"}>
            {notification.status === "unread" ? "Unread" : "Read"}
          </Chip>
          {notification.importance === "important" && <Chip tone="warning">Important</Chip>}
          {notification.importance === "action" && <Chip tone="info">Action required</Chip>}
          <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
            {notification.time} ago
          </span>
        </div>

        <h2
          className="mt-4 text-[20px] font-bold leading-7 text-text"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {notification.title}
        </h2>
        <p className="mt-2 text-[14px] font-medium leading-[22px] text-text-secondary">
          {notification.description}
        </p>

        {/* Middle */}
        <div className="mt-6 space-y-4">
          {notification.entity && <RelatedEntityCard entity={notification.entity} />}

          {notification.meta && notification.meta.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {notification.meta.map((m) => (
                <div
                  key={m.label}
                  className="rounded-[16px] border border-[color:var(--color-border-default)] bg-panel p-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
                    {m.label}
                  </p>
                  <p className="mt-1.5 text-[14px] font-semibold text-text">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {notification.category === "message" && (
            <PreviewCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Message preview"
              body="This is a placeholder preview of the message content. Open the conversation to view the full thread."
            />
          )}
          {notification.category === "sponsorship" &&
            notification.entity?.kind === "sponsorship" && (
              <div className="grid grid-cols-3 gap-3">
                <MetaTile label="Price" value={notification.entity.price ?? "—"} />
                <MetaTile label="Video type" value={notification.entity.videoType ?? "—"} />
                <MetaTile label="Duration" value={notification.entity.duration ?? "—"} />
              </div>
            )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-6 border-t border-[color:var(--color-border-default)] pt-5">
        <div className="flex flex-wrap gap-2">
          {notification.actions.map((a) => (
            isProfileAction(a.label) ? (
              <ProfileActionLink key={a.label} kind={a.kind} icon={iconForAction(a.label)}>
                {a.label}
              </ProfileActionLink>
            ) : (
              <ActionButton key={a.label} kind={a.kind} icon={iconForAction(a.label)}>
                {a.label}
              </ActionButton>
            )
          ))}
        </div>
        {notification.secondaryActions && notification.secondaryActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {notification.secondaryActions.map((a) => (
              isProfileAction(a.label) ? (
                <ProfileActionLink key={a.label} kind={a.kind} icon={iconForAction(a.label)}>
                  {a.label}
                </ProfileActionLink>
              ) : (
                <ActionButton key={a.label} kind={a.kind} icon={iconForAction(a.label)}>
                  {a.label}
                </ActionButton>
              )
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function iconForAction(label: string) {
  const l = label.toLowerCase();
  if (l.includes("accept") || l.includes("validate") || l.includes("confirm"))
    return <Check className="h-4 w-4" />;
  if (l.includes("decline") || l.includes("delete") || l.includes("reject") || l.includes("remove"))
    return <X className="h-4 w-4" />;
  if (l.includes("archive")) return <Archive className="h-4 w-4" />;
  if (l.includes("reply")) return <Reply className="h-4 w-4" />;
  if (l.includes("open") || l.includes("view") || l.includes("read"))
    return <ExternalLink className="h-4 w-4" />;
  if (l.includes("mark as read")) return <CheckCheck className="h-4 w-4" />;
  if (l.includes("calendar")) return <Calendar className="h-4 w-4" />;
  if (l.includes("attachment") || l.includes("download")) return <Paperclip className="h-4 w-4" />;
  if (l.includes("profile") || l.includes("friend")) return <UserPlus className="h-4 w-4" />;
  return null;
}

function RelatedEntityCard({ entity }: { entity: RelatedEntity }) {
  const iconMap: Record<RelatedEntity["kind"], React.ReactNode> = {
    project: <FolderKanban className="h-5 w-5" />,
    manga: <BookOpen className="h-5 w-5" />,
    chapter: <Layers className="h-5 w-5" />,
    sponsorship: <Handshake className="h-5 w-5" />,
    conversation: <MessageSquare className="h-5 w-5" />,
    profile: <UserPlus className="h-5 w-5" />,
    note: <Calendar className="h-5 w-5" />,
    ai: <Sparkles className="h-5 w-5" />,
  };

  return (
    <div className="flex items-center gap-4 rounded-[16px] border border-[color:var(--color-border-default)] bg-panel p-4 shadow-[var(--shadow-card)]">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-[color:var(--color-border-default)] bg-elevated text-[color:var(--color-neon)]">
        {iconMap[entity.kind]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
          Related {entity.kind}
        </p>
        <p className="mt-0.5 truncate text-[14px] font-bold text-text">{entity.title}</p>
        <p className="truncate text-[13px] font-medium text-text-secondary">{entity.subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Chip tone="neon" small>
          {entity.status}
        </Chip>
        <button
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text"
          aria-label="Open"
        >
          Open <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PreviewCard({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-[16px] border border-[color:var(--color-border-default)] bg-panel p-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--color-border-default)] bg-elevated">
          {icon}
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">{label}</p>
      </div>
      <p className="mt-3 text-[13px] font-medium leading-5 text-text-secondary">{body}</p>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--color-border-default)] bg-panel p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">{label}</p>
      <p className="mt-1.5 text-[14px] font-semibold text-text">{value}</p>
    </div>
  );
}

// ---------- Primitives ---------------------------------------------------

function Chip({
  children,
  tone = "neutral",
  small = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "neon" | "warning" | "danger" | "info";
  small?: boolean;
}) {
  const styles: Record<string, string> = {
    neutral:
      "bg-input text-text-secondary border-[color:var(--color-border-default)]",
    neon: "bg-[color:var(--color-neon-soft)] text-[color:var(--color-neon)] border-[color:var(--color-neon-border)]",
    warning: "bg-[rgba(255,184,77,0.12)] text-[color:var(--color-warning)] border-[rgba(255,184,77,0.35)]",
    danger: "bg-[rgba(255,95,126,0.12)] text-[color:var(--color-danger)] border-[rgba(255,95,126,0.35)]",
    info: "bg-[rgba(117,167,255,0.12)] text-[color:var(--color-info)] border-[rgba(117,167,255,0.35)]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-semibold",
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function actionButtonClass(kind: ActionKind = "primary") {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-[18px] text-[14px] font-bold leading-5 transition-colors";
  const styles: Record<ActionKind, string> = {
    primary:
      "bg-[color:var(--color-neon)] text-[#04111E] hover:bg-[color:var(--color-neon-hover)]",
    secondary:
      "border border-[color:var(--color-border-strong)] text-text hover:bg-[rgba(255,255,255,0.04)]",
    ghost: "text-text-secondary hover:text-text",
    danger:
      "border border-[rgba(255,95,126,0.35)] bg-[rgba(255,95,126,0.10)] text-[color:var(--color-danger)] hover:bg-[rgba(255,95,126,0.18)]",
  };
  return [base, styles[kind]].join(" ");
}

function isProfileAction(label: string) {
  return label.toLowerCase().includes("profile");
}

function ProfileActionLink({
  children,
  kind = "primary",
  icon,
}: {
  children: React.ReactNode;
  kind?: ActionKind;
  icon?: React.ReactNode;
}) {
  return (
    <Link to="/profile/$profileId" params={{ profileId: "u1" }} className={actionButtonClass(kind)}>
      {icon}
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  kind = "primary",
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ActionKind;
  icon?: React.ReactNode;
}) {
  return (
    <button {...rest} className={actionButtonClass(kind)}>
      {icon}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[color:var(--color-border-strong)] px-[18px] text-[14px] font-bold text-text hover:bg-[rgba(255,255,255,0.04)]"
    >
      {icon}
      {children}
    </button>
  );
}

function IconButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="grid h-9 w-9 place-items-center rounded-[12px] border border-[color:var(--color-border-default)] bg-elevated text-text-secondary transition-colors hover:border-[color:var(--color-neon-border)] hover:text-text"
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  text,
  icon,
  centered = false,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center rounded-[16px] border border-dashed border-[color:var(--color-border-default)] bg-panel/40 p-8 text-center",
        centered ? "my-auto" : "",
      ].join(" ")}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full border border-[color:var(--color-border-default)] bg-elevated text-text-secondary">
        {icon ?? <Info className="h-5 w-5" />}
      </div>
      <h3
        className="mt-4 text-[16px] font-bold text-text"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-[13px] font-medium text-text-secondary">{text}</p>
    </div>
  );
}

// Suppress unused-import warnings for icons kept for readiness with more notification types.
void ShieldAlert;
void Star;
void FileImage;
void CircleAlert;
