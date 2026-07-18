export type ProfilePreferences = {
  bio: string;
  languages: string[];
  available: boolean;
  visibility: string;
  sponsorshipStatus: string;
  favoriteGenres: string[];
  favoriteSubgenres: string[];
  showProjects: boolean;
  showIllustrations: boolean;
  showIdeas: boolean;
  showSponsorships: boolean;
  allowInvites: boolean;
  allowMessages: boolean;
};

const STORAGE_KEY = "collabmanga.profile-preferences.v1";

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}.${userId}` : STORAGE_KEY;
}

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  bio: "",
  languages: ["English", "Français"],
  available: true,
  visibility: "Public",
  sponsorshipStatus: "Accepting sponsorships",
  favoriteGenres: [],
  favoriteSubgenres: [],
  showProjects: true,
  showIllustrations: true,
  showIdeas: true,
  showSponsorships: true,
  allowInvites: true,
  allowMessages: true,
};

export function loadProfilePreferences(userId?: string | null): ProfilePreferences {
  if (typeof window === "undefined") return DEFAULT_PROFILE_PREFERENCES;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey(userId)) ?? "{}",
    ) as Partial<ProfilePreferences>;
    return {
      ...DEFAULT_PROFILE_PREFERENCES,
      ...parsed,
      languages: Array.isArray(parsed.languages)
        ? parsed.languages
        : DEFAULT_PROFILE_PREFERENCES.languages,
    };
  } catch {
    return DEFAULT_PROFILE_PREFERENCES;
  }
}

export function saveProfilePreferences(
  preferences: ProfilePreferences,
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
}
