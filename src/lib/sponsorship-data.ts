export type Platform = "YouTube" | "TikTok" | "Instagram" | "Twitter / X" | "Twitch" | "Other";

export type SponsorshipType =
  | "Short dedicated video"
  | "Long dedicated video"
  | "Community post"
  | "Placement in a video"
  | "Story";

export type VideoType = "Analysis" | "Review" | "Reaction" | "Presentation";

export type Duration =
  | "0–30s"
  | "30–60s"
  | "60–120s"
  | "2–5 min"
  | "5–10 min"
  | "10+ min"
  | "To define";

export type AnnouncementMode = "creator" | "project";

export type StatusKind = "open" | "urgent" | "closing";

export interface Announcement {
  id: string;
  mode: AnnouncementMode;
  title: string;
  ownerName: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  price: string | null;
  priceLabel: "Price" | "Budget";
  platforms: Platform[];
  sponsorshipType: SponsorshipType;
  videoType?: VideoType;
  duration?: Duration;
  paymentMode: string;
  status: StatusKind;
  availability: string;
  deadline: string;
  requirements: string[];
  deliverables: string[];
  targetAudience: string;
  contactInstructions: string;
  linked: string;
  accent: string;
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
  "Short dedicated video",
  "Long dedicated video",
  "Community post",
  "Placement in a video",
  "Story",
];

export const VIDEO_TYPES: VideoType[] = ["Analysis", "Review", "Reaction", "Presentation"];

export const DURATIONS: Duration[] = [
  "0–30s",
  "30–60s",
  "60–120s",
  "2–5 min",
  "5–10 min",
  "10+ min",
  "To define",
];

export const PROJECT_GENRES = [
  "Shonen",
  "Seinen",
  "Shojo",
  "Isekai",
  "Slice of life",
  "Fantasy",
  "Horror",
];

export const STATUS_LABEL: Record<StatusKind, string> = {
  open: "Open",
  urgent: "Urgent",
  closing: "Closing soon",
};

const durationForType = (t: SponsorshipType): boolean =>
  t === "Short dedicated video" || t === "Long dedicated video" || t === "Placement in a video";

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    mode: "creator",
    title: "Dedicated review video for your manga",
    ownerName: "Creator placeholder · @channel",
    category: "Manga reviews",
    shortDescription:
      "Long-form dedicated review covering art, story and pacing for manga and webtoon projects.",
    fullDescription:
      "Placeholder full description. A dedicated long-form review that walks the audience through the premise, art direction and narrative hooks of your project, with honest commentary and a clear call to action.",
    price: "$420",
    priceLabel: "Price",
    platforms: ["YouTube", "Twitter / X"],
    sponsorshipType: "Long dedicated video",
    videoType: "Review",
    duration: "10+ min",
    paymentMode: "Fixed fee",
    status: "open",
    availability: "Available placeholder date",
    deadline: "Deadline placeholder",
    requirements: [
      "Provide project synopsis and key art",
      "Share preview chapters or pages",
      "Approve script before recording",
    ],
    deliverables: ["One long-form YouTube video", "Pinned comment with your links", "Community post teaser"],
    targetAudience: "Manga and anime enthusiasts, audience placeholder size",
    contactInstructions: "Use the Contact button to send your project brief and preferred timeline.",
    linked: "Linked creator profile placeholder",
    accent: "#39ff88",
  },
  {
    id: "a2",
    mode: "creator",
    title: "Short punchy TikTok placement",
    ownerName: "Creator placeholder · @shorts",
    category: "Short-form",
    shortDescription:
      "Native short-form placement inside trending manga content to drive quick discovery.",
    fullDescription:
      "Placeholder full description. A native short-form integration designed to feel organic within existing viral formats, highlighting one strong hook from your project.",
    price: "$120",
    priceLabel: "Price",
    platforms: ["TikTok", "Instagram"],
    sponsorshipType: "Placement in a video",
    videoType: "Presentation",
    duration: "0–30s",
    paymentMode: "Fixed fee",
    status: "urgent",
    availability: "Available placeholder date",
    deadline: "Deadline placeholder",
    requirements: ["Provide a 5s hook line", "Share vertical-friendly key art"],
    deliverables: ["One TikTok short", "One Instagram Reels cross-post"],
    targetAudience: "Gen-Z manga readers, audience placeholder size",
    contactInstructions: "Use the Contact button to lock a slot in this week's batch.",
    linked: "Linked creator profile placeholder",
    accent: "#75a7ff",
  },
  {
    id: "a3",
    mode: "creator",
    title: "Community post shout-out bundle",
    ownerName: "Creator placeholder · @community",
    category: "Community",
    shortDescription:
      "Cross-platform community posts to announce a launch or chapter drop to an engaged base.",
    fullDescription:
      "Placeholder full description. A bundle of community posts across platforms, timed around your launch window to maximise reach without a full video production.",
    price: null,
    priceLabel: "Price",
    platforms: ["Twitter / X", "Instagram", "YouTube", "TikTok"],
    sponsorshipType: "Community post",
    paymentMode: "Custom price",
    status: "open",
    availability: "Available placeholder date",
    deadline: "Deadline placeholder",
    requirements: ["Provide announcement copy", "Provide launch date"],
    deliverables: ["Three community posts", "One story mention"],
    targetAudience: "Highly engaged niche community, audience placeholder size",
    contactInstructions: "Use the Contact button to request a custom quote.",
    linked: "Linked creator profile placeholder",
    accent: "#ffb84d",
  },
  {
    id: "p1",
    mode: "project",
    title: "Seeking creators for shonen launch",
    ownerName: "Project placeholder · Studio name",
    category: "Shonen",
    shortDescription:
      "New shonen title looking for content creators to build visibility ahead of chapter one.",
    fullDescription:
      "Placeholder full description. We are launching a new shonen project and want to partner with creators who can present the world, characters and stakes to a passionate audience.",
    price: "$300–$800",
    priceLabel: "Budget",
    platforms: ["YouTube", "TikTok", "Twitter / X"],
    sponsorshipType: "Long dedicated video",
    videoType: "Presentation",
    duration: "5–10 min",
    paymentMode: "Negotiable budget",
    status: "open",
    availability: "Campaign window placeholder",
    deadline: "Deadline placeholder",
    requirements: ["Share channel stats", "Propose a content angle"],
    deliverables: ["One dedicated presentation video", "Ongoing launch-week posts"],
    targetAudience: "Action manga readers, target reach placeholder",
    contactInstructions: "Use the Apply button to send your proposal and rate card.",
    linked: "Linked manga project placeholder",
    accent: "#39ff88",
  },
  {
    id: "p2",
    mode: "project",
    title: "Isekai webtoon promotion push",
    ownerName: "Project placeholder · Indie team",
    category: "Isekai",
    shortDescription:
      "Isekai webtoon seeking short-form creators to drive reads on launch platforms.",
    fullDescription:
      "Placeholder full description. Our isekai webtoon needs a burst of short-form visibility to convert curious viewers into readers during the launch window.",
    price: "$150–$400",
    priceLabel: "Budget",
    platforms: ["TikTok", "Instagram"],
    sponsorshipType: "Short dedicated video",
    videoType: "Reaction",
    duration: "30–60s",
    paymentMode: "Fixed budget",
    status: "closing",
    availability: "Campaign window placeholder",
    deadline: "Deadline placeholder",
    requirements: ["Provide audience demographics", "Confirm posting schedule"],
    deliverables: ["Two short dedicated videos", "One story series"],
    targetAudience: "Fantasy and isekai fans, target reach placeholder",
    contactInstructions: "Use the Apply button before the closing date.",
    linked: "Linked manga project placeholder",
    accent: "#ff5f7e",
  },
  {
    id: "p3",
    mode: "project",
    title: "Seinen anthology visibility campaign",
    ownerName: "Project placeholder · Collective",
    category: "Seinen",
    shortDescription:
      "Mature seinen anthology looking for analysis-style coverage to reach a discerning audience.",
    fullDescription:
      "Placeholder full description. We publish a seinen anthology and are looking for thoughtful, analysis-driven coverage that respects the tone and themes of the work.",
    price: null,
    priceLabel: "Budget",
    platforms: ["YouTube", "Twitter / X", "Twitch"],
    sponsorshipType: "Community post",
    paymentMode: "Collaboration",
    status: "open",
    availability: "Campaign window placeholder",
    deadline: "Deadline placeholder",
    requirements: ["Share previous analysis work", "Outline your angle"],
    deliverables: ["One analysis thread", "One community post"],
    targetAudience: "Mature manga readers, target reach placeholder",
    contactInstructions: "Use the Apply button to discuss a collaboration.",
    linked: "Linked manga project placeholder",
    accent: "#75a7ff",
  },
];

export const showDuration = (a: Announcement): boolean =>
  !!a.duration && durationForType(a.sponsorshipType);
