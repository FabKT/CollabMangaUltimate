import { getSupabase } from "@/lib/supabase";

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

const LEGACY_STORAGE_KEY = "collabmanga.profile-preferences.v1";

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

function normalize(value: unknown): ProfilePreferences {
  const parsed = value && typeof value === "object" ? (value as Partial<ProfilePreferences>) : {};
  return {
    ...DEFAULT_PROFILE_PREFERENCES,
    ...parsed,
    languages: Array.isArray(parsed.languages)
      ? parsed.languages
      : DEFAULT_PROFILE_PREFERENCES.languages,
    favoriteGenres: Array.isArray(parsed.favoriteGenres) ? parsed.favoriteGenres : [],
    favoriteSubgenres: Array.isArray(parsed.favoriteSubgenres) ? parsed.favoriteSubgenres : [],
  };
}

function legacyPreferences(userId: string): ProfilePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LEGACY_STORAGE_KEY}.${userId}`);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function loadProfilePreferences(userId?: string | null): Promise<ProfilePreferences> {
  if (!userId) return DEFAULT_PROFILE_PREFERENCES;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profile_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.preferences) return normalize(data.preferences);

  const currentUserId = (await sb.auth.getSession()).data.session?.user.id;
  const legacy = currentUserId === userId ? legacyPreferences(userId) : null;
  if (legacy) {
    await saveProfilePreferences(legacy, userId);
    return legacy;
  }
  return DEFAULT_PROFILE_PREFERENCES;
}

export async function saveProfilePreferences(
  preferences: ProfilePreferences,
  userId?: string | null,
): Promise<void> {
  if (!userId) return;
  const sb = getSupabase();
  const { error } = await sb.from("profile_preferences").upsert(
    { user_id: userId, preferences: normalize(preferences), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
