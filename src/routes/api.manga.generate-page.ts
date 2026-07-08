import { createFileRoute } from "@tanstack/react-router";
import {
  parseMangaImageGenerationInput,
  requestPulseNoteMangaImage,
} from "@/server-functions/manga-image";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Manga image generation failed.";
}

export const Route = createFileRoute("/api/manga/generate-page")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseMangaImageGenerationInput(await request.json());
          const result = await requestPulseNoteMangaImage(input);
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: apiErrorMessage(error) }, { status: 500 });
        }
      },
    },
  },
});
