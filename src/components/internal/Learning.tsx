import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { pct, productById, ENGINE_VERSION } from "@/lib/engine";
import { useProfiles } from "@/lib/live";
import { actions, getState, useStore } from "@/lib/store";
import { activeRates, baseRate, historicalOutcomes, proposeRates, simTruth, upliftByOffer, versionLabel, type HistoryPoint } from "@/lib/learning";
import { CHANNEL_DE, LEARN_TEXT } from "@/config/internal";
import { LEARNING } from "@/config/thresholds";
import { DataBadge } from "@/components/base/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Section, td, th } from "./ui";
import { cn } from "@/lib/utils";

const rate = (a: number, n: number) => (n ? pct(a / n, 1) : "—");
const pp = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %-Pkt.`;
const name = (id: string) => productById(id)?.product_name ?? id;
const cellName = (key: string) => { const [o, c] = key.split("|"); return `${name(o)} · ${CHANNEL_DE[c] ?? c}`; };
const pc = (v: number) => `${(v * 100).toFixed(1)} %`;

/** Automatic run (demo): contacts the next customers every tick while this view is open and auto mode is on. */
function useAutoRun(auto: boolean) {
  const profiles = useProfiles();
  const outcomes = useStore((s) => s.learning.outcomes);
  const candidates = useMemo(() => {
    const done = new Set(outcomes.map((o) => `${o.customerId}:${o.offer}`));
    return profiles
      .filter((p) => p.nba.action === "SELL" && p.nba.policy === "eligible" && p.nba.dClv > 0 && p.nba.channel && !done.has(`${p.id}:${p.nba.productId}`))
      .map((p) => ({ customerId: p.id, offer: p.nba.productId, channel: p.nba.channel! }));
  }, [profiles, outcomes]);
  const latest = useRef(candidates);
  latest.current = candidates;
  const running = auto && candidates.length > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      // filter against the live store, not the last render: several ticks may run between two renders
      const done = new Set(getState().learning.outcomes.map((o) => `${o.customerId}:${o.offer}`));
      const b = latest.current.filter((c) => !done.has(`${c.customerId}:${c.offer}`)).slice(0, LEARNING.autoBatch);
      if (b.length) actions.learnTick(b, true);
    }, LEARNING.autoTickMs);
    return () => clearInterval(t);
  }, [running]);
  return { running, remaining: candidates.length };
}

/** Mean distance of the engine's rates from the (demo) real rates over all cells with data – falls when the engine learns. */
function errorSeries(history: HistoryPoint[]) {
  return history.map((h, i) => {
    const cells = Object.entries(h.cells).filter(([, c]) => c.n >= 10);
    const mean = (f: (k: string, c: HistoryPoint["cells"][string]) => number) => (cells.length ? (cells.reduce((s, [k, c]) => s + f(k, c), 0) / cells.length) * 100 : null);
    const at = (k: string) => k.split("|") as [string, string];
    return {
      step: h.step, cells: cells.length, version: h.version, newVersion: i > 0 && history[i - 1].version !== h.version,
      lernend: mean((k, c) => Math.abs(c.active - simTruth(...at(k)))),
      basis: mean((k) => Math.abs(baseRate(...at(k)) - simTruth(...at(k)))),
    };
  }).filter((d) => d.lernend !== null);
}

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };

/** Learning loop: automatic live run with curves, holdout, random uplift, versions. Learning changes estimates only, never a rule. */
export function Learning() {
  const L = useStore((s) => s.learning);
  const { running, remaining } = useAutoRun(L.auto);
  const upl = useMemo(() => upliftByOffer(L.outcomes), [L.outcomes]);
  const open = L.outcomes.filter((o) => o.converted === null).length;
  const closed = L.outcomes.length - open;
  const preview = useMemo(() => proposeRates(L.outcomes, activeRates(L.versions, L.activeId)), [L.outcomes, L.versions, L.activeId]);
  const hist = useMemo(historicalOutcomes, []);
  const err = useMemo(() => errorSeries(L.history), [L.history]);
  const cellsNow = useMemo(() => Object.entries(L.history.at(-1)?.cells ?? {}).sort((a, b) => b[1].n - a[1].n), [L.history]);
  const [picked, setPicked] = useState<string | null>(null);
  const cell = picked && cellsNow.some(([k]) => k === picked) ? picked : cellsNow[0]?.[0] ?? null;
  const detail = useMemo(() => (cell ? L.history.filter((h) => h.cells[cell]).map((h, i, a) => ({ step: h.step, aktiv: h.cells[cell].active * 100, daten: h.cells[cell].est * 100, newVersion: i > 0 && a[i - 1].version !== h.version })) : []), [L.history, cell]);
  const [off, on] = [err[0], err.at(-1)];
  const total = L.outcomes.length + remaining;

  return (
    <Section title={LEARN_TEXT.title} sub={LEARN_TEXT.intro}>
      <div className="space-y-8 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <Switch checked={L.auto} onCheckedChange={(v) => actions.setAuto(v)} aria-label="Automatisch lernen" />Automatisch lernen
          </label>
          <p className="text-muted-foreground">
            {L.auto ? (running ? <span className="font-medium text-foreground">Läuft: {L.outcomes.length} von {total} Kunden verarbeitet</span> : L.outcomes.length ? "Lauf beendet: alle Kunden verarbeitet" : "Wartet auf Kunden mit Empfehlung") : "Aus: Versionen brauchen eine Freigabe (siehe unten)."}
          </p>
          <p><span className="text-muted-foreground">Aktive Version:</span> <b className="tabular-nums">{versionLabel(L.activeId)}</b>{!L.activeId && <span className="text-muted-foreground"> (Basis {ENGINE_VERSION})</span>}</p>
          <div className="ml-auto flex gap-2">
            {L.activeId && <Button size="sm" variant="outline" onClick={() => actions.rollbackVersion()}>Zurückrollen</Button>}
            <Button size="sm" variant="ghost" disabled={!L.outcomes.length && !L.versions.length} onClick={() => { actions.resetLearning(); toast("Lernstand zurückgesetzt"); }}>Neu starten</Button>
          </div>
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          <DataBadge status="simuliert" className="mr-1" />{LEARN_TEXT.simulatedNote} Der Lauf nutzt für die Demo einen zufälligen Holdout von mindestens {LEARNING.autoHoldoutPct} %. Er schreibt keine Freigaben und sendet nichts.
        </p>

        <figure aria-label="Abstand der Engine-Annahmen von den tatsächlichen Quoten über die Zeit">
          <figcaption className="flex flex-wrap items-center gap-2"><h3 className="font-medium">Wie nah liegt die Engine an der Realität?</h3><DataBadge status="simuliert" /></figcaption>
          <p className="mt-1 text-xs text-muted-foreground">Mittlerer Abstand der Annahmequote von der (nur in der Demo bekannten) tatsächlichen Quote, über alle Angebote und Kanäle mit mindestens 10 Ergebnissen. Fällt die Linie, lernt die Engine.</p>
          {err.length > 1 ? (
            <>
              <div className="mt-2 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={err} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="step" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} label={{ value: "Schritt", position: "insideBottomRight", offset: -2, fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Number(v).toFixed(0)}`} unit=" PP" domain={[0, "auto"]} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)} %-Pkt.`} labelFormatter={(l) => `Schritt ${l}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {err.filter((d) => d.newVersion).map((d) => <ReferenceLine key={d.step} x={d.step} stroke="var(--border)" strokeDasharray="2 3" label={{ value: d.version ?? "Basis", position: "top", fontSize: 11, fill: "var(--muted-foreground)" }} />)}
                    <Line name="Basis (ohne Lernen)" dataKey="basis" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line name="Engine (lernend)" dataKey="lernend" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {off && on && <p className="mt-1 text-xs" aria-live="polite">Abstand am Anfang <b className="tabular-nums">{(off.lernend ?? 0).toFixed(2)}</b> → jetzt <b className="tabular-nums">{(on.lernend ?? 0).toFixed(2)}</b> %-Punkte, Basis ohne Lernen <b className="tabular-nums">{(on.basis ?? 0).toFixed(2)}</b>. Senkrechte Linien: neue Version.</p>}
            </>
          ) : <p className="mt-3 text-muted-foreground">{L.auto ? "Die Kurve erscheint, sobald genug Ergebnisse da sind …" : "Automatisches Lernen einschalten, um die Kurve zu sehen."}</p>}
        </figure>

        {cell && detail.length > 1 && (
          <figure aria-label="Gelernte Annahmequote je Angebot und Kanal">
            <figcaption className="flex flex-wrap items-center gap-2"><h3 className="font-medium">Eine Annahmequote im Detail</h3></figcaption>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Angebot und Kanal wählen">
              {cellsNow.slice(0, 8).map(([k, c]) => (
                <Button key={k} size="sm" variant={k === cell ? "default" : "outline"} aria-pressed={k === cell} onClick={() => setPicked(k)}>{cellName(k)} <span className="tabular-nums opacity-70">({c.n})</span></Button>
              ))}
            </div>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={detail} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="step" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} unit=" %" domain={[0, "auto"]} tickFormatter={(v) => Number(v).toFixed(0)} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)} %`} labelFormatter={(l) => `Schritt ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={simTruth(...(cell.split("|") as [string, string])) * 100} stroke="var(--success)" strokeDasharray="6 4" strokeWidth={2} label={{ value: "tatsächlich (Demo)", position: "insideTopRight", fontSize: 11, fill: "var(--success)" }} />
                  <ReferenceLine y={baseRate(...(cell.split("|") as [string, string])) * 100} stroke="var(--chart-3)" strokeWidth={1.5} label={{ value: "Basis", position: "insideBottomRight", fontSize: 11, fill: "var(--muted-foreground)" }} />
                  {detail.filter((d) => d.newVersion).map((d) => <ReferenceLine key={d.step} x={d.step} stroke="var(--border)" strokeDasharray="2 3" />)}
                  <Line name="Schätzung aus Daten" dataKey="daten" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line name="Annahme der Engine (aktiv)" dataKey="aktiv" type="stepAfter" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Die Engine nähert ihre Annahme schrittweise den Ergebnissen an (höchstens ±{LEARNING.maxRelChange * 100} % je Version). Die grüne Linie kennt nur die Demo, die Engine nie.</p>
          </figure>
        )}

        <div>
          <p className="font-medium">{LEARN_TEXT.holdout}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Holdout-Anteil in der Freigabe-Liste">
            {LEARNING.holdoutOptions.map((v) => (
              <Button key={v} size="sm" variant={L.holdoutPct === v ? "default" : "outline"} aria-pressed={L.holdoutPct === v} onClick={() => actions.setHoldout(v)}>{v === 0 ? "aus" : `${v} %`}</Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{LEARN_TEXT.holdoutHint} Gilt für Freigaben in der Liste und der Kundenakte. Zuweisung per festem Zufallscode je Kunde, damit sie nachprüfbar bleibt.</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Wirkung je Angebot</h3><DataBadge status="simuliert" />
            <span className="text-xs font-semibold">{LEARN_TEXT.randomized}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{closed} Ergebnisse erfasst, {open} offen.</p>
          {!L.auto && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" disabled={!open} onClick={() => { actions.simulateOutcomes(); toast("Offene Ergebnisse simuliert"); }}>Ergebnisse simulieren ({open})</Button>
            </div>
          )}
          {upl.length ? (
            <div className="relative mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className={th}>Angebot</th><th className={`${th} text-right`}>Behandelt</th><th className={`${th} text-right`}>Kontrolle</th><th className={`${th} text-right`}>Uplift</th><th className={th}>Aussage</th></tr></thead>
                <tbody>{upl.map((u) => (
                  <tr key={u.offer} className="border-b border-border last:border-0 align-top">
                    <td className={td}>{name(u.offer)}</td>
                    <td className={`${td} text-right tabular-nums`}>{rate(u.treated.conversions, u.treated.n)} <span className="text-xs text-muted-foreground">({u.treated.conversions}/{u.treated.n})</span></td>
                    <td className={`${td} text-right tabular-nums`}>{rate(u.control.conversions, u.control.n)} <span className="text-xs text-muted-foreground">({u.control.conversions}/{u.control.n})</span></td>
                    <td className={`${td} text-right tabular-nums`}>{u.enough ? `${pp(u.uplift)} (${pp(u.ci[0])} bis ${pp(u.ci[1])})` : "—"}</td>
                    <td className={cn(td, !u.enough && "text-muted-foreground")}>{u.enough ? "Intervall 95 %" : LEARN_TEXT.notEnough}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-muted-foreground">Noch keine Ergebnisse.</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Zum Vergleich, historisch ({LEARN_TEXT.observed}): angesprochen {rate(hist.treated.conversions, hist.treated.n)} ({hist.treated.n}), alte Kontrollgruppe {rate(hist.control.conversions, hist.control.n)} ({hist.control.n}). Diese Zeilen ändern keine Rate.
          </p>
        </div>

        {!L.auto && (
          <div>
            <h3 className="font-medium">Vorgeschlagene Anpassung</h3>
            <p className="mt-1 text-xs text-muted-foreground">Quelle: nur behandelte Kunden mit erfasstem Ergebnis (mindestens {LEARNING.minCellN} je Angebot und Kanal). Änderung je Schritt höchstens ±{LEARNING.maxRelChange * 100} %. Regeln und Guardrails bleiben unberührt.</p>
            {preview.changes.length ? (
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b border-border"><th className={th}>Angebot · Kanal</th><th className={`${th} text-right`}>n</th><th className={`${th} text-right`}>Abschlüsse</th><th className={`${th} text-right`}>Rate alt → neu</th></tr></thead>
                <tbody>{preview.changes.map((c) => (
                  <tr key={`${c.offer}${c.channel}`} className="border-b border-border last:border-0">
                    <td className={td}>{name(c.offer)} · {CHANNEL_DE[c.channel] ?? c.channel}</td><td className={`${td} text-right tabular-nums`}>{c.n}</td><td className={`${td} text-right tabular-nums`}>{c.conversions}</td>
                    <td className={`${td} text-right tabular-nums`}>{pc(c.from)} → {pc(c.to)}</td>
                  </tr>))}
                </tbody>
              </table>
            ) : <p className="mt-2 text-muted-foreground">Noch zu wenig Daten für eine Anpassung. Die Raten bleiben, wie sie sind.</p>}
            <div className="mt-3"><Button size="sm" disabled={!preview.changes.length} onClick={() => { const id = actions.proposeVersion(); toast(id ? `Vorschlag ${id} erstellt` : "Keine Änderung nötig"); }}>Vorschlag als Version speichern</Button></div>
          </div>
        )}

        {L.versions.length > 0 && (
          <div>
            <h3 className="font-medium">Versionen</h3>
            <ul className="mt-2 divide-y divide-border">
              {[...L.versions].reverse().map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
                  <b className="tabular-nums">{v.id}</b>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">{{ proposed: "vorgeschlagen", active: "aktiv", archived: "archiviert", rejected: "verworfen", rolled_back: "zurückgerollt" }[v.status]}</span>
                  {v.auto && <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">automatisch</span>}
                  <span className="text-muted-foreground">{new Date(v.at).toLocaleString("de-DE")} · {v.note} · Vorgänger {v.parent ?? "Basis"}</span>
                  {v.status === "proposed" && (
                    <span className="ml-auto flex gap-1">
                      <Button size="sm" onClick={() => { actions.activateVersion(v.id); toast(`${v.id} ist aktiv`); }}>Freigeben</Button>
                      <Button size="sm" variant="ghost" onClick={() => actions.rejectVersion(v.id)}>Verwerfen</Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
