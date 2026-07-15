import { createFileRoute } from "@tanstack/react-router";
import MessagesPrime from "@/features/messages/MessagesPrime";

export const Route = createFileRoute("/_collab/messages")({
  head: () => ({ meta: [{ title: "Messages — CollabManga" }] }),
  component: MessagesPrime,
});
