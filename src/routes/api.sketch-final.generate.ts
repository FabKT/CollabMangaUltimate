import { createFileRoute } from "@tanstack/react-router";
import {
  parseSketchFinalInput,
  requestPulseNoteSketchFinal,
} from "@/server-functions/sketch-final-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Sketch finishing failed.";
}

export const Route = createFileRoute("/api/sketch-final/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseSketchFinalInput(await request.json());
          const outcome = await withCredits(
            request,
            { workspace: "raw-final", operationType: "generate" },
            () => requestPulseNoteSketchFinal(input),
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
