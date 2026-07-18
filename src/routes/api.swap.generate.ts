import { createFileRoute } from "@tanstack/react-router";
import { withCredits } from "@/lib/billing-credits";
import { parseSwapImageInput, requestPulseNoteSwap } from "@/server-functions/swap-image";

export const Route = createFileRoute("/api/swap/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseSwapImageInput(await request.json());
          const outcome = await withCredits(request, { operationType: "edit" }, () =>
            requestPulseNoteSwap(input),
          );
          if (!outcome.ok)
            return Response.json({ error: outcome.error }, { status: outcome.status });
          return Response.json(outcome.result);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Character swap failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
