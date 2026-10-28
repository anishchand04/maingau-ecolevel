import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { eur, pct } from "@/lib/engine";
import { useProfiles } from "@/lib/live";
import { useStore } from "@/lib/store";
import { avgClv, blockedByReason, churnSignals, consentShares, crossSellRate, decisionMix, expectedValue, pgEnding, segments, topActions } from "@/lib/marketing";
import { clusterDe, productDe, reasonDe } from "@/lib/explain";
import { placeholderName } from "@/config/names";
import { BLOCK_REASON_DE, ECO_DE } from "@/config/internal";
import { NBA_STATS } from "@/lib/data";
import { DecisionBadge, DataBadge } from "@/components/base/StatusBadge";
import { SegmentScatter, PgBars } from "@/components/internal/charts";
import { Bars, Kpi, PageTitle, Section, TabBar, td, th } from "@/components/internal/ui";

export const Route = createFileRoute("/marketing/")({
  head: () => ({ meta: [{ title: "Übersicht · Marketing" }] }),
  component: Overview,
});

type Tab = "aktionen" | "signale";

function Overview() {
  const profiles = useProfiles();
  const decisions = useStore((s) => s.decisions);
  const cases = useStore((s) => s.cases);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("aktionen");
  const [allSeg, setAllSeg] = useState(false);
  const pg = useMemo(() => pgEnding(profiles), [profiles]);
  const seg = useMemo(() => segments(profiles), [profiles]);
  const mix = decisionMix(profiles);
  const blocked = useMemo(() => Object.entries(blockedByReason(profiles)).sort((a, b) => b[1] - a[1]), [profiles]);
  const top = useMemo(() => topActions(profiles, (id, pid) => !!decisions[`${id}:${pid}`]), [profiles, decisions]);
  const consents = useMemo(() => consentShares(profiles), [profiles]);
  const signals = useMemo(() => churnSignals(profiles, cases), [profiles, cases]);
  const open = (cluster: string, eco: number) => navigate({ to: "/marketing/customers", search: { cluster, eco } });

  return (
    <div className="space-y-6">
      <PageTitle title="Übersicht" sub="Wen verlieren wir, wen können wir ausbauen – und was ist jetzt zu tun? Synthetische Daten, Stand 01.10.2026." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Preisgarantie endet in ≤ 90 Tagen" value={pg.total} status="berechnet" />
        <Kpi label="Cross-Selling-Quote" value={crossSellRate(profiles).toLocaleString("de-DE", { maximumFractionDigits: 2 })} status="berechnet">Ø Geschäftsbereiche pro Kunde</Kpi>
        <Kpi label="Ø Customer Lifetime Value" value={eur(avgClv(profiles))} status="berechnet">Methode {NBA_STATS.clvMethod}</Kpi>
        <Kpi label="Erwarteter Wert der Empfehlungsliste" value={eur(expectedValue(profiles))} status="simuliert">Σ ΔCLV aller SELL- und CARE-Empfehlungen</Kpi>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Section title="Wert und Abwanderungsrisiko je Segment" sub="Eine Blase = ein Segment (Cluster × EcoLevel), Größe = Kundenzahl. Oben rechts: viel Wert, hohes Risiko. Anklicken → Kundenliste.">
          <SegmentScatter rows={seg} onOpen={open} />
        </Section>
        <Section title="Preisgarantie endet" sub="Kunden mit Strom-Preisgarantie, die in den nächsten 90 Tagen ausläuft">
          <PgBars d30={pg.d30} d60={pg.d60} d90={pg.d90} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Verteilung der Empfehlungen">
          <Bars label="SELL, CARE, WAIT" rows={[{ label: "SELL", value: mix.SELL, tone: "sell" }, { label: "CARE", value: mix.CARE, tone: "care" }, { label: "WAIT", value: mix.WAIT, tone: "wait" }]} />
        </Section>
        <Section title="Blockierte Empfehlungen nach Grund" sub="Jeder Kunde einmal pro Grund">
          <Bars label="Blockierte Empfehlungen" rows={blocked.map(([k, v]) => ({ label: BLOCK_REASON_DE[k] ?? k, value: v }))} />
        </Section>
        <Section title="Opt-in je Kanal" sub="Bestimmt, wen Marketing überhaupt ansprechen darf.">
          <Bars label="Opt-in-Anteil je Kanal" rows={consents.map((c) => ({ label: c.label, value: Math.round(c.share * 1000) / 10 }))} format={(v) => `${v.toLocaleString("de-DE")} %`} />
        </Section>
      </div>

      <Section title="Segmente: Cluster × EcoLevel" sub={<>Zeile anklicken → gefilterte Kundenliste. Abwanderung = churn_prob_12m, Modell {NBA_STATS.clvMethod} <DataBadge status="geschaetzt" className="ml-1" /></>}>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className={th}>Cluster</th><th className={th}>EcoLevel</th><th className={`${th} text-right`}>Kunden</th><th className={`${th} text-right`}>Ø CLV</th>
              <th className={`${th} text-right`}>Ø Abwanderung</th><th className={`${th} text-right`}>E-Auto</th><th className={`${th} text-right`}>PV</th><th className={`${th} text-right`}>Wärmepumpe</th><th className={`${th} text-right`}>Smart Meter</th>
            </tr></thead>
            <tbody>
              {(allSeg ? seg : seg.slice(0, 12)).map((r) => (
                <tr key={`${r.cluster}-${r.eco}`} tabIndex={0} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => open(r.cluster, r.eco)} onKeyDown={(e) => e.key === "Enter" && open(r.cluster, r.eco)}>
                  <td className={td}>{clusterDe(r.cluster)}</td>
                  <td className={td}>{r.eco} · {ECO_DE[r.eco - 1]}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.size}</td>
                  <td className={`${td} text-right tabular-nums`}>{eur(r.clv)}</td>
                  <td className={`${td} text-right tabular-nums`}>{pct(r.churn)}</td>
                  {[r.ev, r.pv, r.hp, r.sm].map((v, i) => <td key={i} className={`${td} text-right tabular-nums`}>{pct(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {seg.length > 12 && <button type="button" onClick={() => setAllSeg(!allSeg)} className="mt-3 cursor-pointer text-xs font-semibold underline-offset-4 hover:underline">{allSeg ? "Weniger anzeigen" : `Alle ${seg.length} Segmente anzeigen`}</button>}
      </Section>

      <TabBar label="Details" value={tab} onChange={setTab} tabs={[{ id: "aktionen", label: "Was jetzt zu tun ist" }, { id: "signale", label: "Abwanderungssignale" }]} />

      {tab === "aktionen" && (
        <Section title="Top 10 Aktionen" sub="Noch nicht entschieden, nach erwartetem Wert. Auslaufende Preisgarantie bei hohem CLV kommt von selbst nach oben." action={<Link to="/marketing/recommendations" className="text-xs font-semibold underline-offset-4 hover:underline">Zur Freigabe</Link>}>
          <ol className="divide-y divide-border">
            {top.map((p, i) => (
              <li key={p.id} className="grid grid-cols-[1.5rem_1fr_auto] gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionBadge status={p.nba.action} />
                    <Link to="/marketing/customers" search={{ id: p.id }} className="font-semibold hover:underline">{placeholderName(p.id)}</Link>
                    <span className="text-muted-foreground">{p.id}</span>
                    <span>· {productDe(p.nba)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{reasonDe(p)}</p>
                </div>
                <span className="text-right tabular-nums">{eur(p.nba.dClv)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {tab === "signale" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title={`Kündigungen (${signals.cancellations.length})`} sub="Grund, sofern erfasst">
            <ul className="divide-y divide-border text-sm">
              {signals.cancellations.map((x, i) => <li key={`${x.id}-${i}`} className="flex justify-between gap-2 py-2"><span>{placeholderName(x.id)} <span className="text-muted-foreground">{x.id}</span> · {x.contract}</span><span className="text-muted-foreground">{x.reason ?? "kein Grund"}</span></li>)}
              {!signals.cancellations.length && <li className="py-2 text-muted-foreground">Keine Kündigungen.</li>}
            </ul>
          </Section>
          <Section title={`Zahlungserinnerungen (${signals.dunning.length})`} sub="Anlass für Service, nicht für Verkauf">
            <ul className="divide-y divide-border text-sm">{signals.dunning.map((x) => <li key={x.id} className="flex justify-between py-2"><span>{placeholderName(x.id)} <span className="text-muted-foreground">{x.id}</span></span><span className="tabular-nums">Stufe {x.level}</span></li>)}</ul>
          </Section>
          <Section title={`Offene Abrechnungsfragen (${signals.billing.length})`} sub="Anlass für Service, nicht für Verkauf">
            <ul className="divide-y divide-border text-sm">{signals.billing.map((id) => <li key={id} className="py-2">{placeholderName(id)} <span className="text-muted-foreground">{id}</span></li>)}
              {!signals.billing.length && <li className="py-2 text-muted-foreground">Keine offenen Abrechnungsfragen.</li>}</ul>
          </Section>
        </div>
      )}
    </div>
  );
}
