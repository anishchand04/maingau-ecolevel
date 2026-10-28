// Mein Eco-Zuhause: tile on "Mein Zuhause", full view in "Meine EcoJourney".
import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { computeEcoHome, levelIndex, shownScore } from "@/lib/ecoHome";
import { fill } from "@/lib/portal";
import { ECO_BASE, ECO_LEVELS, ECO_TEXT as E } from "@/config/ecoHome";
import { Funki } from "@/components/funki/Funki";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { usePortal } from "./use-portal";

export function useEcoHome() {
  const { p } = usePortal();
  const id = p?.id ?? "";
  const self = useStore((s) => s.ecoSelf[id]);
  const best = useStore((s) => s.ecoBest[id]);
  const off = useStore((s) => s.ecoOff[id] ?? false);
  const readings = useStore((s) => s.meterReadings[id]?.length ?? 0);
  const res = useMemo(() => (p ? computeEcoHome(p.raw, { self: self ?? [], meterReadings: readings, profiling: p.profiling }) : null), [p, self, readings]);
  // never sinks: remember the best score shown
  useEffect(() => { if (res && id) actions.raiseEcoBest(id, res.score); }, [res, id]);
  if (!res) return null;
  const score = shownScore(res.score, best);
  return { ...res, score, level: levelIndex(score), off, profiling: p!.profiling, id };
}

export function EcoTile() {
  const eco = useEcoHome();
  const { t } = usePortal();
  if (!eco || eco.off) return null;
  return (
    <section aria-labelledby="eco-tile" className="flex flex-wrap items-center gap-5 rounded-[24px] bg-mg-yellow-soft p-6">
      <Funki mood="happy" glow={eco.level} size={64} decorative />
      <div className="min-w-0 flex-1">
        <h2 id="eco-tile" className="font-bold">{E.title}</h2>
        <p className="mt-1"><span className="text-2xl font-extrabold tabular-nums">{eco.score}</span> <span className="text-mg-muted">{E.of} · {ECO_LEVELS[eco.level].name}</span></p>
        <p className="type-small text-mg-muted">{eco.next ? fill(t(E.next), { n: eco.next.missing, level: eco.next.name, step: eco.next.step }) : t(E.top)}</p>
      </div>
      <Link to="/portal/journey" hash="eco" className="inline-flex min-h-12 items-center rounded-full border-2 border-mg-navy px-5 font-semibold text-mg-navy hover:bg-white focus-visible:outline-2 focus-visible:outline-mg-blue">{E.tileCta}</Link>
    </section>
  );
}

export function EcoHomeFull() {
  const eco = useEcoHome();
  const { style, t } = usePortal();
  if (!eco) return null;
  const du = style.anrede === "du";
  if (eco.off) return <section id="eco" className="rounded-[24px] border-2 border-dashed border-mg-line p-6 text-mg-muted">{t(E.off)}</section>;
  const earned = eco.items.filter((i) => i.earned);
  const open = eco.items.filter((i) => !i.earned && i.source === "daten");
  const selfItems = eco.items.filter((i) => i.source === "selbst");
  return (
    <section id="eco" aria-labelledby="eco-title" className="scroll-mt-24 space-y-6 rounded-[24px] bg-mg-yellow-soft p-6">
      <div className="flex flex-wrap items-start gap-5">
        <Funki mood="happy" glow={eco.level} size={88} decorative />
        <div className="min-w-0 flex-1">
          <h2 id="eco-title" className="type-section">{E.title}</h2>
          <p className="mt-1 text-mg-muted">{t(E.intro)}</p>
          <p className="mt-3"><span className="text-4xl font-extrabold tabular-nums">{eco.score}</span> <span className="text-mg-muted">{E.of}</span></p>
          <p className="mt-1 font-semibold">{eco.next ? fill(t(E.next), { n: eco.next.missing, level: eco.next.name, step: eco.next.step }) : t(E.top)}</p>
          {!eco.profiling && <p className="mt-2 type-small text-mg-muted">{t(E.noConsent)}</p>}
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-4">
        {ECO_LEVELS.map((l, i) => (
          <li key={l.name} aria-current={i === eco.level ? "step" : undefined}
            className={cn("rounded-2xl border-2 bg-white p-3", i === eco.level ? "border-mg-navy" : "border-transparent", i > eco.level && "opacity-70")}>
            <p className="type-small text-mg-muted tabular-nums">ab {l.min}</p>
            <p className="font-bold">{l.name}</p>
            <p className="mt-1 text-sm text-mg-muted">{l.reward}</p>
          </li>
        ))}
      </ol>
      <p className="type-small text-mg-muted">{E.rewardNote}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-bold">{E.earned}</h3>
          <ul className="mt-2 space-y-2">
            <li className="flex justify-between gap-3"><span>{E.base}</span><span className="tabular-nums">{ECO_BASE}</span></li>
            {eco.bonus > 0 && <li className="flex justify-between gap-3"><span>{E.bonus}</span><span className="tabular-nums">+{eco.bonus}</span></li>}
            {earned.map((i) => <li key={i.id} className="flex justify-between gap-3"><span className="flex gap-2"><Check className="mt-1 size-4 shrink-0" strokeWidth={2.25} />{i.label}</span><span className="tabular-nums">+{i.points}</span></li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-bold">{du ? E.open : E.openSie}</h3>
          <ul className="mt-2 space-y-2">
            {open.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.step}</span><span className="tabular-nums text-mg-muted">+{i.points}</span></li>)}
            {!open.length && <li className="text-mg-muted">—</li>}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="font-bold">{du ? E.selfTitle : E.selfTitleSie}</h3>
        <p className="type-small text-mg-muted">{E.selfHint}</p>
        <ul className="mt-2 divide-y divide-mg-line rounded-2xl bg-white px-4">
          {selfItems.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 py-3">
              <span>{i.label} <span className="type-small text-mg-muted tabular-nums">+{i.points}</span></span>
              <Switch checked={i.earned} aria-label={i.label} onCheckedChange={(v) => actions.toggleEcoSelf(eco.id, i.id, v)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
