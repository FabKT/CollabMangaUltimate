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

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    mode: "creator",
    title: "Review dédiée de ton manga",
    ownerName: "Hana Kimura · @hanadraws",
    category: "",
    shortDescription:
      "Review longue et détaillée couvrant le dessin, l'histoire et le rythme de ton manga ou webtoon.",
    fullDescription:
      "Une review complète qui présente à mon audience l'univers, la direction artistique et les points forts narratifs de ton projet, avec un avis honnête et un appel à la lecture clair.",
    price: "420 €",
    priceLabel: "Price",
    priceMin: 420,
    priceMax: 420,
    platforms: ["YouTube", "Twitter / X"],
    sponsorshipType: "Vidéo longue dédiée",
    videoType: "Review",
    duration: "10+ min",
    paymentMode: "Paiement unique",
    subscribers: 48000,
    status: "open",
    availability: "Disponible dès maintenant",
    deadline: "Créneau sous 2 semaines",
    requirements: [
      "Fournir le synopsis et les visuels clés",
      "Partager des chapitres en avant-première",
      "Valider le script avant enregistrement",
    ],
    deliverables: ["Une vidéo YouTube longue", "Commentaire épinglé avec tes liens", "Teaser en post communautaire"],
    targetAudience: "Passionnés de manga et d'anime",
    contactInstructions: "Utilise le bouton Contact pour envoyer ton brief et ton planning.",
    linked: "Profil créateur lié",
    accent: "#39ff88",
  },
  {
    id: "a2",
    mode: "creator",
    title: "Placement TikTok percutant",
    ownerName: "Léo Vasseur · @leo.shorts",
    category: "",
    shortDescription:
      "Placement natif dans un format court tendance pour faire découvrir ton manga rapidement.",
    fullDescription:
      "Une intégration courte pensée pour paraître naturelle dans mes formats viraux, en mettant en avant l'accroche la plus forte de ton projet.",
    price: "120 €",
    priceLabel: "Price",
    priceMin: 120,
    priceMax: 120,
    platforms: ["TikTok", "Instagram"],
    sponsorshipType: "Placement dans une vidéo",
    videoType: "Présentation",
    duration: "0–30 s",
    paymentMode: "Paiement unique",
    subscribers: 21000,
    status: "urgent",
    availability: "Créneaux cette semaine",
    deadline: "Batch en cours de remplissage",
    requirements: ["Fournir une accroche de 5 secondes", "Partager un visuel vertical"],
    deliverables: ["Un TikTok court", "Un repost Instagram Reels"],
    targetAudience: "Lecteurs manga Gen-Z",
    contactInstructions: "Utilise le bouton Contact pour réserver un créneau.",
    linked: "Profil créateur lié",
    accent: "#75a7ff",
  },
  {
    id: "a3",
    mode: "creator",
    title: "Pack de posts communautaires",
    ownerName: "Mika Ito · @mika.ink",
    category: "",
    shortDescription:
      "Posts communautaires multi-plateformes pour annoncer une sortie ou un nouveau chapitre.",
    fullDescription:
      "Un pack de posts communautaires publiés autour de ta fenêtre de sortie pour maximiser la visibilité sans production vidéo lourde.",
    price: null,
    priceLabel: "Price",
    platforms: ["Twitter / X", "Instagram", "YouTube", "TikTok"],
    sponsorshipType: "Post communautaire",
    paymentMode: "Abonnement",
    subscribers: 12500,
    status: "open",
    availability: "Planning flexible",
    deadline: "À convenir",
    requirements: ["Fournir le texte d'annonce", "Fournir la date de sortie"],
    deliverables: ["Trois posts communautaires", "Une mention en story"],
    targetAudience: "Communauté de niche très engagée",
    contactInstructions: "Utilise le bouton Contact pour demander un devis.",
    linked: "Profil créateur lié",
    accent: "#ffb84d",
  },
  {
    id: "p1",
    mode: "project",
    title: "Cherche créateurs pour lancement shonen",
    ownerName: "Studio Kuro",
    category: "Shonen",
    shortDescription:
      "Nouveau shonen cherche des créateurs de contenu pour construire sa visibilité avant le chapitre 1.",
    fullDescription:
      "Nous lançons un nouveau projet shonen et cherchons des créateurs capables de présenter l'univers, les personnages et les enjeux à une audience passionnée.",
    price: "300–800 €",
    priceLabel: "Budget",
    priceMin: 300,
    priceMax: 800,
    platforms: ["YouTube", "TikTok", "Twitter / X"],
    sponsorshipType: "Vidéo longue dédiée",
    videoType: "Présentation",
    duration: "5–10 min",
    paymentMode: "Paiement unique",
    chapters: 4,
    status: "open",
    availability: "Campagne de lancement",
    deadline: "Avant fin du mois",
    requirements: ["Partager les stats de ta chaîne", "Proposer un angle de contenu"],
    deliverables: ["Une vidéo de présentation dédiée", "Posts pendant la semaine de lancement"],
    targetAudience: "Lecteurs de manga d'action",
    contactInstructions: "Utilise le bouton Apply pour envoyer ta proposition et tes tarifs.",
    linked: "Projet manga lié",
    accent: "#39ff88",
  },
  {
    id: "p2",
    mode: "project",
    title: "Promotion webtoon isekai",
    ownerName: "Collectif Hollow",
    category: "Seinen",
    shortDescription:
      "Webtoon isekai cherche des créateurs de formats courts pour booster les lectures au lancement.",
    fullDescription:
      "Notre webtoon isekai a besoin d'un coup de projecteur en format court pour convertir les curieux en lecteurs pendant la fenêtre de lancement.",
    price: "150–400 €",
    priceLabel: "Budget",
    priceMin: 150,
    priceMax: 400,
    platforms: ["TikTok", "Instagram"],
    sponsorshipType: "Vidéo courte dédiée",
    videoType: "Reaction",
    duration: "30–60 s",
    paymentMode: "Paiement unique",
    chapters: 12,
    status: "closing",
    availability: "Campagne en cours",
    deadline: "Clôture imminente",
    requirements: ["Fournir la démographie de ton audience", "Confirmer le planning de publication"],
    deliverables: ["Deux vidéos courtes dédiées", "Une série de stories"],
    targetAudience: "Fans de fantasy et d'isekai",
    contactInstructions: "Utilise le bouton Apply avant la clôture.",
    linked: "Projet manga lié",
    accent: "#ff5f7e",
  },
  {
    id: "p3",
    mode: "project",
    title: "Campagne de visibilité anthologie seinen",
    ownerName: "Éditions Nocturne",
    category: "Josei",
    shortDescription:
      "Anthologie mature cherche une couverture de type analyse pour toucher un lectorat exigeant.",
    fullDescription:
      "Nous publions une anthologie et cherchons une couverture analytique et réfléchie, respectueuse du ton et des thèmes de l'œuvre.",
    price: null,
    priceLabel: "Budget",
    platforms: ["YouTube", "Twitter / X", "Twitch"],
    sponsorshipType: "Post communautaire",
    paymentMode: "Abonnement",
    chapters: 24,
    status: "open",
    availability: "Fenêtre flexible",
    deadline: "À convenir",
    requirements: ["Partager tes analyses précédentes", "Décrire ton angle"],
    deliverables: ["Un thread d'analyse", "Un post communautaire"],
    targetAudience: "Lecteurs de manga adultes",
    contactInstructions: "Utilise le bouton Apply pour discuter d'une collaboration.",
    linked: "Projet manga lié",
    accent: "#75a7ff",
  },
];

export const showDuration = (a: Announcement): boolean =>
  !!a.duration && durationForType(a.sponsorshipType);
