import { getSupabase } from "@/lib/supabase";

export type InterestedPerson = { id: string; name: string; at: string };

export async function listInterested(announcementId: string): Promise<InterestedPerson[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("announcement_interests")
    .select(
      "user_id, created_at, profile:profiles!announcement_interests_user_id_fkey(username, display_name)",
    )
    .eq("announcement_id", announcementId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const profile = row.profile as unknown as { username: string; display_name: string | null } | null;
    return {
      id: row.user_id,
      name: profile?.display_name || profile?.username || "Membre",
      at: row.created_at,
    };
  });
}

export async function addInterested(announcementId: string): Promise<void> {
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error("Connecte-toi pour répondre à cette annonce.");
  const { error } = await sb.from("announcement_interests").upsert(
    { announcement_id: announcementId, user_id: userId },
    { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}
