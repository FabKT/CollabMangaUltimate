import { useSyncExternalStore } from "react";

export type SponsorshipStatus = "activated" | "pending" | "finished" | "cancelled";
export type PaymentType = "one_time" | "subscription" | "recurring" | "per_content" | "per_quantity";
export type Platform = "TikTok" | "YouTube" | "Instagram" | "Twitter/X" | "Other";

export interface Service {
  id: string;
  name: string;
  format: string;
  duration: string;
  platforms: Platform[];
  quantity: number;
  price: number;
  paymentType: PaymentType;
  deliveryLink?: string;
  notes?: string;
}

export interface Participant {
  id: string;
  name: string;
  role: "creator" | "owner" | "collaborator" | "manager";
  meta?: string;
  initials: string;
}

export interface Sponsorship {
  id: string;
  name: string;
  project: string;
  creator: string;
  totalPrice: number;
  currency: string;
  status: SponsorshipStatus;
  paymentType: PaymentType;
  deadline?: string;
  notes?: string;
  services: Service[];
  participants: Participant[];
  conditions?: string;
  createdAt: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const STORAGE_KEY = "collabmanga.sponsorships.v1";
const VALID_STATUSES: SponsorshipStatus[] = ["activated", "pending", "finished", "cancelled"];
const VALID_PAYMENT_TYPES: PaymentType[] = ["one_time", "subscription", "recurring", "per_content", "per_quantity"];
const VALID_PLATFORMS: Platform[] = ["TikTok", "YouTube", "Instagram", "Twitter/X", "Other"];

let state: Sponsorship[] = [
  {
    id: "sp-001",
    name: "Arc VII Launch — Neon Blade",
    project: "Neon Blade",
    creator: "Kaira Yumi",
    totalPrice: 4800,
    currency: "EUR",
    status: "activated",
    paymentType: "one_time",
    deadline: "2026-08-14",
    notes: "Priority campaign for the new arc reveal.",
    conditions: "Deliverables must go live within 10 days of asset handoff. No mention of competing titles.",
    createdAt: "2026-07-01",
    participants: [
      { id: "p1", name: "Kaira Yumi", role: "creator", meta: "218k abonnés · YouTube", initials: "KY" },
      { id: "p2", name: "Studio Ronin", role: "owner", meta: "Publisher · 12 titles", initials: "SR" },
      { id: "p3", name: "Aiko Hara", role: "manager", meta: "Talent management", initials: "AH" },
    ],
    services: [
      { id: uid(), name: "Dedicated long video", format: "Deep analysis", duration: "10+ min", platforms: ["YouTube"], quantity: 1, price: 2200, paymentType: "one_time", deliveryLink: "https://youtu.be/example-1" },
      { id: uid(), name: "Short video", format: "Review", duration: "0–30 s", platforms: ["TikTok", "Instagram"], quantity: 3, price: 1200, paymentType: "per_content" },
      { id: uid(), name: "Story", format: "Sponsored mention", duration: "0–30 s", platforms: ["Instagram"], quantity: 4, price: 400, paymentType: "per_quantity", deliveryLink: "" },
      { id: uid(), name: "Post", format: "Product placement", duration: "0–30 s", platforms: ["Twitter/X"], quantity: 2, price: 1000, paymentType: "one_time" },
    ],
  },
  {
    id: "sp-002",
    name: "Volume 3 Teaser — Silver Fang",
    project: "Silver Fang",
    creator: "Rin Tanaka",
    totalPrice: 2600,
    currency: "EUR",
    status: "pending",
    paymentType: "recurring",
    deadline: "2026-09-02",
    createdAt: "2026-07-05",
    participants: [
      { id: "p1", name: "Rin Tanaka", role: "creator", meta: "94k · TikTok", initials: "RT" },
      { id: "p2", name: "Moonline Press", role: "owner", meta: "Indie publisher", initials: "MP" },
    ],
    services: [
      { id: uid(), name: "Placement in a video", format: "Product placement", duration: "1–3 min", platforms: ["YouTube"], quantity: 1, price: 1400, paymentType: "one_time" },
      { id: uid(), name: "Stream mention", format: "Sponsored mention", duration: "0–30 s", platforms: ["Other"], quantity: 6, price: 1200, paymentType: "per_content" },
    ],
  },
  {
    id: "sp-003",
    name: "Finale Recap — Hollow Sun",
    project: "Hollow Sun",
    creator: "Miko Sato",
    totalPrice: 1500,
    currency: "EUR",
    status: "finished",
    paymentType: "one_time",
    deadline: "2026-05-30",
    createdAt: "2026-04-12",
    participants: [
      { id: "p1", name: "Miko Sato", role: "creator", meta: "62k · YouTube", initials: "MS" },
      { id: "p2", name: "Studio Ronin", role: "owner", initials: "SR" },
    ],
    services: [
      { id: uid(), name: "Reaction", format: "Reaction", duration: "1–3 min", platforms: ["YouTube"], quantity: 1, price: 900, paymentType: "one_time", deliveryLink: "https://youtu.be/example-2" },
      { id: uid(), name: "Post", format: "Sponsored mention", duration: "0–30 s", platforms: ["Twitter/X"], quantity: 2, price: 600, paymentType: "per_content", deliveryLink: "https://x.com/example" },
    ],
  },
  {
    id: "sp-004",
    name: "Cancelled — Crimson Vow",
    project: "Crimson Vow",
    creator: "Yuu Kaneko",
    totalPrice: 900,
    currency: "EUR",
    status: "cancelled",
    paymentType: "one_time",
    createdAt: "2026-06-20",
    participants: [
      { id: "p1", name: "Yuu Kaneko", role: "creator", initials: "YK" },
    ],
    services: [],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePaymentType(value: unknown): PaymentType {
  return VALID_PAYMENT_TYPES.includes(value as PaymentType) ? (value as PaymentType) : "one_time";
}

function normalizeStatus(value: unknown): SponsorshipStatus {
  return VALID_STATUSES.includes(value as SponsorshipStatus) ? (value as SponsorshipStatus) : "pending";
}

function normalizePlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return [];
  return value.filter((platform): platform is Platform => VALID_PLATFORMS.includes(platform as Platform));
}

function normalizeService(value: unknown, index: number): Service {
  const item = isRecord(value) ? value : {};
  return {
    id: asString(item.id, `sv-${index}-${uid()}`),
    name: asString(item.name, "Service"),
    format: asString(item.format, "Sponsored mention"),
    duration: asString(item.duration, "0-30 s"),
    platforms: normalizePlatforms(item.platforms),
    quantity: Math.max(1, asNumber(item.quantity, 1)),
    price: Math.max(0, asNumber(item.price, 0)),
    paymentType: normalizePaymentType(item.paymentType),
    deliveryLink: asOptionalString(item.deliveryLink),
    notes: asOptionalString(item.notes),
  };
}

function normalizeParticipant(value: unknown, index: number): Participant {
  const item = isRecord(value) ? value : {};
  const name = asString(item.name, "Participant");
  const rawRole = asString(item.role);
  const role: Participant["role"] =
    rawRole === "creator" || rawRole === "owner" || rawRole === "collaborator" || rawRole === "manager"
      ? rawRole
      : "collaborator";
  return {
    id: asString(item.id, `participant-${index}-${uid()}`),
    name,
    role,
    meta: asOptionalString(item.meta),
    initials: asString(
      item.initials,
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "P",
    ),
  };
}

function normalizeSponsorships(value: unknown): Sponsorship[] {
  if (!Array.isArray(value)) return state;
  return value.map((item, index) => {
    const s = isRecord(item) ? item : {};
    return {
      id: asString(s.id, `sp-${index}-${uid()}`),
      name: asString(s.name, "Sponsorship"),
      project: asString(s.project, "Project"),
      creator: asString(s.creator, "Creator"),
      totalPrice: Math.max(0, asNumber(s.totalPrice, 0)),
      currency: asString(s.currency, "EUR"),
      status: normalizeStatus(s.status),
      paymentType: normalizePaymentType(s.paymentType),
      deadline: asOptionalString(s.deadline),
      notes: asOptionalString(s.notes),
      services: Array.isArray(s.services)
        ? s.services.map((service, serviceIndex) => normalizeService(service, serviceIndex))
        : [],
      participants: Array.isArray(s.participants)
        ? s.participants.map((participant, participantIndex) =>
            normalizeParticipant(participant, participantIndex),
          )
        : [],
      conditions: asOptionalString(s.conditions),
      createdAt: asString(s.createdAt, new Date().toISOString().slice(0, 10)),
    };
  });
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadStoredState() {
  if (!canUseStorage()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state = normalizeSponsorships(parsed);
  } catch {
    // Keep the built-in demo data if local storage contains invalid data.
  }
}

function persistState() {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

loadStoredState();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => {
  persistState();
  listeners.forEach((l) => l());
};

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSnapshot(): Sponsorship[] {
  return state;
}

export function useSponsorships(): Sponsorship[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSponsorship(id: string): Sponsorship | undefined {
  return useSponsorships().find((s) => s.id === id);
}

export function createSponsorship(input: Omit<Sponsorship, "id" | "createdAt" | "services" | "participants"> & { services?: Service[]; participants?: Participant[] }) {
  const s: Sponsorship = {
    ...input,
    id: "sp-" + uid(),
    createdAt: new Date().toISOString().slice(0, 10),
    services: input.services ?? [],
    participants: input.participants ?? [],
  };
  state = [s, ...state];
  notify();
  return s;
}

export function updateSponsorship(id: string, patch: Partial<Sponsorship>) {
  state = state.map((s) => (s.id === id ? { ...s, ...patch } : s));
  notify();
}

export function deleteSponsorship(id: string) {
  state = state.filter((s) => s.id !== id);
  notify();
}

export function upsertService(sponsorshipId: string, service: Service) {
  state = state.map((s) => {
    if (s.id !== sponsorshipId) return s;
    const exists = s.services.some((x) => x.id === service.id);
    return {
      ...s,
      services: exists ? s.services.map((x) => (x.id === service.id ? service : x)) : [...s.services, service],
    };
  });
  notify();
}

export function removeService(sponsorshipId: string, serviceId: string) {
  state = state.map((s) => (s.id === sponsorshipId ? { ...s, services: s.services.filter((x) => x.id !== serviceId) } : s));
  notify();
}

export const newServiceId = () => "sv-" + uid();

export const STATUS_META: Record<SponsorshipStatus, { label: string; color: string; bg: string; ring: string }> = {
  activated: { label: "Activated", color: "#39FF88", bg: "rgba(57,255,136,0.12)", ring: "rgba(57,255,136,0.35)" },
  pending:   { label: "Pending",   color: "#FFB84D", bg: "rgba(255,184,77,0.12)", ring: "rgba(255,184,77,0.35)" },
  finished:  { label: "Finished",  color: "#75A7FF", bg: "rgba(117,167,255,0.14)", ring: "rgba(117,167,255,0.35)" },
  cancelled: { label: "Cancelled", color: "#FF5F7E", bg: "rgba(255,95,126,0.12)", ring: "rgba(255,95,126,0.35)" },
};

export const PAYMENT_LABEL: Record<PaymentType, string> = {
  one_time: "One-time",
  subscription: "Subscription",
  recurring: "Recurring",
  per_content: "Per content",
  per_quantity: "Per quantity",
};

export const PLATFORMS: Platform[] = VALID_PLATFORMS;

export function formatMoney(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
