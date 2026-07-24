import { getServiceSupabase } from "@/lib/stripe-server";

const STALE_JOB_MINUTES = 18;

export async function releaseGenerationJobCredit(jobId: string) {
  const supabase = getServiceSupabase();
  const reserved = await supabase
    .from("generations")
    .select("id")
    .eq("credit_status", "reserved")
    .contains("usage_data", { durable_job_id: jobId })
    .maybeSingle();

  if (reserved.error) throw new Error(reserved.error.message);
  if (!reserved.data) return false;

  const released = await supabase.rpc("release_credits", {
    p_generation_id: reserved.data.id,
  });
  if (released.error) throw new Error(released.error.message);
  return true;
}

export async function failAndReleaseGenerationJob(jobId: string, message: string) {
  const supabase = getServiceSupabase();
  await releaseGenerationJobCredit(jobId);
  const completedAt = new Date().toISOString();
  const updated = await supabase
    .from("ai_generation_jobs")
    .update({
      status: "failed",
      error_message: message,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", jobId)
    .in("status", ["queued", "running"]);
  if (updated.error) throw new Error(updated.error.message);
}

export async function recoverStaleGenerationJobs() {
  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60_000).toISOString();
  const stale = await supabase
    .from("ai_generation_jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .lt("updated_at", cutoff)
    .limit(100);
  if (stale.error) throw new Error(stale.error.message);

  const message =
    "La génération a dépassé le délai maximal et a été arrêtée. Le crédit a été restitué.";
  for (const job of stale.data ?? []) {
    await failAndReleaseGenerationJob(job.id, message);
  }
  return stale.data?.length ?? 0;
}
