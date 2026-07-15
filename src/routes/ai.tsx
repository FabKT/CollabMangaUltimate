import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CmaLayout } from "@/components/cma/Layout";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/ai")({
  component: () => (
    <RequireAuth>
      <CmaLayout>
        <Outlet />
      </CmaLayout>
    </RequireAuth>
  ),
});
