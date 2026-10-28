import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Circle, Lock } from "lucide-react";
import { toast } from "sonner";
import { NEED_DE, productsOf } from "@/lib/engine";
import { actions, useStore } from "@/lib/store";
import { daysFromToday } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { Funki } from "@/components/funki/Funki";
import { PillButton } from "@/components/base/PillButton";
import { STROKE } from "@/components/portal/icons";
import { usePortal } from "@/components/portal/use-portal";
import { cn } from "@/lib/utils";
import { EcoHomeFull } from "@/components/portal/eco-home";

export const Route = createFileRoute("/portal/journey")({ component: Journey });

const J = PORTAL.journey;

function Journey() {
  const { p, style, t } = usePortal();
  const declared = useStore((s) => (p ? s.declared[p.id] : undefined));
  const skipped = useStore((s) => (p ? s.skipped[p.id] : false));
  const prefs = useStore((s) => (p ? s.prefs[p.id] : undefined));
  if (!p) return null;
  const du = style.anrede === "du";

  if (!p.profiling) {
    return (
      <div className="space-y-8">
        <h1 className="type-headline">{t(J.title)}</h1>
        <EcoHomeFull />
        <section className="rounded-[24px] bg-mg-surface p-6">
          <h2 className="type-section">{t(PORTAL.sections.contracts)}</h2>
          <ul className="mt-3 space-y-2">{productsOf(p.raw).map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
        <section className="flex items-start gap-4 rounded-[24px] border-2 border-mg-line p-6">
          <Lock className="mt-1 size-6 shrink-0" strokeWidth={STROKE} />
          <div>
            <h2 className="font-bold">{J.offTitle}</h2>
            <p className="mt-1 text-mg-muted">{t(J.offText)}</p>
            <Link to="/portal/service" hash="datenschutz" className="mt-3 inline-flex min-h-11 items-center font-semibold text-mg-navy underline underline-offset-4">{J.offLink}</Link>
          </div>
        </section>
      </div>
    );
  }

  const relevant = p.needs.filter((n) => n.id !== "N08" && n.score >= 35 && n.evidence.length > 0).sort((a, b) => b.score - a.score);
  const covered = relevant.filter((n) => n.fulfilled);
  const open = relevant.filter((n) => !n.fulfilled);
  const meterAge = daysFromToday(p.raw.electricity?.lastMeterReadingAt ?? p.raw.gas?.lastMeterReadingAt);
  const steps = [
    { label: J.steps.portal, done: p.raw.portal },
    { label: J.steps.app, done: p.raw.app },
    { label: J.steps.meter, done: meterAge !== null && -meterAge <= PORTAL.meterOverdueDays },
    { label: J.steps.frequency, done: !!prefs },
    { label: J.steps.question, done: declared?.heating !== undefined || declared?.ev !== undefined || skipped },
  ];
  const askHeating = !declared?.heating;
  const askEv = declared?.ev === undefined && !p.raw.autostrom;
  const answer = (d: Parameters<typeof actions.declare>[1]) => { actions.declare(p.id, d); toast.success(J.thanks); };

  return (
    <div className="space-y-10">
      <h1 className="type-headline">{t(J.title)}</h1>
      <EcoHomeFull />

      <section aria-label="EcoLevel" className="rounded-[24px] bg-mg-surface p-6">
        <ol className="grid gap-4 md:grid-cols-4 md:gap-2">
          {J.stations.map((s, i) => {
            const level = i + 1, here = level === p.ecoLevel, done = level < p.ecoLevel;
            return (
              <li key={s.name} aria-current={here ? "step" : undefined} className="flex items-center gap-3 md:flex-col md:items-start">
                <div className="flex items-center gap-2 md:w-full">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border-2 font-bold tabular-nums",
                    here ? "border-mg-navy bg-mg-navy text-white" : done ? "border-mg-navy bg-white text-mg-navy" : "border-mg-line bg-white text-mg-muted")}>
                    {done ? <Check className="size-5" strokeWidth={2.25} /> : level}
                  </span>
                  <span aria-hidden className={cn("hidden h-0.5 flex-1 md:block", level < 4 ? (done || here ? "bg-mg-navy" : "bg-mg-line") : "bg-transparent")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-bold", !here && !done && "text-mg-muted")}>{s.name}</p>
                  {here && <p className="type-small text-mg-muted">{du ? s.text : J.stationsSie[i]}</p>}
                </div>
                {here && <Funki mood="idle" size={48} className="md:mt-1" />}
              </li>
            );
          })}
        </ol>
        <p className="mt-5 type-small text-mg-muted">{t(J.levelNote)}</p>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="covered-title">
          <h2 id="covered-title" className="type-section">{t(J.covered)}</h2>
          {covered.length ? (
            <ul className="mt-4 space-y-3">
              {covered.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-mg-yellow text-mg-navy"><Check className="size-4" strokeWidth={2.25} /></span>
                  <span><span className="font-semibold">{NEED_DE[n.id]}</span>{n.existing && <span className="block type-small text-mg-muted">{n.existing}</span>}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-mg-muted">{J.noneCovered}</p>}
        </section>
        <section aria-labelledby="open-title">
          <h2 id="open-title" className="type-section">{t(J.open)}</h2>
          {open.length ? (
            <ul className="mt-4 space-y-3">
              {open.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <Circle className="mt-0.5 size-7 shrink-0 text-mg-line" strokeWidth={STROKE} />
                  <span><span className="font-semibold">{NEED_DE[n.id]}</span>{n.solution && <span className="block type-small text-mg-muted">{n.solution}</span>}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-mg-muted">{J.noneOpen}</p>}
        </section>
      </div>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="type-section">{J.stepsTitle}</h2>
        <ul className="mt-4 divide-y divide-mg-line border-y border-mg-line">
          {steps.map((s) => (
            <li key={s.label} className="flex min-h-12 items-center gap-3 py-2">
              {s.done
                ? <span className="grid size-7 place-items-center rounded-full bg-mg-navy text-white"><Check className="size-4" strokeWidth={2.25} /><span className="sr-only">{J.stepDone}</span></span>
                : <span className="size-7 rounded-full border-2 border-mg-line"><span className="sr-only">{J.stepOpen}</span></span>}
              <span className={cn(s.done && "text-mg-muted")}>{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="move-title" className="rounded-[24px] border-2 border-mg-line p-6">
        <h2 id="move-title" className="font-bold">{t(J.moving)}</h2>
        <p className="mt-1 type-small text-mg-muted">{t(J.movingWhy)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {declared?.moving
            ? <p className="font-semibold">{t(J.movingDone)}</p>
            : <PillButton variant="outline" size="sm" onClick={() => { actions.declare(p.id, { moving: true }); toast.success(t(J.movingDone)); }}>{J.yes}</PillButton>}
        </div>
      </section>

      {!skipped && (askHeating || askEv) && (
        <section aria-labelledby="q-title" className="rounded-[24px] border-2 border-mg-line p-6">
          <h2 id="q-title" className="font-bold">{J.questionTitle}</h2>
          <p className="mt-1 type-small text-mg-muted">{t(J.questionWhy)}</p>
          <p className="mt-4 font-semibold">{t(askHeating ? J.heating : J.ev)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {askHeating
              ? J.heatingOptions.map((o) => <PillButton key={o.value} variant="outline" size="sm" onClick={() => answer({ heating: o.value })}>{o.label}</PillButton>)
              : (<>
                  <PillButton variant="outline" size="sm" onClick={() => answer({ ev: true })}>{J.yes}</PillButton>
                  <PillButton variant="outline" size="sm" onClick={() => answer({ ev: false })}>{J.no}</PillButton>
                </>)}
            <PillButton variant="link" size="sm" onClick={() => actions.skip(p.id)}>{J.skip}</PillButton>
          </div>
        </section>
      )}
    </div>
  );
}
