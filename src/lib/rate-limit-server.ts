import { createHmac } from "node:crypto";
import { getServiceSupabase } from "./stripe-server";

type RateLimitOptions = {
  scope: string;
  identityLimit: number;
  ipLimit: number;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

function serverEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env[name]) return process.env[name];
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name];
}

function hashKey(value: string): string {
  const secret = serverEnv("RATE_LIMIT_SECRET") || serverEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Rate limiting is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function requestIdentity(request: Request): string {
  const authorization = request.headers.get("authorization");
  return authorization ? `authorization:${authorization}` : `anonymous:${clientIp(request)}`;
}

export async function consumeIdentityRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitRow> {
  const { data, error } = await getServiceSupabase().rpc("consume_api_rate_limit", {
    p_key_hash: hashKey(`${scope}:${identity}`),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Rate limiter unavailable: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row) throw new Error("Rate limiter returned no result.");
  return row;
}

export async function enforceRequestRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<Response | null> {
  try {
    const [identityResult, ipResult] = await Promise.all([
      consumeIdentityRateLimit(
        `${options.scope}:identity`,
        requestIdentity(request),
        options.identityLimit,
        options.windowSeconds,
      ),
      consumeIdentityRateLimit(
        `${options.scope}:ip`,
        clientIp(request),
        options.ipLimit,
        options.windowSeconds,
      ),
    ]);
    const denied = !identityResult.allowed ? identityResult : !ipResult.allowed ? ipResult : null;
    if (!denied) return null;
    return Response.json(
      { error: "Trop de requêtes. Réessaie dans quelques instants." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(denied.retry_after_seconds, 1)),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[rate-limit]", error);
    return Response.json(
      { error: "Protection anti-abus temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function assertIdentityRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const result = await consumeIdentityRateLimit(scope, identity, limit, windowSeconds);
  if (!result.allowed) {
    throw new Error(
      `Trop de tentatives. Réessaie dans ${Math.max(result.retry_after_seconds, 1)} secondes.`,
    );
  }
}
