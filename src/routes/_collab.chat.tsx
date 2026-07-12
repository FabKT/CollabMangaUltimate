import { createFileRoute } from "@tanstack/react-router";
import ChatIndex from "@/features/chat/ChatIndex";

export const Route = createFileRoute("/_collab/chat")({
  component: ChatIndex,
});
