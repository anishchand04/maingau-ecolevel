import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { DEMO_SCENARIOS, DEMO_TEXT as T, type DemoScenario } from "@/config/demo";
import { placeholderName } from "@/config/names";
import { Wordmark } from "@/components/base/Wordmark";
import { useInbox } from "@/components/internal/use-inbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "Demo · MAINGAU EcoLevel" }] }),
  component: Demo,
});

function Demo() {
  const customer = useStore((s) => s.portalCustomer);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [right, setRight] = useState<"marketing" | "service">("marketing");
  const { items } = useInbox();
  const item = items.find((i) => i.customerId === customer && i.filter !== "proaktiv") ?? items.find((i) => i.customerId === customer);
  const rightSrc = right === "marketing" ? `/marketing/customers?id=${customer}` : item ? `/service/fall?key=${encodeURIComponent(item.key)}` : "/service";

  const pick = (s: DemoScenario) => { setScenario(s); setRight(s.right); actions.setPortalCustomer(s.customer); actions.closeChat(); };
  const play = (s: DemoScenario) => { if (s.play) actions.openChat({ customerId: s.customer, ...s.play }); };
  const reset = () => {
    actions.reset();
    try { sessionStorage.clear(); } catch { /* ignore */ }
    setScenario(null);
    toast(T.resetDone);
  };

  return (
    <div className="theme-internal flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/"><Wordmark size="sm" /></Link>
          <h1 className="text-base font-semibold">{T.title}</h1>
          <p className="hidden text-xs text-muted-foreground xl:block">{T.sub}</p>
          <Button className="ml-auto" variant="destructive" onClick={reset}><RotateCcw className="size-4" strokeWidth={1.75} />{T.reset}</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Szenarien">
          {DEMO_SCENARIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => pick(s)} aria-pressed={scenario?.id === s.id}
              className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", scenario?.id === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
              {s.label}
            </button>
          ))}
        </div>
        {scenario && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-semibold">{placeholderName(scenario.customer)} · {scenario.customer}</span>
            <span className="text-muted-foreground">{scenario.hint}</span>
            {scenario.play && <Button size="sm" className="ml-auto" onClick={() => play(scenario)}><Play className="size-4" strokeWidth={1.75} />{T.play}</Button>}
          </div>
        )}
      </header>

      <div className="grid flex-1 gap-px bg-border lg:grid-cols-2">
        <Pane title={`${T.portal} · ${customer}`} src="/portal" />
        <Pane title={right === "marketing" ? T.rightMarketing : T.rightService} src={rightSrc}
          toggle={
            <div className="inline-flex rounded-full border border-border p-0.5 text-xs">
              {(["marketing", "service"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRight(r)} aria-pressed={right === r}
                  className={cn("cursor-pointer rounded-full px-3 py-1", right === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {r === "marketing" ? T.rightMarketing : T.rightService}
                </button>
              ))}
            </div>
          } />
      </div>
    </div>
  );
}

function Pane({ title, src, toggle }: { title: string; src: string; toggle?: React.ReactNode }) {
  return (
    <section className="flex min-h-[80vh] flex-col bg-card lg:min-h-0">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs">
        <span className="font-semibold">{title}</span>
        {toggle}
        <a href={src} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{T.open}<ExternalLink className="size-3.5" strokeWidth={1.75} /></a>
      </div>
      <iframe key={src} src={src} title={title} className="h-full min-h-[75vh] w-full flex-1 border-0 lg:min-h-[calc(100vh-11rem)]" />
    </section>
  );
}
