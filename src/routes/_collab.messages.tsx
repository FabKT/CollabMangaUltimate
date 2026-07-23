import { createFileRoute } from "@tanstack/react-router";
import MessagesPrime from "@/features/messages/MessagesPrime";

export const Route = createFileRoute("/_collab/messages")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    conversation?: string;
    sponsorship?: string;
    channel?: "amis" | "projets" | "parrainages";
  } => ({
    conversation:
      typeof search.conversation === "string" && search.conversation.trim()
        ? search.conversation
        : undefined,
    sponsorship:
      typeof search.sponsorship === "string" && search.sponsorship.trim()
        ? search.sponsorship
        : undefined,
    channel:
      search.channel === "amis" || search.channel === "projets" || search.channel === "parrainages"
        ? search.channel
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages — CollabManga" }] }),
  component: MessagesRoute,
});

function MessagesRoute() {
  const { conversation, sponsorship, channel } = Route.useSearch();
  return (
    <MessagesPrime
      initialConversationId={conversation}
      initialSponsorshipId={sponsorship}
      initialChannel={channel}
    />
  );
}
