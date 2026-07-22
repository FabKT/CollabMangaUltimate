import { createFileRoute } from "@tanstack/react-router";
import MessagesPrime from "@/features/messages/MessagesPrime";

export const Route = createFileRoute("/_collab/messages")({
  validateSearch: (search: Record<string, unknown>): { conversation?: string; sponsorship?: string } => ({
    conversation:
      typeof search.conversation === "string" && search.conversation.trim()
        ? search.conversation
        : undefined,
    sponsorship:
      typeof search.sponsorship === "string" && search.sponsorship.trim()
        ? search.sponsorship
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages — CollabManga" }] }),
  component: MessagesRoute,
});

function MessagesRoute() {
  const { conversation, sponsorship } = Route.useSearch();
  return <MessagesPrime initialConversationId={conversation} initialSponsorshipId={sponsorship} />;
}
