import { getSupabase } from "@/lib/supabase";

export type SponsorshipReview = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
};

export async function listSponsorshipReviews(creatorId: string): Promise<SponsorshipReview[]> {
  if (!creatorId) return [];
  const { data, error } = await getSupabase()
    .from("sponsorship_reviews")
    .select(
      "id, reviewer_id, rating, comment, reviewer:profiles!sponsorship_reviews_reviewer_id_fkey(display_name, username)",
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
      reviewerId: row.reviewer_id,
      reviewerName: reviewer?.display_name || reviewer?.username || "Utilisateur",
      rating: row.rating,
      comment: row.comment,
    };
  });
}

export async function addSponsorshipReview(input: {
  sponsorshipId: string;
  creatorId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const sb = getSupabase();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("Connecte-toi pour publier un avis.");
  const { error } = await sb.from("sponsorship_reviews").insert({
    sponsorship_id: input.sponsorshipId,
    creator_id: input.creatorId,
    reviewer_id: uid,
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    comment: input.comment.trim(),
  });
  if (error) throw new Error(error.message);
}
