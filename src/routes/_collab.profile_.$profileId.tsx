import { createFileRoute } from "@tanstack/react-router";
import { PublicProfilePage } from "./_collab.profile";

// The trailing underscore on `profile_` keeps this URL under the Collab
// layout without nesting it below the `/profile` page component. Otherwise
// the parent own-profile page masks this public profile route.
export const Route = createFileRoute("/_collab/profile_/$profileId")({
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
