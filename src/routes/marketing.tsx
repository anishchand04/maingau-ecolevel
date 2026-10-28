import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InternalShell } from "@/components/internal/ui";

export const Route = createFileRoute("/marketing")({
  head: () => ({ meta: [{ title: "Marketing · MAINGAU EcoLevel" }] }),
  component: () => <InternalShell area="marketing"><Outlet /></InternalShell>,
});
