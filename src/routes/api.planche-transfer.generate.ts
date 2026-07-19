import { createFileRoute } from "@tanstack/react-router";
import {
  parsePlancheTransferInput,
  requestPulseNotePlancheTransfer,
} from "@/server-functions/planche-transfer-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Page style transfer failed.";
}

export const Route = createFileRoute("/api/planche-transfer/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parsePlancheTransferInput(await request.json());
          const outcome = await withCredits(
            request,
            { workspace: "planche-transfer", operationType: "generate" },
            () => requestPulseNotePlancheTransfer(input),
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
