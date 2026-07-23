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
  const ratings = await getMangaRatings([mangaId]);
  return ratings[mangaId] ?? 0;
}

/** Charge les moyennes de plusieurs mangas en une seule requête. */
export async function getMangaRatings(mangaIds: string[]): Promise<Record<string, number>> {
  if (mangaIds.length === 0) return {};
  const sb = getSupabase();
  const { data, error } = await sb
    .from("manga_chapter_ratings")
    .select("manga_id, stars")
    .in("manga_id", [...new Set(mangaIds)]);
  if (error) throw new Error(error.message);
  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const current = totals.get(row.manga_id) ?? { sum: 0, count: 0 };
    current.sum += row.stars;
    current.count += 1;
    totals.set(row.manga_id, current);
  }
  return Object.fromEntries(
    mangaIds.map((id) => {
      const current = totals.get(id);
      return [id, current ? Math.round((current.sum / current.count) * 10) / 10 : 0];
    }),
  );
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
