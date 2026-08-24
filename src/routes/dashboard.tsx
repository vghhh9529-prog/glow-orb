import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: () => <Outlet />,
});
