import { createFileRoute } from "@tanstack/react-router";
import {
  parseMangaImageGenerationInput,
  requestPulseNoteMangaImage,
} from "@/server-functions/manga-image";
import { withCredits } from "@/lib/billing-credits";

function apiErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Manga image generation failed.";
}

export const Route = createFileRoute("/api/manga/generate-page")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = parseMangaImageGenerationInput(await request.json());
          const outcome = await withCredits(
            request,
            { operationType: input.operation === "edit" ? "edit" : input.operation === "regenerate" ? "regenerate" : "generate" },
            () => requestPulseNoteMangaImage(input),
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
