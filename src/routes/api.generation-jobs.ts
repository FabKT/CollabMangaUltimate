import { createFileRoute } from "@tanstack/react-router";
import { getServiceSupabase } from "@/lib/stripe-server";
import { failAndReleaseGenerationJob } from "@/lib/generation-job-recovery";
import { processGenerationJob } from "@/server-functions/generation-job-worker";

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

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function invokeWorker(request: Request, jobId: string, authorization: string) {
  if (isLocalRequest(request)) {
    void processGenerationJob(jobId, authorization);
    return;
  }

  const workerUrl = new URL("/.netlify/functions/generation-worker", request.url);
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ jobId, authorization }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Unable to start generation worker (${response.status}).`);
  }
}

export const Route = createFileRoute("/api/generation-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await authenticatedUserId(request);
          if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
          const body = (await request.json()) as {
            id?: string;
            workspace?: string;
            endpoint?: string;
            payload?: unknown;
          };
          if (!body.workspace || !body.endpoint || !ALLOWED_ENDPOINTS.has(body.endpoint)) {
            return Response.json({ error: "Invalid generation job." }, { status: 400 });
          }
          const supabase = getServiceSupabase();
          const record = {
            ...(body.id ? { id: body.id } : {}),
            user_id: userId,
            workspace: body.workspace,
            endpoint: body.endpoint,
            request_payload: body.payload ?? {},
          };
          const inserted = await supabase
            .from("ai_generation_jobs")
            .insert(record)
            .select("id")
            .single();
          if (inserted.error || !inserted.data) {
            if (body.id && inserted.error?.code === "23505") {
              const existing = await supabase
                .from("ai_generation_jobs")
                .select("id,status")
                .eq("id", body.id)
                .eq("user_id", userId)
                .maybeSingle();
              if (existing.data) return Response.json(existing.data, { status: 202 });
            }
            return Response.json(
              { error: inserted.error?.message || "Generation queue unavailable." },
              { status: 503 },
            );
          }
          const authorization = request.headers.get("authorization") ?? "";
          try {
            await invokeWorker(request, inserted.data.id, authorization);
          } catch (error) {
            await supabase
              .from("ai_generation_jobs")
              .update({
                status: "failed",
                error_message:
                  error instanceof Error ? error.message : "Unable to start generation worker.",
                updated_at: new Date().toISOString(),
              })
              .eq("id", inserted.data.id);
            throw error;
          }
          return Response.json({ id: inserted.data.id, status: "queued" }, { status: 202 });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Generation queue unavailable." },
            { status: 503 },
          );
        }
      },
      GET: async ({ request }) => {
        try {
          const userId = await authenticatedUserId(request);
          if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
          const id = new URL(request.url).searchParams.get("id");
          if (!id) return Response.json({ error: "Missing job id." }, { status: 400 });
          const queried = await getServiceSupabase()
            .from("ai_generation_jobs")
            .select("id,status,result_payload,error_message,created_at,updated_at")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();
          if (queried.error || !queried.data)
            return Response.json({ error: "Generation job not found." }, { status: 404 });
          const now = Date.now();
          const stale =
            (queried.data.status === "queued" || queried.data.status === "running") &&
            now -
              new Date(
                queried.data.status === "queued"
                  ? queried.data.created_at
                  : queried.data.updated_at,
              ).getTime() >
              9 * 60 * 1000;
          if (stale) {
            const error =
              "La génération a dépassé le délai maximal et a été arrêtée. Le crédit a été restitué.";
            await failAndReleaseGenerationJob(id, error);
            return Response.json({ id, status: "failed", error });
          }
          if (
            queried.data.status === "queued" &&
            now - new Date(queried.data.updated_at).getTime() > 15_000
          ) {
            const authorization = request.headers.get("authorization") ?? "";
            await invokeWorker(request, id, authorization);
            await getServiceSupabase()
              .from("ai_generation_jobs")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", id)
              .eq("user_id", userId)
              .eq("status", "queued");
          }
          return Response.json({
            id: queried.data.id,
            status: queried.data.status,
            result: queried.data.result_payload ?? undefined,
            error: queried.data.error_message ?? undefined,
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unable to read generation job." },
            { status: 503 },
          );
        }
      },
    },
  },
});
