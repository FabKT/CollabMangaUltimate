import { createFileRoute } from "@tanstack/react-router";
import MessagesPrime from "@/features/messages/MessagesPrime";

export const Route = createFileRoute("/_collab/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    conversation:
      typeof search.conversation === "string" && search.conversation.trim()
        ? search.conversation
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages — CollabManga" }] }),
  component: MessagesRoute,
});

function MessagesRoute() {
  const { conversation } = Route.useSearch();
  return <MessagesPrime initialConversationId={conversation} />;
}
