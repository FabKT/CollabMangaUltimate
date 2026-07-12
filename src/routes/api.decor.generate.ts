import { createFileRoute } from "@tanstack/react-router";
import { parseDecorImageInput, requestPulseNoteDecorImage } from "@/server-functions/decor-image";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Decor generation failed.";
}

export const Route = createFileRoute("/api/decor/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseDecorImageInput(await request.json());
          const result = await requestPulseNoteDecorImage(input);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
