import { useEffect, useState } from "react";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { fill, hasOpenProblem, headlineOf, daytimeGreeting } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { placeholderFirstName } from "@/config/names";
import { Funki } from "@/components/funki/Funki";
import { HelpCard, PassendCards, QuickActions, RecommendationCard } from "@/components/portal/cards";
import { ContractCards, type ContractId } from "@/components/portal/contracts";
import { EcoTile } from "@/components/portal/eco-home";
import { usePortal } from "@/components/portal/use-portal";

export const Route = createFileRoute("/portal/")({ component: Home });

function Home() {
  const { p, style, t } = usePortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [hour, setHour] = useState<number | null>(null);
  const [openId, setOpenId] = useState<ContractId | null>(null);

  useEffect(() => setHour(new Date().getHours()), []);
  // Search deep link: /portal#vertrag-electricity
  useEffect(() => {
    const m = location.hash.match(/^vertrag-(\w+)$/);
    if (m) setOpenId(m[1] as ContractId);
  }, [location.hash]);

  if (!p) return null;
  const h = headlineOf(p);
  const problem = hasOpenProblem(p);
  const greet = hour === null ? PORTAL.daytime[1].text : daytimeGreeting(hour);
  const name = style.anrede === "du" ? `, ${placeholderFirstName(p.id)}` : "";
  const close = (id: ContractId | null) => {
    setOpenId(id);
    if (!id && location.hash) navigate({ to: "/portal", hash: "", replace: true });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="type-headline">{greet}{name}</h1>
          <p className="mt-2 text-[19px] leading-7 text-mg-muted">{fill(t(PORTAL.headline[h.key]), { n: h.days ?? "" })}</p>
        </div>
        <Funki mood={problem ? "empathetic" : h.key === "fine" ? "happy" : "idle"} size={72} className="shrink-0" />
      </div>
      <HelpCard />
      <RecommendationCard />
      <QuickActions onInvoice={() => {
        navigate({ to: "/portal/service", hash: "rechnungen" });
      }} />
      <ContractCards openId={openId} onOpen={close} />
      <PassendCards />
      <EcoTile />
    </div>
  );
}
