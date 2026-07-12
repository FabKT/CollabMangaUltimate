import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CollabLayout } from "@/components/collab/CollabLayout";

export const Route = createFileRoute("/_collab")({
  component: () => (
    <CollabLayout>
      <Outlet />
    </CollabLayout>
  ),
});
