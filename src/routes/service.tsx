import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InternalShell } from "@/components/internal/ui";

export const Route = createFileRoute("/service")({
  head: () => ({ meta: [{ title: "Service · MAINGAU EcoLevel" }] }),
  component: () => <InternalShell area="service"><Outlet /></InternalShell>,
});
