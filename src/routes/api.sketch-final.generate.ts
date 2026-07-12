import { createFileRoute } from "@tanstack/react-router";
import {
  parseSketchFinalInput,
  requestPulseNoteSketchFinal,
} from "@/server-functions/sketch-final-image";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Sketch finishing failed.";
}

export const Route = createFileRoute("/api/sketch-final/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseSketchFinalInput(await request.json());
          const result = await requestPulseNoteSketchFinal(input);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
