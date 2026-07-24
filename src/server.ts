import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const IMAGE_GENERATION_PATHS = new Set([
  "/api/manga/generate-page",
  "/api/character/generate",
  "/api/sketch-final/generate",
  "/api/style-transfer/generate",
  "/api/planche-transfer/generate",
  "/api/swap/generate",
  "/api/decor/generate",
  "/api/free-studio/generate",
]);

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Webhook Stripe : intercepté avant TanStack Start pour lire le corps brut
      // (nécessaire à la vérification de signature).
      const url = new URL(request.url);
      if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
        const { enforceRequestRateLimit } = await import("./lib/rate-limit-server");
        const limited = await enforceRequestRateLimit(request, {
          scope: "stripe-webhook",
          identityLimit: 120,
          ipLimit: 120,
          windowSeconds: 60,
        });
        if (limited) return withSecurityHeaders(limited);
        const { handleStripeWebhook } = await import("./lib/stripe-server");
        return withSecurityHeaders(await handleStripeWebhook(request));
      }

      if (
        request.method === "POST" &&
        (IMAGE_GENERATION_PATHS.has(url.pathname) || url.pathname === "/api/generation-jobs")
      ) {
        const { enforceRequestRateLimit } = await import("./lib/rate-limit-server");
        const limited = await enforceRequestRateLimit(request, {
          scope: "image-generation",
          identityLimit: 10,
          ipLimit: 30,
          windowSeconds: 60,
        });
        if (limited) return withSecurityHeaders(limited);
      }

      if (request.method === "GET" && url.pathname === "/api/generation-jobs") {
        const { enforceRequestRateLimit } = await import("./lib/rate-limit-server");
        const limited = await enforceRequestRateLimit(request, {
          scope: "generation-status",
          identityLimit: 180,
          ipLimit: 300,
          windowSeconds: 60,
        });
        if (limited) return withSecurityHeaders(limited);
      }

      if (request.method === "GET" && url.pathname === "/api/manga/status") {
        const { enforceRequestRateLimit } = await import("./lib/rate-limit-server");
        const limited = await enforceRequestRateLimit(request, {
          scope: "backend-health",
          identityLimit: 30,
          ipLimit: 60,
          windowSeconds: 60,
        });
        if (limited) return withSecurityHeaders(limited);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
