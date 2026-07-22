export type Platform = "YouTube" | "TikTok" | "Instagram" | "Twitter / X" | "Twitch" | "Other";

/** Vocabulaire aligné sur les filtres du site (AdvancedFiltersDialog). */
export type SponsorshipType =
  | "Vidéo courte dédiée"
  | "Vidéo longue dédiée"
  | "Post communautaire"
  | "Placement dans une vidéo"
  | "Story";

export type VideoType = "Analyse profonde" | "Review" | "Reaction" | "Présentation";

export type Duration =
  | "0–30 s"
  | "30–60 s"
  | "60–120 s"
  | "2–3 min"
  | "3–5 min"
  | "5–10 min"
  | "10+ min";

export type AnnouncementMode = "creator" | "project";

export type StatusKind = "open" | "urgent" | "closing";

export interface Announcement {
  id: string;
  mode: AnnouncementMode;
  title: string;
  ownerName: string;
  ownerId?: string;
  projectId?: string;
  ownerAvatarUrl?: string | null;
  ownerBannerUrl?: string | null;
  category: string;
  shortDescription: string;
  fullDescription: string;
  price: string | null;
  priceLabel: "Price" | "Budget";
  /** bornes numériques pour les filtres prix */
  priceMin?: number;
  priceMax?: number;
  platforms: Platform[];
  sponsorshipType: SponsorshipType;
  videoType?: VideoType;
  duration?: Duration;
  paymentMode: string;
  /** créateurs : nombre d'abonnés (filtres min/max) */
  subscribers?: number;
  /** projets : nombre de chapitres (filtres min/max) */
  chapters?: number;
  status: StatusKind;
  availability: string;
  deadline: string;
  requirements: string[];
  deliverables: string[];
  targetAudience: string;
  contactInstructions: string;
  linked: string;
  accent: string;
  /** Langue de l'annonce (code site, ex. FR). */
  language?: string;
}

export const PLATFORMS: Platform[] = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Twitter / X",
  "Twitch",
  "Other",
];

export const SPONSORSHIP_TYPES: SponsorshipType[] = [
  "Vidéo courte dédiée",
  "Vidéo longue dédiée",
  "Post communautaire",
  "Placement dans une vidéo",
  "Story",
];

export const VIDEO_TYPES: VideoType[] = ["Analyse profonde", "Review", "Reaction", "Présentation"];

export const DURATIONS: Duration[] = [
  "0–30 s",
  "30–60 s",
  "60–120 s",
  "2–3 min",
  "3–5 min",
  "5–10 min",
  "10+ min",
];

export const PROJECT_GENRES = [
  "Shonen",
  "Seinen",
  "Shojo",
  "Josei",
];

export const STATUS_LABEL: Record<StatusKind, string> = {
  open: "Open",
  urgent: "Urgent",
  closing: "Closing soon",
};

const durationForType = (t: SponsorshipType): boolean =>
  t === "Vidéo courte dédiée" || t === "Vidéo longue dédiée" || t === "Placement dans une vidéo";

// Production : plus d annonces d exemple ; les annonces réelles viendront de la base.
export const ANNOUNCEMENTS: Announcement[] = [
];

export const showDuration = (a: Announcement): boolean =>
  !!a.duration && durationForType(a.sponsorshipType);
