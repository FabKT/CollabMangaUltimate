import { createFileRoute } from "@tanstack/react-router";
import { withCredits } from "@/lib/billing-credits";
import { parseFreeImageInput, requestPulseNoteFreeImage } from "@/server-functions/free-image";

export const Route = createFileRoute("/api/free-studio/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseFreeImageInput(await request.json());
          const outcome = await withCredits(
            request,
            { workspace: "free-studio", operationType: "generate" },
            () => requestPulseNoteFreeImage(input),
          );
          if (!outcome.ok)
            return Response.json({ error: outcome.error }, { status: outcome.status });
          return Response.json(outcome.result);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Free generation failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
