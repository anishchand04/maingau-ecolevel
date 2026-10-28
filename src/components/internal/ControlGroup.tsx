import { pct } from "@/lib/engine";
import type { Reaction } from "@/lib/data";
import { OBSERVED_NOTE, SMALL_GROUP } from "@/config/internal";
import { DataBadge } from "@/components/base/StatusBadge";
import { Section } from "./ui";

const rate = (a: number, b: number) => (b ? pct(a / b, 1) : "—");

/** Control vs. treated – never without the "observed, not causal" note; small groups get a warning. */
export function ControlGroup({ treated, control }: { treated: Reaction; control: Reaction }) {
  const small = control.n < SMALL_GROUP || control.converted < 10;
  return (
    <Section title="Kontrollgruppe vs. angesprochen" sub={<span className="font-semibold text-foreground">{OBSERVED_NOTE}</span>}>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Angesprochen</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{rate(treated.converted, treated.n)}</dd><dd className="text-xs text-muted-foreground tabular-nums">{treated.converted} von {treated.n}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Kontrollgruppe</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{rate(control.converted, control.n)}</dd><dd className="text-xs text-muted-foreground tabular-nums">{control.converted} von {control.n}</dd></div>
      </dl>
      {small && (
        <p role="note" className="mt-4 rounded-md border border-border p-2 text-xs">Kleine Gruppe ({control.n} Kunden, {control.converted} Abschlüsse): Der Unterschied kann Zufall sein. Keine Wirkungsaussage ableiten.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground"><DataBadge status="berechnet" /> Quoten aus den Daten; ob die Ansprache den Abschluss verursacht hat, zeigt dieser Vergleich nicht.</p>
    </Section>
  );
}
