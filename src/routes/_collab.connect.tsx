import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_collab/connect")({
  beforeLoad: () => {
    throw redirect({ to: "/messages" });
  },
});
