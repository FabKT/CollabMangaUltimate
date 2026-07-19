import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog/$id")({
  component: Outlet,
});
