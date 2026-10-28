import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PORTAL } from "@/config/portal";
import { DemoBar, MobileNav, PortalHeader, PortalSearch, PortalTabs } from "@/components/portal/shell";
import { usePortal } from "@/components/portal/use-portal";
import { SkeletonBlock } from "@/components/base/EmptyState";
import { FunkiChat } from "@/components/funki/FunkiChat";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: PORTAL.meta.title }, { name: "description", content: PORTAL.meta.description }] }),
  component: PortalLayout,
});

function PortalLayout() {
  const { p } = usePortal();
  return (
    <div className="theme-portal min-h-screen">
      <DemoBar />
      <PortalHeader />
      <PortalTabs />
      <main className="mx-auto max-w-[1120px] px-4 pt-6 pb-28 md:px-8 md:pb-12">
        <div className="mb-8"><PortalSearch /></div>
        {p ? <Outlet /> : (
          <div className="space-y-4" aria-busy="true">
            <SkeletonBlock className="h-10 w-2/3" />
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-28" />
          </div>
        )}
      </main>
      <footer className="mx-auto max-w-[1120px] px-4 pb-28 type-small text-mg-muted md:px-8 md:pb-10">{PORTAL.footer}</footer>
      <MobileNav />
      <FunkiChat />
    </div>
  );
}
