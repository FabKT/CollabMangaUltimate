import { getSupabase } from "@/lib/supabase";

export type SponsorOptionMode = "creator" | "project";

export type SponsorOption = {
  id: string;
  mode: SponsorOptionMode;
  format: string;
  platforms: string[];
  videoType: string;
  duration: string;
  paymentMode: string;
  price: string;
  quantity: number;
  description: string;
  ownerName: string;
  chaptersMin?: number;
  chaptersMax?: number;
  subscribersMin?: number;
  subscribersMax?: number;
  language?: string;
  createdAt: string;
  ownerId?: string;
  ownerAvatarUrl?: string | null;
  ownerBannerUrl?: string | null;
};

const LEGACY_KEY = "collabmanga.sponsorOptions.v1";
const LEGACY_OWNER_KEY = "collabmanga.sponsorOptions.supabaseMigrationOwner.v1";

function readLegacy(): SponsorOption[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SponsorOption[]) : [];
  } catch {
    return [];
  }
}

async function currentUserId() {
  const sb = getSupabase();
  return (await sb.auth.getSession()).data.session?.user.id ?? null;
}

export async function listSponsorOptions(ownerId?: string | null): Promise<SponsorOption[]> {
  const sb = getSupabase();
  let { data, error } = await sb
    .from("sponsor_options")
    .select("owner_id, data, owner:profiles!sponsor_options_owner_id_fkey(display_name, username, avatar_url, banner_url)")
    .order("created_at", { ascending: false });
  if (error) {
    const fallback = await sb
      .from("sponsor_options")
      .select("owner_id, data, owner:profiles!sponsor_options_owner_id_fkey(display_name, username, avatar_url)")
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  const userId = await currentUserId();
  if (
    userId &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(LEGACY_OWNER_KEY) === null
  ) {
    const legacy = readLegacy();
    for (const option of legacy) {
      await persistOption(option, userId);
    }
    window.localStorage.setItem(LEGACY_OWNER_KEY, userId);
    return listSponsorOptions(ownerId);
  }
  return (data ?? [])
    .filter((row) => !ownerId || row.owner_id === ownerId)
    .map((row) => {
      const owner = row.owner as {
        display_name?: string | null;
        username?: string | null;
        avatar_url?: string | null;
        banner_url?: string | null;
      } | null;
      return {
        ...(row.data as SponsorOption),
        ownerId: row.owner_id,
        ownerName: owner?.display_name || owner?.username || (row.data as SponsorOption).ownerName,
        ownerAvatarUrl: owner?.avatar_url ?? null,
        ownerBannerUrl: owner?.banner_url ?? null,
      };
    });
}

async function persistOption(option: SponsorOption, userId: string) {
  const sb = getSupabase();
  const { error } = await sb.from("sponsor_options").upsert(
    {
      id: option.id,
      owner_id: userId,
      mode: option.mode,
      data: option,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export async function addSponsorOption(
  input: Omit<SponsorOption, "id" | "createdAt">,
): Promise<SponsorOption> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Connecte-toi pour créer une option de parrainage.");
  const option: SponsorOption = {
    ...input,
    id: `opt-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
  await persistOption(option, userId);
  return option;
}

export async function updateSponsorOption(id: string, patch: Partial<SponsorOption>) {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!userId) throw new Error("Connecte-toi pour modifier cette option.");
  const { data, error } = await sb
    .from("sponsor_options")
    .select("data")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  await persistOption({ ...(data.data as SponsorOption), ...patch, id }, userId);
}

export async function removeSponsorOption(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from("sponsor_options").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
