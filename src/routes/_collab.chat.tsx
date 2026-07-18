import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_collab/chat")({
  beforeLoad: () => {
    throw redirect({ to: "/messages" });
  },
});
