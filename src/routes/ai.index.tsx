import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * L'AI Dashboard a été retiré : la page d'accueil de la partie AI
 * est désormais le Manga Page Creator.
 */
export const Route = createFileRoute("/ai/")({
  beforeLoad: () => {
    throw redirect({ to: "/ai/manga-page" });
  },
});
