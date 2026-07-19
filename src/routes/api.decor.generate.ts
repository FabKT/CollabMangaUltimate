import { createFileRoute } from "@tanstack/react-router";
import { parseDecorImageInput, requestPulseNoteDecorImage } from "@/server-functions/decor-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Decor generation failed.";
}

export const Route = createFileRoute("/api/decor/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseDecorImageInput(await request.json());
          const outcome = await withCredits(
            request,
            { workspace: "decor-create", operationType: "generate" },
            () => requestPulseNoteDecorImage(input),
          );
          if (!outcome.ok)
            return Response.json({ error: outcome.error }, { status: outcome.status });
          return Response.json(outcome.result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
