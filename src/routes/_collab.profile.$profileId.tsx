import { createFileRoute } from "@tanstack/react-router";
import { getPublicProfileIdentity, PublicProfilePage } from "./_collab.profile";

export const Route = createFileRoute("/_collab/profile/$profileId")({
  head: ({ params }) => {
    const profile = getPublicProfileIdentity(params.profileId);
    return {
      meta: [
        { title: `${profile.displayName} - CollabManga` },
        {
          name: "description",
          content: `Profil public CollabManga de ${profile.displayName}.`,
        },
      ],
    };
  },
  component: OtherProfileRoute,
});

function OtherProfileRoute() {
  const { profileId } = Route.useParams();
  const identity = getPublicProfileIdentity(profileId);
  return <PublicProfilePage identity={identity} profileId={profileId} />;
}
