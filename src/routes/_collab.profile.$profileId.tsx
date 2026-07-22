import { createFileRoute } from "@tanstack/react-router";
import { PublicProfilePage } from "./_collab.profile";

export const Route = createFileRoute("/_collab/profile/$profileId")({
  head: () => ({
    meta: [
      { title: "Profil public - CollabManga" },
      { name: "description", content: "Profil public d'un membre CollabManga." },
    ],
  }),
  component: OtherProfileRoute,
});

function OtherProfileRoute() {
  const { profileId } = Route.useParams();
  return <PublicProfilePage key={profileId} profileId={profileId} />;
}
