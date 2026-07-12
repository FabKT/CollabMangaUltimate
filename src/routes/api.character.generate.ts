import { createFileRoute } from "@tanstack/react-router";
import {
  parseCharacterImageInput,
  requestPulseNoteCharacterImage,
} from "@/server-functions/character-image";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Character generation failed.";
}

export const Route = createFileRoute("/api/character/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseCharacterImageInput(await request.json());
          const result = await requestPulseNoteCharacterImage(input);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
