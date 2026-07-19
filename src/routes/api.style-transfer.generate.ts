import { createFileRoute } from "@tanstack/react-router";
import {
  parseStyleTransferInput,
  requestPulseNoteStyleTransfer,
} from "@/server-functions/style-transfer-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Style transfer failed.";
}

export const Route = createFileRoute("/api/style-transfer/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseStyleTransferInput(await request.json());
          const outcome = await withCredits(
            request,
            { workspace: "style-transfer", operationType: "generate" },
            () => requestPulseNoteStyleTransfer(input),
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
