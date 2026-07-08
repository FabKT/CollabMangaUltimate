import { createFileRoute } from "@tanstack/react-router";
import { checkPulseNoteMangaBackend } from "@/server-functions/manga-image";

export const Route = createFileRoute("/api/manga/status")({
  server: {
    handlers: {
      GET: async () => {
        const result = await checkPulseNoteMangaBackend();
        return Response.json(result);
      },
    },
  },
});
