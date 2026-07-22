import { getSupabase } from "@/lib/supabase";

export async function rateChapter(mangaId: string, chapterId: string, stars: number) {
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) throw new Error("Connecte-toi pour noter ce chapitre.");
  const { error } = await sb.from("manga_chapter_ratings").upsert(
    {
      user_id: userId,
      manga_id: mangaId,
      chapter_id: chapterId,
      stars: Math.max(1, Math.min(5, Math.round(stars))),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,manga_id,chapter_id" },
  );
  if (error) throw new Error(error.message);
}

export async function getChapterRating(mangaId: string, chapterId: string): Promise<number> {
  const sb = getSupabase();
  const userId = (await sb.auth.getSession()).data.session?.user.id;
  if (!userId) return 0;
  const { data, error } = await sb
    .from("manga_chapter_ratings")
    .select("stars")
    .eq("user_id", userId)
    .eq("manga_id", mangaId)
    .eq("chapter_id", chapterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.stars ?? 0;
}

export async function getMangaRating(mangaId: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("manga_chapter_ratings")
    .select("stars")
    .eq("manga_id", mangaId);
  if (error) throw new Error(error.message);
  if (!data?.length) return 0;
  const average = data.reduce((total, row) => total + row.stars, 0) / data.length;
  return Math.round(average * 10) / 10;
}

export async function getMangaRatingCount(mangaId: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from("manga_chapter_ratings")
    .select("*", { count: "exact", head: true })
    .eq("manga_id", mangaId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
