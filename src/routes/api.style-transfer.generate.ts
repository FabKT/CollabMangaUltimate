import { createFileRoute } from "@tanstack/react-router";
import {
  parseStyleTransferInput,
  requestPulseNoteStyleTransfer,
} from "@/server-functions/style-transfer-image";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Style transfer failed.";
}

export const Route = createFileRoute("/api/style-transfer/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseStyleTransferInput(await request.json());
          const result = await requestPulseNoteStyleTransfer(input);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
