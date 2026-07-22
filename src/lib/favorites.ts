import { getSupabase } from "@/lib/supabase";

export type FavoriteKind =
  | "Announcement"
  | "Idée"
  | "Illustration"
  | "Sponsorship option"
  | "Project";

export type Favorite = {
  id: string;
  kind: FavoriteKind;
  title: string;
  createdAt: string;
};

export async function listFavorites(): Promise<Favorite[]> {
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) return [];
  const { data, error } = await sb
    .from("user_favorites")
    .select("id, kind, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((favorite) => ({
    id: favorite.id,
    kind: favorite.kind as FavoriteKind,
    title: favorite.title,
    createdAt: favorite.created_at,
  }));
}

export async function addFavorite(kind: FavoriteKind, title: string): Promise<void> {
  if (!title.trim()) return;
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error("Connecte-toi pour enregistrer un favori.");
  const { error } = await sb
    .from("user_favorites")
    .insert({ user_id: userId, kind, title: title.trim() });
  if (error) throw new Error(error.message);
}

export async function removeFavorite(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("user_favorites").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setFavorite(
  kind: FavoriteKind,
  title: string,
  saved: boolean,
): Promise<void> {
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error("Connecte-toi pour modifier tes favoris.");
  const query = sb
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("title", title.trim());
  const { error: deleteError } = await query;
  if (deleteError) throw new Error(deleteError.message);
  if (!saved) return;
  const { error: insertError } = await sb
    .from("user_favorites")
    .insert({ user_id: userId, kind, title: title.trim() });
  if (insertError) throw new Error(insertError.message);
}
