import type { Announcement, Platform, SponsorshipType } from "@/lib/sponsorship-data";
import type { SponsorOption } from "@/lib/sponsorship-options";

/** Annonce de parrainage Studio (dans un projet) → annonce affichée par DetailDialog. */
export type StudioSponsorshipLike = {
  id: string;
  title: string;
  status: string;
  description: string;
  platform: string;
  videoType: string;
  duration: string;
  subscribers: number;
  subscribersMax?: number;
  quantity: number;
  price: string;
  paymentMode: string;
};

export function announcementFromStudioSponsorship(s: StudioSponsorshipLike, ownerName: string): Announcement {
  return {
    id: s.id,
    mode: "project",
    title: s.title,
    ownerName,
    category: "",
    shortDescription: s.description || s.title,
    fullDescription: s.description || s.title,
    price: s.price ? `€${s.price}` : null,
    priceLabel: "Budget",
    priceMin: Number(s.price) || undefined,
    priceMax: Number(s.price) || undefined,
    platforms: s.platform.split(", ").map((p) => (PLATFORM_ALIAS[p] ?? (p as Platform))).filter(Boolean),
    sponsorshipType: s.title as SponsorshipType,
    videoType: s.videoType && s.videoType !== "—" ? (s.videoType as Announcement["videoType"]) : undefined,
    duration: s.duration && s.duration !== "—" ? (s.duration as Announcement["duration"]) : undefined,
    paymentMode: s.paymentMode,
    subscribers: s.subscribersMax ?? s.subscribers,
    status: "open",
    availability: "Available",
    deadline: "",
    requirements: [],
    deliverables: [],
    targetAudience: "",
    contactInstructions: "",
    linked: "",
    accent: "#39ff88",
    language: "FR",
  };
}

const PLATFORM_ALIAS: Record<string, Platform> = {
  Youtube: "YouTube",
  Tiktok: "TikTok",
  Instagram: "Instagram",
  Twitter: "Twitter / X",
};

/** Option de parrainage (créée par un utilisateur/projet) → annonce affichée
 *  par `AnnouncementCard` / `DetailDialog` (rendu identique à la page Sponsoring). */
export function announcementFromOption(o: SponsorOption): Announcement {
  return {
    id: o.id,
    mode: o.mode,
    title: o.format,
    ownerName: o.ownerName,
    category: "",
    shortDescription: o.description || o.format,
    fullDescription: o.description || o.format,
    price: o.price ? `€${o.price}` : null,
    priceLabel: o.mode === "project" ? "Budget" : "Price",
    priceMin: Number(o.price) || undefined,
    priceMax: Number(o.price) || undefined,
    platforms: o.platforms.map((p) => PLATFORM_ALIAS[p] ?? ("Other" as Platform)),
    sponsorshipType: o.format as SponsorshipType,
    videoType: o.videoType !== "—" ? (o.videoType as Announcement["videoType"]) : undefined,
    duration: o.duration !== "—" ? (o.duration as Announcement["duration"]) : undefined,
    paymentMode: o.paymentMode,
    subscribers: o.subscribersMax ?? o.subscribersMin,
    chapters: o.chaptersMax ?? o.chaptersMin,
    status: "open",
    availability: "Available",
    deadline: "",
    requirements: [],
    deliverables: [],
    targetAudience: "",
    contactInstructions: "",
    linked: "",
    accent: "#39ff88",
    language: o.language ?? "FR",
  };
}
