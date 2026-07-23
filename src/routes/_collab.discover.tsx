import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listDiscoverProfiles, sendFriendRequestDb, startConversationWith } from "@/lib/db";
import { listSponsorOptions } from "@/lib/sponsorship-options";
import { SITE_LANGUAGES } from "@/lib/languages";
import { localizeLabel, useI18n } from "@/lib/i18n";
import {
  Search,
  SlidersHorizontal,
  Star,
  Grid3x3,
  List,
  X,
  ChevronDown,
  MessageSquare,
  UserPlus,
  Sparkles,
  Radio,
  Youtube,
  Instagram,
  Twitter,
  Twitch,
  ChevronRight,
  Handshake,
  FolderKanban,
} from "lucide-react";

export const Route = createFileRoute("/_collab/discover")({
  head: () => ({
    meta: [
      { title: "Find Users — CollabManga" },
      {
        name: "description",
        content:
          "Search artists, writers, content creators, readers, and collaborators for manga projects. Filter by language, role, skills, genre, and availability.",
      },
      { property: "og:title", content: "Find Users — CollabManga" },
      {
        property: "og:description",
        content: "Discover manga collaborators by role, skill, genre, availability and more.",
      },
    ],
  }),
  component: UsersPage,
});

/* ---------------- data ---------------- */

type Role = "Artist" | "Writer" | "Content creator" | "Reader";

const STATUSES: Role[] = ["Artist", "Writer", "Content creator", "Reader"];

const GENRES = ["Shonen", "Seinen", "Shojo", "Josei"];

const SUBGENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Science fiction",
  "Romance",
  "Slice of life",
  "Horror",
  "Mystery",
  "Historical",
  "Sport",
  "Isekai",
  "Psychological",
];

const PLATFORMS = ["YouTube", "TikTok", "Instagram", "Twitter / X", "Twitch", "Other"];

const CREATOR_VIDEO_TYPES = [
  "Review",
  "Reaction",
  "Short videos",
  "Long videos",
  "Analysis",
  "Presentation",
];
const CREATOR_DURATIONS = [
  "0-30 s",
  "30-60 s",
  "60-120 s",
  "2-3 min",
  "3-5 min",
  "5-10 min",
  "10+ min",
];
const CREATOR_PAYMENT_MODES = ["Abonnement", "Paiement unique", "Négociable"];

type SponsorshipOption = {
  id: string;
  title: string;
  type: string;
  videoType: string;
  duration: string;
  price: string;
  paymentMode: string;
  description: string;
};

type CreatorAdvancedFilters = {
  platforms: string[];
  videoTypes: string[];
  durations: string[];
  paymentModes: string[];
  minSubs: string;
  maxSubs: string;
  sponsorshipOnly: boolean;
};

const EMPTY_CREATOR_FILTERS: CreatorAdvancedFilters = {
  platforms: [],
  videoTypes: [],
  durations: [],
  paymentModes: [],
  minSubs: "",
  maxSubs: "",
  sponsorshipOnly: false,
};

type Profile = {
  id: string;
  username: string;
  initials: string;
  avatarUrl?: string;
  role: Role;
  languages: string[];
  rating: number;
  availability: string;
  bio: string;
  genres: string[];
  skills: string[];
  projects: number;
  platforms?: string[];
  audience?: string;
  sponsorshipOptions?: SponsorshipOption[];
};

// Plus de profils fictifs : la page charge les utilisateurs réellement inscrits (Supabase).
function initialsOf(name: string) {
  return (
    name
      .split(/[\s_.-]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Rôle choisi dans le popup de modification du profil (FR) → rôle affiché sur Discover (EN). */
const ROLE_FROM_PROFILE: Record<string, Role> = {
  Dessinateur: "Artist",
  Scénariste: "Writer",
  "Créateur de contenu": "Content creator",
  Lecteur: "Reader",
};

function profileFromDb(db: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role?: string | null;
  preferences?: {
    bio?: string;
    languages?: string[];
    available?: boolean;
    favoriteGenres?: string[];
    favoriteSubgenres?: string[];
  } | null;
}): Profile {
  const name = db.display_name || db.username;
  return {
    id: db.id,
    username: db.username.startsWith("@") ? db.username : `@${db.username}`,
    initials: initialsOf(name),
    avatarUrl: db.avatar_url ?? undefined,
    role: (db.role && ROLE_FROM_PROFILE[db.role]) || "Reader",
    languages: db.preferences?.languages?.length ? db.preferences.languages : ["Français"],
    rating: 0,
    availability: db.preferences?.available === false ? "Indisponible" : "Disponible",
    bio: db.preferences?.bio || "Profil CollabManga — bio à compléter.",
    genres: [
      ...(db.preferences?.favoriteGenres ?? []),
      ...(db.preferences?.favoriteSubgenres ?? []),
    ],
    skills: [],
    projects: 0,
  };
}

/* ---------------- helpers ---------------- */

function classNames(...s: (string | false | undefined)[]) {
  return s.filter(Boolean).join(" ");
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function hasCreatorAdvancedFilters(filters: CreatorAdvancedFilters) {
  return (
    filters.platforms.length > 0 ||
    filters.videoTypes.length > 0 ||
    filters.durations.length > 0 ||
    filters.paymentModes.length > 0 ||
    filters.minSubs.trim() !== "" ||
    filters.maxSubs.trim() !== "" ||
    filters.sponsorshipOnly
  );
}

function creatorFilterCount(filters: CreatorAdvancedFilters) {
  return (
    filters.platforms.length +
    filters.videoTypes.length +
    filters.durations.length +
    filters.paymentModes.length +
    (filters.minSubs.trim() ? 1 : 0) +
    (filters.maxSubs.trim() ? 1 : 0) +
    (filters.sponsorshipOnly ? 1 : 0)
  );
}

function parseAudience(value?: string) {
  if (!value) return 0;
  const match = value
    .toLowerCase()
    .replace(",", ".")
    .match(/([\d.]+)\s*k?/);
  if (!match) return 0;
  const base = Number(match[1]);
  return value.toLowerCase().includes("k") ? base * 1000 : base;
}

function matchesCreatorAdvancedFilters(profile: Profile, filters: CreatorAdvancedFilters) {
  if (!hasCreatorAdvancedFilters(filters)) return true;
  if (profile.role !== "Content creator") return false;

  const options = profile.sponsorshipOptions ?? [];
  if (filters.sponsorshipOnly && options.length === 0) return false;
  if (
    filters.platforms.length &&
    !filters.platforms.every((platform) => profile.platforms?.includes(platform))
  )
    return false;

  if (filters.videoTypes.length) {
    const hasVideoType = filters.videoTypes.some(
      (type) =>
        options.some((option) => option.videoType === type) || profile.skills.includes(type),
    );
    if (!hasVideoType) return false;
  }

  if (filters.durations.length) {
    const hasDuration = filters.durations.some((duration) =>
      options.some((option) => option.duration === duration),
    );
    if (!hasDuration) return false;
  }

  if (filters.paymentModes.length) {
    const hasPaymentMode = filters.paymentModes.some((mode) =>
      options.some((option) => option.paymentMode === mode),
    );
    if (!hasPaymentMode) return false;
  }

  const audience = parseAudience(profile.audience);
  const minSubs = Number(filters.minSubs) || 0;
  const maxSubs = Number(filters.maxSubs) || 0;
  if (minSubs && audience < minSubs) return false;
  if (maxSubs && audience > maxSubs) return false;

  return true;
}

/* ---------------- reusable UI ---------------- */

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value) ? "fill-[color:var(--cm-star)]" : ""}
          color="var(--cm-star)"
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  size = "sm",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  size?: "sm" | "xs";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-full border transition select-none",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
        "font-medium",
        active
          ? "border-[color:var(--cm-accent)] bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)] shadow-[0_0_0_1px_var(--cm-accent-soft)_inset]"
          : "border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)]",
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[color:var(--cm-border)] py-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--cm-text)]">
            {title}
          </h3>
          {count ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--cm-accent-soft)] px-1.5 text-[10px] font-bold text-[color:var(--cm-accent)]">
              {count}
            </span>
          ) : null}
        </div>
        <ChevronDown
          size={16}
          className={classNames(
            "text-[color:var(--cm-text-3)] transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function RatingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-[color:var(--cm-text-3)]">{label}</div>
      <div className="grid grid-cols-6 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-pressed={active}
              className={classNames(
                "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition",
                active
                  ? "border-[color:var(--cm-accent)] bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-text)]"
                  : "border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:border-[color:var(--cm-border-hover)]",
              )}
            >
              <span className="flex items-center gap-0.5">
                {n}
                <Star size={10} color="var(--cm-star)" className="fill-[color:var(--cm-star)]" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlatformIcon({ name }: { name: string }) {
  const size = 12;
  if (name === "YouTube") return <Youtube size={size} />;
  if (name === "TikTok") return <Radio size={size} />;
  if (name === "Instagram") return <Instagram size={size} />;
  if (name === "Twitter / X") return <Twitter size={size} />;
  if (name === "Twitch") return <Twitch size={size} />;
  return <Sparkles size={size} />;
}

/* ---------------- page ---------------- */

function UsersPage() {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [languages, setLanguages] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(5);
  const [genres, setGenres] = useState<string[]>([]);
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listDiscoverProfiles()
      .then(async (rows) => {
        const options = await listSponsorOptions(rows.map((row) => row.id));
        if (cancelled) return;
        const optionsByOwner = new Map<string, typeof options>();
        for (const option of options) {
          if (!option.ownerId) continue;
          const ownerOptions = optionsByOwner.get(option.ownerId) ?? [];
          ownerOptions.push(option);
          optionsByOwner.set(option.ownerId, ownerOptions);
        }
        setProfiles(
          rows.map((row) => {
            const profile = profileFromDb(row);
            const ownOptions = optionsByOwner.get(row.id) ?? [];
            return {
              ...profile,
              platforms: [...new Set(ownOptions.flatMap((option) => option.platforms))],
              audience: ownOptions.length
                ? `${Math.max(...ownOptions.map((option) => option.subscribersMax ?? option.subscribersMin ?? 0))} abonnés`
                : undefined,
              sponsorshipOptions: ownOptions.map((option) => ({
                id: option.id,
                title: option.format,
                type: option.format,
                videoType: option.videoType,
                duration: option.duration,
                price: option.price,
                paymentMode: option.paymentMode,
                description: option.description,
              })),
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [creatorFilterOpen, setCreatorFilterOpen] = useState(false);
  const [creatorFilters, setCreatorFilters] =
    useState<CreatorAdvancedFilters>(EMPTY_CREATOR_FILTERS);
  const [sponsorshipProfile, setSponsorshipProfile] = useState<Profile | null>(null);
  const [friendTarget, setFriendTarget] = useState<Profile | null>(null);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const contactProfile = async (profile: Profile) => {
    if (contactingId) return;
    setContactingId(profile.id);
    setContactError(null);
    try {
      const conversation = await startConversationWith(profile.id);
      await navigate({ to: "/messages", search: { conversation } });
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "Impossible d'ouvrir la conversation.",
      );
    } finally {
      setContactingId(null);
    }
  };

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    const push = (key: string, vals: string[], setter: (v: string[]) => void) =>
      vals.forEach((v) =>
        list.push({
          key: `${key}:${v}`,
          label: v,
          onRemove: () => setter(vals.filter((x) => x !== v)),
        }),
      );
    push("lang", languages, setLanguages);
    push("status", statuses, setStatuses);
    push("genre", genres, setGenres);
    push("sub", subgenres, setSubgenres);
    if (minRating > 0)
      list.push({ key: "min", label: `Min ${minRating}★`, onRemove: () => setMinRating(0) });
    if (maxRating < 5)
      list.push({ key: "max", label: `Max ${maxRating}★`, onRemove: () => setMaxRating(5) });
    creatorFilters.platforms.forEach((v) =>
      list.push({
        key: `creator-platform:${v}`,
        label: v,
        onRemove: () =>
          setCreatorFilters((f) => ({ ...f, platforms: f.platforms.filter((x) => x !== v) })),
      }),
    );
    creatorFilters.videoTypes.forEach((v) =>
      list.push({
        key: `creator-video:${v}`,
        label: v,
        onRemove: () =>
          setCreatorFilters((f) => ({ ...f, videoTypes: f.videoTypes.filter((x) => x !== v) })),
      }),
    );
    creatorFilters.durations.forEach((v) =>
      list.push({
        key: `creator-duration:${v}`,
        label: v,
        onRemove: () =>
          setCreatorFilters((f) => ({ ...f, durations: f.durations.filter((x) => x !== v) })),
      }),
    );
    creatorFilters.paymentModes.forEach((v) =>
      list.push({
        key: `creator-payment:${v}`,
        label: v,
        onRemove: () =>
          setCreatorFilters((f) => ({ ...f, paymentModes: f.paymentModes.filter((x) => x !== v) })),
      }),
    );
    if (creatorFilters.minSubs.trim()) {
      list.push({
        key: "creator-min-subs",
        label: `Min ${creatorFilters.minSubs} abonnés`,
        onRemove: () => setCreatorFilters((f) => ({ ...f, minSubs: "" })),
      });
    }
    if (creatorFilters.maxSubs.trim()) {
      list.push({
        key: "creator-max-subs",
        label: `Max ${creatorFilters.maxSubs} abonnés`,
        onRemove: () => setCreatorFilters((f) => ({ ...f, maxSubs: "" })),
      });
    }
    if (creatorFilters.sponsorshipOnly) {
      list.push({
        key: "creator-sponsorship-only",
        label: "Options de parrainage",
        onRemove: () => setCreatorFilters((f) => ({ ...f, sponsorshipOnly: false })),
      });
    }
    return list;
  }, [languages, statuses, genres, subgenres, minRating, maxRating, creatorFilters]);

  const resetAll = () => {
    setLanguages([]);
    setStatuses([]);
    setGenres([]);
    setSubgenres([]);
    setCreatorFilters(EMPTY_CREATOR_FILTERS);
    setMinRating(0);
    setMaxRating(5);
    setQuery("");
  };

  const results = profiles.filter((p) => {
    if (p.rating < minRating || p.rating > maxRating) return false;
    if (statuses.length && !statuses.includes(p.role)) return false;
    if (languages.length && !languages.some((language) => p.languages.includes(language)))
      return false;
    if (genres.length && !genres.some((genre) => p.genres.includes(genre))) return false;
    if (subgenres.length && !subgenres.some((subgenre) => p.genres.includes(subgenre)))
      return false;
    if (!matchesCreatorAdvancedFilters(p, creatorFilters)) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = [
        p.username,
        p.role,
        p.bio,
        ...p.skills,
        ...p.genres,
        ...p.languages,
        ...(p.platforms ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const Sidebar = (
    <aside className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[color:var(--cm-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-[color:var(--cm-accent)]" />
          <h2 className="font-display text-base font-semibold">Filters</h2>
        </div>
        <button
          onClick={resetAll}
          className="text-xs font-semibold text-[color:var(--cm-text-3)] hover:text-[color:var(--cm-accent)]"
        >
          Reset
        </button>
      </div>

      <div className="cm-scroll flex-1 overflow-y-auto px-5 pb-4">
        <FilterGroup title="Language" count={languages.length || undefined}>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value=""
              onChange={(e) => {
                const label = e.target.value;
                if (label && !languages.includes(label)) setLanguages([...languages, label]);
              }}
              aria-label="Ajouter une langue au filtre"
              className="h-9 w-full rounded-[10px] border px-3 text-[13px] font-semibold"
              style={{
                background: "var(--cm-input)",
                borderColor: "var(--cm-border)",
                color: "var(--cm-text)",
              }}
            >
              <option value="">Ajouter une langue…</option>
              {SITE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.label}>
                  {l.label}
                </option>
              ))}
            </select>
            {languages.map((label) => (
              <Chip key={label} active onClick={() => setLanguages(toggle(languages, label))}>
                {label} ✕
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Status" count={statuses.length || undefined}>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Chip
                key={s}
                active={statuses.includes(s)}
                onClick={() => setStatuses(toggle(statuses, s))}
              >
                {localizeLabel(s, locale)}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Notes">
          <div className="grid grid-cols-1 gap-3">
            <RatingSelect label="Minimum rating" value={minRating} onChange={setMinRating} />
            <RatingSelect label="Maximum rating" value={maxRating} onChange={setMaxRating} />
          </div>
        </FilterGroup>

        <FilterGroup title="Genre" count={genres.length || undefined}>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((g) => (
              <Chip
                key={g}
                active={genres.includes(g)}
                onClick={() => setGenres(toggle(genres, g))}
              >
                {localizeLabel(g, locale)}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Subgenre" count={subgenres.length || undefined} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {SUBGENRES.map((s) => (
              <Chip
                key={s}
                active={subgenres.includes(s)}
                onClick={() => setSubgenres(toggle(subgenres, s))}
                size="xs"
              >
                {localizeLabel(s, locale)}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--cm-border)] p-4">
        <button
          onClick={resetAll}
          className="h-11 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-xs font-semibold text-[color:var(--cm-text-2)] transition hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)]"
        >
          Reset filters
        </button>
        <button
          onClick={() => setMobileFilterOpen(false)}
          className="h-11 rounded-xl bg-[color:var(--cm-accent)] text-xs font-bold text-[#04180d] transition hover:bg-[color:var(--cm-accent-hover)]"
        >
          Apply filters
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[color:var(--cm-bg)]">
      <div className="mx-auto max-w-[1500px] px-4 pb-6 pt-7 sm:px-6">
        <header className="mb-7 max-w-3xl">
          <h1 className="font-display text-2xl font-bold text-[color:var(--cm-text)] sm:text-3xl">
            Find Users
          </h1>
          <p className="mt-1 text-sm text-[color:var(--cm-text-2)]">
            Search artists, writers, content creators, readers, and collaborators for manga
            projects.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Desktop sidebar */}
          <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--cm-section)] lg:block lg:sticky lg:top-[76px] lg:h-[calc(100vh-96px)]">
            {Sidebar}
          </div>

          {/* Results */}
          <main className="min-w-0">
            {/* Search + view */}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--cm-text-3)]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by username, role, skill, genre, or language…"
                  className="h-12 w-full rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] pl-11 pr-4 text-sm text-[color:var(--cm-text)] placeholder:text-[color:var(--cm-text-3)] focus:border-[color:var(--cm-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cm-accent-soft)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreatorFilterOpen(true)}
                  className="flex h-12 items-center gap-2 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] px-4 text-sm font-semibold text-[color:var(--cm-text)] transition hover:border-[color:var(--cm-border-hover)]"
                >
                  <SlidersHorizontal size={16} />
                  Créateurs
                  {creatorFilterCount(creatorFilters) ? (
                    <span className="ml-1 rounded-full bg-[color:var(--cm-accent)] px-1.5 text-[10px] font-bold text-[#04180d]">
                      {creatorFilterCount(creatorFilters)}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="flex h-12 items-center gap-2 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] px-4 text-sm font-semibold text-[color:var(--cm-text)] lg:hidden"
                >
                  <SlidersHorizontal size={16} /> Filters
                  {activeFilters.length ? (
                    <span className="ml-1 rounded-full bg-[color:var(--cm-accent)] px-1.5 text-[10px] font-bold text-[#04180d]">
                      {activeFilters.length}
                    </span>
                  ) : null}
                </button>
                <div className="flex h-12 items-center rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] p-1">
                  <button
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                    aria-pressed={view === "grid"}
                    className={classNames(
                      "grid h-10 w-10 place-items-center rounded-lg transition",
                      view === "grid"
                        ? "bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]"
                        : "text-[color:var(--cm-text-3)] hover:text-[color:var(--cm-text)]",
                    )}
                  >
                    <Grid3x3 size={16} />
                  </button>
                  <button
                    onClick={() => setView("list")}
                    aria-label="List view"
                    aria-pressed={view === "list"}
                    className={classNames(
                      "grid h-10 w-10 place-items-center rounded-lg transition",
                      view === "list"
                        ? "bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]"
                        : "text-[color:var(--cm-text-3)] hover:text-[color:var(--cm-text)]",
                    )}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[color:var(--cm-text-3)]">Active:</span>
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={f.onRemove}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cm-accent)] bg-[color:var(--cm-accent-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--cm-accent)]"
                  >
                    {f.label}
                    <X size={12} className="opacity-70 group-hover:opacity-100" />
                  </button>
                ))}
                <button
                  onClick={resetAll}
                  className="ml-1 text-[11px] font-semibold text-[color:var(--cm-text-3)] hover:text-[color:var(--cm-text)]"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Result meta */}
            <div className="mt-5 flex items-center justify-between text-xs text-[color:var(--cm-text-3)]">
              <span>
                <span className="font-semibold text-[color:var(--cm-text)]">{results.length}</span>{" "}
                profiles matching your search
              </span>
            </div>

            {/* Results */}
            {results.length === 0 ? (
              <EmptyState onReset={resetAll} />
            ) : view === "grid" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p) => (
                  <UserCard
                    key={p.id}
                    profile={p}
                    onSponsorshipOptions={setSponsorshipProfile}
                    onAddFriend={setFriendTarget}
                    onContact={(profile) => void contactProfile(profile)}
                    contacting={contactingId === p.id}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {results.map((p) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    onSponsorshipOptions={setSponsorshipProfile}
                    onAddFriend={setFriendTarget}
                    onContact={(profile) => void contactProfile(profile)}
                    contacting={contactingId === p.id}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-full max-w-[360px] flex-col border-r border-[color:var(--cm-border)] bg-[color:var(--cm-section)]">
            <div className="flex items-center justify-between border-b border-[color:var(--cm-border)] px-4 py-3">
              <span className="font-display font-semibold">Filters</span>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)]"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{Sidebar}</div>
          </div>
        </div>
      )}

      <CreatorAdvancedFiltersModal
        open={creatorFilterOpen}
        filters={creatorFilters}
        setFilters={setCreatorFilters}
        onClose={() => setCreatorFilterOpen(false)}
        onReset={() => setCreatorFilters(EMPTY_CREATOR_FILTERS)}
      />

      {friendTarget && (
        <FriendRequestModal profile={friendTarget} onClose={() => setFriendTarget(null)} />
      )}
      {sponsorshipProfile && (
        <CreatorSponsorshipOptionsModal
          profile={sponsorshipProfile}
          onClose={() => setSponsorshipProfile(null)}
          onContact={(profile) => void contactProfile(profile)}
          contacting={contactingId === sponsorshipProfile.id}
        />
      )}
      {contactError && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-[70] max-w-[420px] rounded-[16px] border border-red-400/40 bg-[color:var(--cm-section)] px-4 py-3 text-[13px] font-semibold text-red-300 shadow-2xl"
        >
          {contactError}
        </div>
      )}
    </div>
  );
}

/* ---------------- cards ---------------- */

function Avatar({
  initials,
  avatarUrl,
  size = 48,
}: {
  initials: string;
  avatarUrl?: string;
  size?: number;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl border border-[color:var(--cm-border)] bg-gradient-to-br from-[color:var(--cm-panel)] to-[color:var(--cm-card)] font-display font-bold text-[color:var(--cm-accent)]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-[inherit] object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function AvailabilityBadge({ value }: { value: string }) {
  // Disponibilité binaire : Available / Unavailable, rien d'autre.
  const positive = !/busy|not available|unavailable/i.test(value);
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
        positive
          ? "border-[color:var(--cm-accent)]/40 bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]"
          : "border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-3)]",
      )}
    >
      <span
        className={classNames(
          "h-1.5 w-1.5 rounded-full",
          positive ? "bg-[color:var(--cm-accent)]" : "bg-[color:var(--cm-text-3)]",
        )}
      />
      {positive ? "Available" : "Unavailable"}
    </span>
  );
}

/* Drapeaux SVG (les emojis drapeaux ne s'affichent pas sous Windows). */
function LangFlag({ lang }: { lang: string }) {
  const flags: Record<string, React.ReactNode> = {
    Français: (
      <>
        <rect width="6" height="12" fill="#0055A4" />
        <rect x="6" width="6" height="12" fill="#fff" />
        <rect x="12" width="6" height="12" fill="#EF4135" />
      </>
    ),
    English: (
      <>
        <rect width="18" height="12" fill="#012169" />
        <path d="M0 0 L18 12 M18 0 L0 12" stroke="#fff" strokeWidth="2.6" />
        <path d="M0 0 L18 12 M18 0 L0 12" stroke="#C8102E" strokeWidth="1.1" />
        <path d="M9 0 V12 M0 6 H18" stroke="#fff" strokeWidth="4" />
        <path d="M9 0 V12 M0 6 H18" stroke="#C8102E" strokeWidth="2.2" />
      </>
    ),
    Español: (
      <>
        <rect width="18" height="12" fill="#AA151B" />
        <rect y="3" width="18" height="6" fill="#F1BF00" />
      </>
    ),
    Italiano: (
      <>
        <rect width="6" height="12" fill="#009246" />
        <rect x="6" width="6" height="12" fill="#fff" />
        <rect x="12" width="6" height="12" fill="#CE2B37" />
      </>
    ),
    日本語: (
      <>
        <rect width="18" height="12" fill="#fff" />
        <circle cx="9" cy="6" r="3.4" fill="#BC002D" />
      </>
    ),
    Deutsch: (
      <>
        <rect width="18" height="4" fill="#000" />
        <rect y="4" width="18" height="4" fill="#DD0000" />
        <rect y="8" width="18" height="4" fill="#FFCE00" />
      </>
    ),
    Nederlands: (
      <>
        <rect width="18" height="4" fill="#AE1C28" />
        <rect y="4" width="18" height="4" fill="#fff" />
        <rect y="8" width="18" height="4" fill="#21468B" />
      </>
    ),
  };
  const shape = flags[lang];
  if (!shape)
    return <span className="text-[10px] font-bold text-[color:var(--cm-text-2)]">{lang}</span>;
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      role="img"
      aria-label={lang}
      className="rounded-[2px] border border-[color:var(--cm-border)]"
    >
      <title>{lang}</title>
      {shape}
    </svg>
  );
}

function UserCard({
  profile,
  onSponsorshipOptions,
  onAddFriend,
  onContact,
  contacting,
}: {
  profile: Profile;
  onSponsorshipOptions: (profile: Profile) => void;
  onAddFriend: (profile: Profile) => void;
  onContact: (profile: Profile) => void;
  contacting: boolean;
}) {
  const { locale } = useI18n();
  const isCreator = profile.role === "Content creator";
  const optionCount = profile.sponsorshipOptions?.length ?? 0;
  const mainGenres = profile.genres.filter((g) => GENRES.includes(g));
  const subGenres = profile.genres.filter((g) => !GENRES.includes(g)).slice(0, 3);
  return (
    <article className="group flex h-full flex-col rounded-[18px] border border-[color:var(--cm-border)] bg-[color:var(--cm-card)] p-[18px] transition hover:border-[color:var(--cm-border-hover)]">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <Avatar initials={profile.initials} avatarUrl={profile.avatarUrl} />
        <div className="min-w-0">
          <h3 className="truncate font-display text-[15px] font-semibold text-[color:var(--cm-text)]">
            {profile.username}
          </h3>
          <div className="mt-0.5 text-[11px] font-semibold text-[color:var(--cm-text-2)]">
            {localizeLabel(profile.role, locale)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1">
              <Stars value={profile.rating} />
              <span className="text-[11px] font-semibold text-[color:var(--cm-text-2)]">
                {profile.rating.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-1" aria-label="Languages">
              {profile.languages.map((l) => (
                <LangFlag key={l} lang={l} />
              ))}
            </div>
          </div>
        </div>
        <AvailabilityBadge value={profile.availability} />
      </header>

      <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-[color:var(--cm-text-2)]">
        {profile.bio}
      </p>

      {/* genres favoris (accent) + sous-genres favoris (neutres) */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {mainGenres.map((g) => (
          <span
            key={g}
            className="rounded-md border border-[color:var(--cm-accent)]/40 bg-[color:var(--cm-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--cm-accent)]"
          >
            {localizeLabel(g, locale)}
          </span>
        ))}
        {subGenres.map((g) => (
          <span
            key={g}
            className="rounded-md border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--cm-text-2)]"
          >
            {localizeLabel(g, locale)}
          </span>
        ))}
      </div>

      {isCreator ? (
        <button
          type="button"
          onClick={() => onSponsorshipOptions(profile)}
          className="mt-3 w-full rounded-[16px] border border-[color:var(--cm-border)] bg-[color:var(--cm-panel)] p-3 text-left transition hover:border-[color:var(--cm-accent)] hover:bg-[color:var(--cm-accent-soft)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--cm-input)] text-[color:var(--cm-accent)]">
                <Handshake size={16} />
              </span>
              <div>
                <div className="text-[13px] font-bold text-[color:var(--cm-text)]">
                  Options de parrainage
                </div>
                <div className="mt-0.5 text-[11px] text-[color:var(--cm-text-3)]">
                  {optionCount
                    ? `${optionCount} option${optionCount > 1 ? "s" : ""}${profile.audience ? ` · ${profile.audience}` : ""}`
                    : "Aucune option publiée"}
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-[color:var(--cm-text-3)]" />
          </div>
          {profile.platforms?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.platforms.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-[color:var(--cm-input)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--cm-text-2)]"
                >
                  <PlatformIcon name={p} />
                  {p}
                </span>
              ))}
            </div>
          ) : null}
        </button>
      ) : null}

      <div className="mt-auto flex items-center border-t border-[color:var(--cm-border)] pt-3 text-[11px] text-[color:var(--cm-text-3)]">
        <span className="inline-flex items-center gap-1">
          <FolderKanban size={11} /> {profile.projects} projets créés
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <Link
          to="/profile/$profileId"
          params={{ profileId: profile.id }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--cm-accent)] px-3 text-xs font-bold text-[#04180d] transition hover:bg-[color:var(--cm-accent-hover)]"
        >
          View profile <ChevronRight size={14} />
        </Link>
        <button
          type="button"
          onClick={() => onContact(profile)}
          disabled={contacting}
          aria-label="Contacter"
          title="Contacter"
          className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] transition hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)] disabled:cursor-wait disabled:opacity-50"
        >
          <MessageSquare size={14} />
        </button>
        <button
          aria-label="Ajouter en ami"
          title="Ajouter en ami"
          onClick={() => onAddFriend(profile)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] transition hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)]"
        >
          <UserPlus size={14} />
        </button>
      </div>
    </article>
  );
}

function UserRow({
  profile,
  onSponsorshipOptions,
  onAddFriend,
  onContact,
  contacting,
}: {
  profile: Profile;
  onSponsorshipOptions: (profile: Profile) => void;
  onAddFriend: (profile: Profile) => void;
  onContact: (profile: Profile) => void;
  contacting: boolean;
}) {
  const { locale } = useI18n();
  const isCreator = profile.role === "Content creator";
  const optionCount = profile.sponsorshipOptions?.length ?? 0;
  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--cm-card)] p-4 transition hover:border-[color:var(--cm-border-hover)]">
      <Avatar initials={profile.initials} avatarUrl={profile.avatarUrl} size={56} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate font-display text-[15px] font-semibold">{profile.username}</h3>
          <span className="text-[11px] text-[color:var(--cm-text-3)]">·</span>
          <span className="text-[11px] font-semibold text-[color:var(--cm-text-2)]">
            {localizeLabel(profile.role, locale)}
          </span>
          <div className="flex items-center gap-1 pl-1">
            <Stars value={profile.rating} size={12} />
            <span className="text-[11px] text-[color:var(--cm-text-2)]">
              {profile.rating.toFixed(1)}
            </span>
          </div>
          <span className="flex items-center gap-1">
            {profile.languages.map((l) => (
              <LangFlag key={l} lang={l} />
            ))}
          </span>
          <AvailabilityBadge value={profile.availability} />
        </div>
        <p className="mt-1 truncate text-[12px] text-[color:var(--cm-text-2)]">{profile.bio}</p>
        {isCreator ? (
          <button
            type="button"
            onClick={() => onSponsorshipOptions(profile)}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-panel)] px-3 py-2 text-[11px] font-bold text-[color:var(--cm-text)] transition hover:border-[color:var(--cm-accent)] hover:text-[color:var(--cm-accent)]"
          >
            <Handshake size={13} />
            Options de parrainage
            <span className="rounded-full bg-[color:var(--cm-accent-soft)] px-2 py-0.5 text-[10px] text-[color:var(--cm-accent)]">
              {optionCount}
            </span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onContact(profile)}
          disabled={contacting}
          aria-label="Contacter"
          title="Contacter"
          className="hidden h-9 w-9 place-items-center rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)] disabled:cursor-wait disabled:opacity-50 md:grid"
        >
          <MessageSquare size={14} />
        </button>
        <button
          aria-label="Ajouter en ami"
          title="Ajouter en ami"
          onClick={() => onAddFriend(profile)}
          className="hidden h-9 w-9 place-items-center rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:border-[color:var(--cm-border-hover)] hover:text-[color:var(--cm-text)] md:grid"
        >
          <UserPlus size={14} />
        </button>
        <Link
          to="/profile/$profileId"
          params={{ profileId: profile.id }}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-[color:var(--cm-accent)] px-3 text-xs font-bold text-[#04180d] hover:bg-[color:var(--cm-accent-hover)]"
        >
          View <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  );
}

function CreatorAdvancedFiltersModal({
  open,
  filters,
  setFilters,
  onClose,
  onReset,
}: {
  open: boolean;
  filters: CreatorAdvancedFilters;
  setFilters: React.Dispatch<React.SetStateAction<CreatorAdvancedFilters>>;
  onClose: () => void;
  onReset: () => void;
}) {
  if (!open) return null;

  const toggleFilter = (
    key: "platforms" | "videoTypes" | "durations" | "paymentModes",
    value: string,
  ) =>
    setFilters((current) => ({
      ...current,
      [key]: toggle(current[key], value),
    }));

  const setValue = (key: "minSubs" | "maxSubs", value: string) =>
    setFilters((current) => ({ ...current, [key]: value.replace(/[^\d]/g, "") }));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative max-h-[86vh] w-full max-w-[860px] overflow-hidden rounded-[24px] border border-[color:var(--cm-border)] bg-[color:var(--cm-section)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--cm-border)] px-6 py-5">
          <div>
            <h2 className="font-display text-[24px] font-bold text-[color:var(--cm-text)]">
              Filtres créateurs avancés
            </h2>
            <p className="mt-1 text-[13px] text-[color:var(--cm-text-2)]">
              Affine la recherche de créateurs de contenu selon leurs plateformes, formats et
              options de parrainage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:text-[color:var(--cm-text)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="max-h-[calc(86vh-150px)] overflow-y-auto px-6 py-6">
          <div className="space-y-7">
            <CreatorFilterSection title="Créateur de contenu">
              <label className="flex items-center justify-between gap-4 rounded-[16px] border border-[color:var(--cm-border)] bg-[color:var(--cm-panel)] px-4 py-3">
                <span>
                  <span className="block text-[13px] font-bold text-[color:var(--cm-text)]">
                    Afficher seulement les profils avec options
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[color:var(--cm-text-3)]">
                    Utile pour trouver directement un créateur sponsorisable.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={filters.sponsorshipOnly}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      sponsorshipOnly: !current.sponsorshipOnly,
                    }))
                  }
                  className="relative h-7 w-12 shrink-0 rounded-full border transition"
                  style={{
                    background: filters.sponsorshipOnly
                      ? "var(--cm-accent-soft)"
                      : "var(--cm-input)",
                    borderColor: filters.sponsorshipOnly ? "var(--cm-accent)" : "var(--cm-border)",
                  }}
                >
                  <span
                    className="absolute top-[3px] h-5 w-5 rounded-full transition-all"
                    style={{
                      left: filters.sponsorshipOnly ? 24 : 3,
                      background: filters.sponsorshipOnly ? "var(--cm-accent)" : "var(--cm-text-3)",
                    }}
                  />
                </button>
              </label>
              <CreatorChipRow
                label="Plateforme"
                options={PLATFORMS}
                selected={filters.platforms}
                onToggle={(value) => toggleFilter("platforms", value)}
              />
            </CreatorFilterSection>

            <CreatorFilterSection title="Parrainage">
              <CreatorChipRow
                label="Type de vidéo"
                options={CREATOR_VIDEO_TYPES}
                selected={filters.videoTypes}
                onToggle={(value) => toggleFilter("videoTypes", value)}
              />
              <CreatorChipRow
                label="Durée de vidéo"
                options={CREATOR_DURATIONS}
                selected={filters.durations}
                onToggle={(value) => toggleFilter("durations", value)}
              />
              <CreatorChipRow
                label="Mode de paiement"
                options={CREATOR_PAYMENT_MODES}
                selected={filters.paymentModes}
                onToggle={(value) => toggleFilter("paymentModes", value)}
              />
            </CreatorFilterSection>

            <CreatorFilterSection title="Audience">
              <div className="grid gap-4 sm:grid-cols-2">
                <CreatorNumberField
                  label="Nombre d'abonnés minimum"
                  value={filters.minSubs}
                  onChange={(value) => setValue("minSubs", value)}
                />
                <CreatorNumberField
                  label="Nombre d'abonnés maximal"
                  value={filters.maxSubs}
                  onChange={(value) => setValue("maxSubs", value)}
                />
              </div>
            </CreatorFilterSection>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--cm-border)] bg-[color:var(--cm-panel)] px-6 py-4">
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] px-4 text-[13px] font-bold text-[color:var(--cm-text-2)] hover:text-[color:var(--cm-text)]"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl bg-[color:var(--cm-accent)] px-5 text-[13px] font-bold text-[#04180d] hover:bg-[color:var(--cm-accent-hover)]"
          >
            Appliquer
          </button>
        </footer>
      </div>
    </div>
  );
}

function CreatorFilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="font-display text-[18px] font-bold text-[color:var(--cm-text)]">{title}</h3>
      {children}
    </section>
  );
}

function CreatorChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-bold text-[color:var(--cm-text)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={classNames(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
              selected.includes(option)
                ? "border border-[color:var(--cm-accent)] bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]"
                : "border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:border-[color:var(--cm-border-hover)]",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreatorNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[color:var(--cm-text)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        placeholder="0"
        className="h-11 w-full rounded-[14px] border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] px-3 text-[14px] text-[color:var(--cm-text)] outline-none transition focus:border-[color:var(--cm-accent)] focus:ring-2 focus:ring-[color:var(--cm-accent-soft)]"
      />
    </label>
  );
}

function FriendRequestModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await sendFriendRequestDb(profile.id);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Demande d'ami"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl border border-[color:var(--cm-border)] bg-[color:var(--cm-section)] p-6 shadow-2xl"
      >
        {sent ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]">
              <UserPlus size={20} />
            </div>
            <h3 className="mt-4 text-center font-display text-[17px] font-bold text-[color:var(--cm-text)]">
              Demande envoyée !
            </h3>
            <p className="mt-1.5 text-center text-[13px] text-[color:var(--cm-text-2)]">
              {profile.username} recevra une notification et pourra accepter ta demande.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-11 w-full rounded-lg bg-[color:var(--cm-accent)] text-[13px] font-bold text-[#04180d] transition hover:bg-[color:var(--cm-accent-hover)]"
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar initials={profile.initials} avatarUrl={profile.avatarUrl} size={44} />
              <div className="min-w-0">
                <h3 className="truncate font-display text-[16px] font-bold text-[color:var(--cm-text)]">
                  Ajouter en ami ?
                </h3>
                <p className="truncate text-[12px] text-[color:var(--cm-text-3)]">
                  {profile.username} · {profile.role}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--cm-text-2)]">
              Envoyer une demande d'ami à{" "}
              <span className="font-bold text-[color:var(--cm-text)]">{profile.username}</span> ? Il
              pourra l'accepter ou la refuser depuis ses notifications.
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-[12px] font-semibold text-red-300">
                {error}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-lg border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[13px] font-bold text-[color:var(--cm-text-2)] transition hover:text-[color:var(--cm-text)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={sending}
                className="h-11 rounded-lg bg-[color:var(--cm-accent)] text-[13px] font-bold text-[#04180d] transition hover:bg-[color:var(--cm-accent-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                {sending ? "Envoi…" : "Envoyer la demande"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreatorSponsorshipOptionsModal({
  profile,
  onClose,
  onContact,
  contacting,
}: {
  profile: Profile;
  onClose: () => void;
  onContact: (profile: Profile) => void;
  contacting: boolean;
}) {
  const options = profile.sponsorshipOptions ?? [];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative max-h-[86vh] w-full max-w-[900px] overflow-hidden rounded-[24px] border border-[color:var(--cm-border)] bg-[color:var(--cm-section)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--cm-border)] px-6 py-5">
          <div className="flex items-start gap-3">
            <Avatar initials={profile.initials} avatarUrl={profile.avatarUrl} size={48} />
            <div>
              <h2 className="font-display text-[24px] font-bold text-[color:var(--cm-text)]">
                Options de parrainage
              </h2>
              <p className="mt-1 text-[13px] text-[color:var(--cm-text-2)]">
                {[profile.username, profile.audience, profile.platforms?.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:var(--cm-border)] bg-[color:var(--cm-input)] text-[color:var(--cm-text-2)] hover:text-[color:var(--cm-text)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="max-h-[calc(86vh-100px)] overflow-y-auto px-6 py-6">
          {options.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {options.map((option) => (
                <article
                  key={option.id}
                  className="rounded-[18px] border border-[color:var(--cm-border)] bg-[color:var(--cm-card)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--cm-accent)]">
                        {option.type}
                      </p>
                      <h3 className="mt-1 font-display text-[18px] font-bold text-[color:var(--cm-text)]">
                        {option.title}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[color:var(--cm-accent-soft)] px-3 py-1 text-[12px] font-extrabold text-[color:var(--cm-accent)]">
                      {option.price}
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] leading-[21px] text-[color:var(--cm-text-2)]">
                    {option.description}
                  </p>
                  <div className="mt-4 grid gap-2 text-[12px] text-[color:var(--cm-text-2)]">
                    <div className="flex justify-between gap-3">
                      <span>Format</span>
                      <strong className="text-[color:var(--cm-text)]">{option.videoType}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Durée</span>
                      <strong className="text-[color:var(--cm-text)]">{option.duration}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Paiement</span>
                      <strong className="text-[color:var(--cm-text)]">{option.paymentMode}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onContact(profile)}
                    disabled={contacting}
                    className="mt-5 h-10 w-full rounded-xl bg-[color:var(--cm-accent)] text-[13px] font-bold text-[#04180d] hover:bg-[color:var(--cm-accent-hover)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {contacting ? "Ouverture…" : "Sélectionner cette option"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[color:var(--cm-border)] bg-[color:var(--cm-panel)] p-8 text-center">
              <Handshake className="mx-auto h-8 w-8 text-[color:var(--cm-accent)]" />
              <h3 className="mt-3 font-display text-[18px] font-bold text-[color:var(--cm-text)]">
                Aucune option publiée
              </h3>
              <p className="mt-1 text-[13px] text-[color:var(--cm-text-2)]">
                Ce créateur n'a pas encore configuré ses offres de parrainage.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-[color:var(--cm-border)] bg-[color:var(--cm-section)] p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--cm-accent-soft)] text-[color:var(--cm-accent)]">
        <Search size={22} />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">No users found</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[color:var(--cm-text-2)]">
        Try removing some filters or searching with different keywords.
      </p>
      <button
        onClick={onReset}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--cm-accent)] px-5 text-sm font-bold text-[#04180d] transition hover:bg-[color:var(--cm-accent-hover)]"
      >
        Reset filters
      </button>
    </div>
  );
}
