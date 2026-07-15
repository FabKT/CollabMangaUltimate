import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CollabLayout } from "@/components/collab/CollabLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/_collab")({
  component: () => (
    <RequireAuth>
      <CollabLayout>
        <Outlet />
      </CollabLayout>
    </RequireAuth>
  ),
});
