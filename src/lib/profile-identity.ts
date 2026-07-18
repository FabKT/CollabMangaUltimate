export type ProfileType = "creator" | "content";

export type PublicProfileIdentity = {
  displayName: string;
  username: string;
  initials: string;
  tagline: string;
  profileType: ProfileType;
  mainRole?: string;
  secondaryRole?: string;
  languages?: string[];
  avatarUrl?: string;
  bannerUrl?: string;
};

export const DEFAULT_PROFILE_IDENTITY: PublicProfileIdentity = {
  displayName: "Mon profil",
  username: "",
  initials: "…",
  tagline: "",
  profileType: "creator",
};

const PUBLIC_PROFILE_FIXTURES: Record<string, PublicProfileIdentity> = {
  u1: {
    displayName: "InkWave Studio",
    username: "@inkwave_studio",
    initials: "IW",
    tagline: "Dessinateur seinen, encrage intense et compositions urbaines dramatiques.",
    profileType: "creator",
    mainRole: "Dessinateur",
  },
  u2: {
    displayName: "Nova Scriptor",
    username: "@nova_scriptor",
    initials: "NS",
    tagline: "Scénariste shonen, worldbuilding et systèmes de pouvoirs sur le long terme.",
    profileType: "creator",
    mainRole: "Scénariste",
  },
  u3: {
    displayName: "PanelPulse",
    username: "@panelpulse",
    initials: "PP",
    tagline:
      "Créateur de contenu manga, reviews hebdomadaires et mise en avant de projets indépendants.",
    profileType: "content",
    mainRole: "Créateur de contenu",
  },
  u4: {
    displayName: "Sakura Lines",
    username: "@sakura_lines",
    initials: "SL",
    tagline: "Décors manga, rues nocturnes, intérieurs et ambiance slice of life.",
    profileType: "creator",
    mainRole: "Dessinateur",
  },
  u5: {
    displayName: "Lorekeeper",
    username: "@lorekeeper",
    initials: "LK",
    tagline: "Scénariste orienté lore, factions, chronologies et arcs longs.",
    profileType: "creator",
    mainRole: "Scénariste",
  },
  u6: {
    displayName: "Bento Reader",
    username: "@bento_reader",
    initials: "BR",
    tagline: "Lecteur bêta, retours structurés chapitre par chapitre et notes de rythme.",
    profileType: "creator",
    mainRole: "Lecteur",
  },
  u7: {
    displayName: "Kaiju Hex",
    username: "@kaiju_hex",
    initials: "KH",
    tagline: "Illustrateur de créatures, mecha et couvertures à silhouette forte.",
    profileType: "creator",
    mainRole: "Dessinateur",
  },
  u8: {
    displayName: "Storycraft HQ",
    username: "@storycraft_hq",
    initials: "SC",
    tagline: "Studio éditorial manga, anthologies seinen et recrutement d'équipes créatives.",
    profileType: "creator",
    mainRole: "Scénariste",
  },
  u9: {
    displayName: "Midori Talks",
    username: "@midori_talks",
    initials: "MT",
    tagline: "Créatrice de contenu, essais vidéo sur le shojo classique et le josei moderne.",
    profileType: "content",
    mainRole: "Créateur de contenu",
  },
};

export function getPublicProfileIdentity(profileId: string): PublicProfileIdentity {
  return (
    PUBLIC_PROFILE_FIXTURES[profileId] ?? {
      ...DEFAULT_PROFILE_IDENTITY,
      displayName:
        profileId
          .split(/[-_]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ") || DEFAULT_PROFILE_IDENTITY.displayName,
      username: profileId ? `@${profileId}` : DEFAULT_PROFILE_IDENTITY.username,
    }
  );
}
