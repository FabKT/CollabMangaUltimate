import { createFileRoute } from "@tanstack/react-router";
import {
  parseCharacterImageInput,
  requestPulseNoteCharacterImage,
} from "@/server-functions/character-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Character generation failed.";
}

export const Route = createFileRoute("/api/character/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseCharacterImageInput(await request.json());
          const outcome = await withCredits(request, { operationType: "generate" }, () =>
            requestPulseNoteCharacterImage(input),
          );
          if (!outcome.ok) return Response.json({ error: outcome.error }, { status: outcome.status });
          return Response.json(outcome.result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
