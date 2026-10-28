import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
import { gasDeregistered, type Profile } from "@/lib/engine";
import { daysFromToday, fill, fmtDate, hasOpenProblem } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { PillButton } from "@/components/base/PillButton";
import { HelpCard, PassendCards, RecommendationCard } from "@/components/portal/cards";
import { STROKE } from "@/components/portal/icons";
import { usePortal } from "@/components/portal/use-portal";

export const Route = createFileRoute("/portal/benefits")({ component: Benefits });

const B = PORTAL.benefits;

/** Only verifiable advantages from the contracts – no invented euro savings. */
function facts(p: Profile, du: boolean): string[] {
  const c = p.raw, f = B.facts, out: string[] = [];
  if (c.electricity) {
    if (c.electricity.pgUntil && (daysFromToday(c.electricity.pgUntil) ?? -1) >= 0) out.push(fill(f.pg, { date: fmtDate(c.electricity.pgUntil) }));
    if (c.electricity.tariff === "StromWärme") out.push(f.heatTariff);
    if (c.electricity.meter === "smart_meter_imsys") out.push(f.smartMeter);
    if (c.electricity.feedIn) out.push(f.feedIn);
  }
  if (c.autostrom) out.push(f.autostrom);
  if (c.hems) out.push(c.hems.selfConsumption ? fill(f.hemsSelf, { n: c.hems.devices.length, p: Math.round(c.hems.selfConsumption * 100) }) : fill(f.hems, { n: c.hems.devices.length }));
  if (c.mobile) out.push(fill(f.mobile, { plan: c.mobile.plan, gb: c.mobile.gb }));
  const lines = [c.electricity, c.gas && !gasDeregistered(c) ? c.gas : null, c.mobile, c.autostrom, c.hems].filter(Boolean).length;
  if (lines >= 2) out.push(fill(du ? f.bundle.du : f.bundle.sie, { n: lines }));
  return out;
}

function Benefits() {
  const { p, style, t } = usePortal();
  if (!p) return null;
  const e = p.raw.electricity;
  const left = daysFromToday(e?.pgUntil);
  const problem = hasOpenProblem(p);
  const list = facts(p, style.anrede === "du");

  // progress: from contract start (or 24 months before the end) to the end of the guarantee
  let progress: number | null = null;
  if (e?.pgUntil && left !== null) {
    const end = new Date(e.pgUntil).getTime();
    const fallback = new Date(e.pgUntil); fallback.setMonth(fallback.getMonth() - PORTAL.pgMonthsAssumption);
    const start = Math.max(e.startDate ? new Date(e.startDate).getTime() : 0, fallback.getTime());
    progress = Math.min(1, Math.max(0, 1 - (left * 864e5) / (end - start)));
  }
  const pgAction = !problem && left !== null && left <= PORTAL.pgHeadlineDays;

  return (
    <div className="space-y-10">
      <h1 className="type-headline">{t(B.title)}</h1>
      <HelpCard />

      {e && <section aria-labelledby="pg-title" className="rounded-[24px] bg-mg-surface p-6">
        <h2 id="pg-title" className="type-section">{B.pgTitle}</h2>
        {e?.pgUntil && left !== null ? (
          <>
            <p className="mt-2">{fill(t(left >= 0 ? B.pgRunning : B.pgEnded), { date: fmtDate(e.pgUntil), n: Math.max(0, left) })}</p>
            {progress !== null && (
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={B.pgTitle}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full rounded-full bg-mg-navy" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {pgAction && (
              <PillButton asChild className="mt-5"><Link to="/portal/service" hash="selbst-preisgarantie">{B.pgAction}</Link></PillButton>
            )}
          </>
        ) : <p className="mt-2">{t(B.pgNone)}</p>}
      </section>}

      <section aria-labelledby="check-title">
        <h2 id="check-title" className="type-section">{B.checkTitle}</h2>
        <p className="mt-1 text-mg-muted">{t(B.checkIntro)}</p>
        <ul className="mt-4 space-y-3">
          {list.map((x) => (
            <li key={x} className="flex gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-mg-yellow text-mg-navy"><Check className="size-4" strokeWidth={2.25} /></span>
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-4 type-small text-mg-muted">{B.checkNote}</p>
      </section>

      <RecommendationCard />

      <PassendCards detailed />

      <a href={B.worldUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 font-semibold text-mg-navy underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-mg-blue">
        {B.worldLink}<ExternalLink className="size-5" strokeWidth={STROKE} />
      </a>
    </div>
  );
}
