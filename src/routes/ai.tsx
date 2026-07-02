import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CmaLayout } from "@/components/cma/Layout";

export const Route = createFileRoute("/ai")({
  component: () => (
    <CmaLayout>
      <Outlet />
    </CmaLayout>
  ),
});
