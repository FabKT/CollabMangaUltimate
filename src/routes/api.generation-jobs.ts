import { createFileRoute } from "@tanstack/react-router";
import { getServiceSupabase } from "@/lib/stripe-server";

const ALLOWED_ENDPOINTS = new Set([
  "/api/manga/generate-page",
  "/api/character/generate",
  "/api/sketch-final/generate",
  "/api/style-transfer/generate",
  "/api/planche-transfer/generate",
  "/api/swap/generate",
  "/api/decor/generate",
  "/api/free-studio/generate",
]);

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

async function authenticatedUserId(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const { data } = await getServiceSupabase().auth.getUser(token);
  return data.user?.id ?? null;
}

async function processJob(
  requestUrl: string,
  authorization: string,
  job: { id: string; endpoint: string; payload: unknown },
) {
  const supabase = getServiceSupabase();
  await supabase
    .from("ai_generation_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    const response = await fetch(new URL(job.endpoint, requestUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify(job.payload),
    });
    const result = await response.json().catch(async () => ({ error: await response.text().catch(() => "") }));
    const now = new Date().toISOString();
    if (!response.ok) {
      await supabase.from("ai_generation_jobs").update({
        status: "failed",
        error_message: result.error || `Generation failed (${response.status}).`,
        completed_at: now,
        updated_at: now,
      }).eq("id", job.id);
      return;
    }
    await supabase.from("ai_generation_jobs").update({
      status: "completed",
      result_payload: result,
      completed_at: now,
      updated_at: now,
    }).eq("id", job.id);
  } catch (error) {
    const now = new Date().toISOString();
    await supabase.from("ai_generation_jobs").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Generation failed.",
      completed_at: now,
      updated_at: now,
    }).eq("id", job.id);
  }
}

export const Route = createFileRoute("/api/generation-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await authenticatedUserId(request);
          if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
          const body = await request.json() as { workspace?: string; endpoint?: string; payload?: unknown };
          if (!body.workspace || !body.endpoint || !ALLOWED_ENDPOINTS.has(body.endpoint)) {
            return Response.json({ error: "Invalid generation job." }, { status: 400 });
          }
          const supabase = getServiceSupabase();
          const inserted = await supabase.from("ai_generation_jobs").insert({
            user_id: userId,
            workspace: body.workspace,
            endpoint: body.endpoint,
            request_payload: body.payload ?? {},
          }).select("id").single();
          if (inserted.error || !inserted.data) {
            return Response.json({ error: inserted.error?.message || "Generation queue unavailable." }, { status: 503 });
          }
          const authorization = request.headers.get("authorization") ?? "";
          void processJob(request.url, authorization, {
            id: inserted.data.id,
            endpoint: body.endpoint,
            payload: body.payload ?? {},
          });
          return Response.json({ id: inserted.data.id, status: "queued" }, { status: 202 });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Generation queue unavailable." }, { status: 503 });
        }
      },
      GET: async ({ request }) => {
        try {
          const userId = await authenticatedUserId(request);
          if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
          const id = new URL(request.url).searchParams.get("id");
          if (!id) return Response.json({ error: "Missing job id." }, { status: 400 });
          const queried = await getServiceSupabase().from("ai_generation_jobs")
            .select("id,status,result_payload,error_message")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();
          if (queried.error || !queried.data) return Response.json({ error: "Generation job not found." }, { status: 404 });
          return Response.json({
            id: queried.data.id,
            status: queried.data.status,
            result: queried.data.result_payload ?? undefined,
            error: queried.data.error_message ?? undefined,
          });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Unable to read generation job." }, { status: 503 });
        }
      },
    },
  },
});
