import { useEffect, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase";

export type SponsorshipStatus = "activated" | "pending" | "finished" | "cancelled";
export type PaymentType = "one_time" | "subscription";
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

const LEGACY_STORAGE_KEY = "collabmanga.sponsorships.v1";
const VALID_STATUSES: SponsorshipStatus[] = ["activated", "pending", "finished", "cancelled"];
const VALID_PAYMENT_TYPES: PaymentType[] = ["one_time", "subscription"];
const VALID_PLATFORMS: Platform[] = ["TikTok", "YouTube", "Instagram", "Twitter/X", "Other"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let state: Sponsorship[] = [];
let loadedFor: string | null = null;
let loading: Promise<Sponsorship[]> | null = null;
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((listener) => listener());

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
  return Array.isArray(value)
    ? value.filter((platform): platform is Platform => VALID_PLATFORMS.includes(platform as Platform))
    : [];
}
function normalizeService(value: unknown, index: number): Service {
  const item = isRecord(value) ? value : {};
  return {
    id: asString(item.id, `sv-${index}-${crypto.randomUUID()}`),
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
  const role: Participant["role"] = ["creator", "owner", "collaborator", "manager"].includes(rawRole)
    ? (rawRole as Participant["role"])
    : "collaborator";
  return {
    id: asString(item.id, `participant-${index}-${crypto.randomUUID()}`),
    name,
    role,
    meta: asOptionalString(item.meta),
    initials: asString(
      item.initials,
      name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "P",
    ),
  };
}
function normalizeSponsorships(value: unknown): Sponsorship[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = isRecord(entry) ? entry : {};
    return {
      id: asString(item.id, `sp-${crypto.randomUUID()}`),
      name: asString(item.name, "Sponsorship"),
      project: asString(item.project, "Project"),
      creator: asString(item.creator, "Creator"),
      totalPrice: Math.max(0, asNumber(item.totalPrice, 0)),
      currency: asString(item.currency, "EUR"),
      status: normalizeStatus(item.status),
      paymentType: normalizePaymentType(item.paymentType),
      deadline: asOptionalString(item.deadline),
      notes: asOptionalString(item.notes),
      services: Array.isArray(item.services)
        ? item.services.map((service, index) => normalizeService(service, index))
        : [],
      participants: Array.isArray(item.participants)
        ? item.participants.map((participant, index) => normalizeParticipant(participant, index))
        : [],
      conditions: asOptionalString(item.conditions),
      createdAt: asString(item.createdAt, new Date().toISOString().slice(0, 10)),
    };
  });
}

async function currentUserId() {
  return (await getSupabase().auth.getSession()).data.session?.user.id ?? null;
}

async function relationIds(sponsorship: Sponsorship) {
  const creator = sponsorship.participants.find(
    (participant) => participant.role === "creator" && UUID_PATTERN.test(participant.id),
  );
  const sb = getSupabase();
  const { data: project } = await sb
    .from("studio_projects")
    .select("id")
    .ilike("title", sponsorship.project)
    .limit(1)
    .maybeSingle();
  return { creatorId: creator?.id ?? null, projectId: project?.id ?? null };
}

async function insertRemote(sponsorship: Sponsorship, ownerId: string) {
  const sb = getSupabase();
  const { creatorId, projectId } = await relationIds(sponsorship);
  const { error } = await sb.from("sponsorships").upsert({
    id: sponsorship.id,
    owner_id: ownerId,
    creator_id: creatorId,
    project_id: projectId,
    data: sponsorship,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function importLegacy(ownerId: string) {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  try {
    const legacy = normalizeSponsorships(JSON.parse(raw));
    for (const sponsorship of legacy) await insertRemote(sponsorship, ownerId);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Invalid browser data is ignored; Supabase remains the source of truth.
  }
}

export async function listSponsorships(force = false): Promise<Sponsorship[]> {
  const uid = await currentUserId();
  if (!uid) {
    state = [];
    loadedFor = null;
    notify();
    return [];
  }
  if (!force && loadedFor === uid) return state;
  if (loading) return loading;
  loading = (async () => {
    await importLegacy(uid);
    const { data, error } = await getSupabase()
      .from("sponsorships")
      .select("data")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    state = normalizeSponsorships((data ?? []).map((row) => row.data));
    loadedFor = uid;
    notify();
    return state;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSnapshot() {
  return state;
}
export function useSponsorships(): Sponsorship[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void listSponsorships().catch(() => undefined);
  }, []);
  return snapshot;
}
export function useSponsorship(id: string): Sponsorship | undefined {
  return useSponsorships().find((sponsorship) => sponsorship.id === id);
}

export async function createSponsorship(
  input: Omit<Sponsorship, "id" | "createdAt" | "services" | "participants"> & {
    services?: Service[];
    participants?: Participant[];
  },
) {
  const sponsorship: Sponsorship = {
    ...input,
    id: `sp-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString().slice(0, 10),
    services: input.services ?? [],
    participants: input.participants ?? [],
  };
  state = [sponsorship, ...state];
  notify();
  try {
    const uid = await currentUserId();
    if (!uid) throw new Error("Connecte-toi pour créer un parrainage.");
    await insertRemote(sponsorship, uid);
  } catch (error) {
    state = state.filter((item) => item.id !== sponsorship.id);
    notify();
    throw error;
  }
  return sponsorship;
}

export function updateSponsorship(id: string, patch: Partial<Sponsorship>) {
  state = state.map((sponsorship) =>
    sponsorship.id === id ? { ...sponsorship, ...patch } : sponsorship,
  );
  notify();
  const sponsorship = state.find((item) => item.id === id);
  if (sponsorship) {
    void getSupabase()
      .from("sponsorships")
      .update({ data: sponsorship, updated_at: new Date().toISOString() })
      .eq("id", id);
  }
}
export function deleteSponsorship(id: string) {
  state = state.filter((sponsorship) => sponsorship.id !== id);
  notify();
  void getSupabase().from("sponsorships").delete().eq("id", id);
}
export function upsertService(sponsorshipId: string, service: Service) {
  const sponsorship = state.find((item) => item.id === sponsorshipId);
  if (!sponsorship) return;
  const exists = sponsorship.services.some((item) => item.id === service.id);
  updateSponsorship(sponsorshipId, {
    services: exists
      ? sponsorship.services.map((item) => (item.id === service.id ? service : item))
      : [...sponsorship.services, service],
  });
}
export function removeService(sponsorshipId: string, serviceId: string) {
  const sponsorship = state.find((item) => item.id === sponsorshipId);
  if (!sponsorship) return;
  updateSponsorship(sponsorshipId, {
    services: sponsorship.services.filter((service) => service.id !== serviceId),
  });
}

export const newServiceId = () => `sv-${crypto.randomUUID()}`;
export const STATUS_META: Record<
  SponsorshipStatus,
  { label: string; color: string; bg: string; ring: string }
> = {
  activated: { label: "Activated", color: "#39FF88", bg: "rgba(57,255,136,0.12)", ring: "rgba(57,255,136,0.35)" },
  pending: { label: "Pending", color: "#FFB84D", bg: "rgba(255,184,77,0.12)", ring: "rgba(255,184,77,0.35)" },
  finished: { label: "Finished", color: "#75A7FF", bg: "rgba(117,167,255,0.14)", ring: "rgba(117,167,255,0.35)" },
  cancelled: { label: "Cancelled", color: "#FF5F7E", bg: "rgba(255,95,126,0.12)", ring: "rgba(255,95,126,0.35)" },
};
export const PAYMENT_LABEL: Record<PaymentType, string> = {
  one_time: "Paiement unique",
  subscription: "Abonnement",
};
export const PLATFORMS: Platform[] = VALID_PLATFORMS;
export function formatMoney(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
