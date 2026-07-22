import { getSupabase } from "@/lib/supabase";

export type SponsorshipReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
};

export async function listSponsorshipReviews(creatorId: string): Promise<SponsorshipReview[]> {
  if (!creatorId) return [];
  const { data, error } = await getSupabase()
    .from("sponsorship_reviews")
    .select(
      "id, rating, comment, reviewer:profiles!sponsorship_reviews_reviewer_id_fkey(display_name, username)",
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const reviewer = row.reviewer as unknown as {
      display_name: string | null;
      username: string;
    } | null;
    return {
      id: row.id,
      reviewerName: reviewer?.display_name || reviewer?.username || "Utilisateur",
      rating: row.rating,
      comment: row.comment,
    };
  });
}
