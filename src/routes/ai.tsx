import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CmaLayout } from "@/components/cma/Layout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { isLocalAiClientMode } from "@/lib/local-ai-mode";

export const Route = createFileRoute("/ai")({
  component: () => {
    const content = (
      <CmaLayout>
        <Outlet />
      </CmaLayout>
    );
    return isLocalAiClientMode ? content : <RequireAuth>{content}</RequireAuth>;
  },
});
