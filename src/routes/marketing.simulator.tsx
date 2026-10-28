import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { A, DECISION_TIME, ENGINE_VERSION, NEED_DE, eur, guardrails, pct, recompute, type Profile, type RawCustomer } from "@/lib/engine";
import { useProfiles } from "@/lib/live";
import { actions, useStore } from "@/lib/store";
import { versionLabel } from "@/lib/learning";
import { clusterDe, productDe, reasonDe } from "@/lib/explain";
import { placeholderName } from "@/config/names";
import { CHANNEL_DE, ECO_DE, GUARDRAIL_DE } from "@/config/internal";
import { DataBadge, DecisionBadge } from "@/components/base/StatusBadge";
import { PageTitle, Section, TabBar, td, th } from "@/components/internal/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketing/simulator")({
  head: () => ({ meta: [{ title: "Simulation & Analyse · Marketing" }] }),
  component: Analysis,
});

type Tab = "simulation" | "verlauf" | "guardrails" | "audit";

function Analysis() {
  const [tab, setTab] = useState<Tab>("simulation");
  const [id, setId] = useState("MG-100332");
  const [applied, setApplied] = useState<string[]>([]);
  return (
    <div>
      <PageTitle title="Simulation & Analyse" sub="Ereignis simulieren und Vorher/Nachher vergleichen. Guardrails laufen live über alle 750 Kunden." />
      <TabBar label="Analyse" value={tab} onChange={setTab} tabs={[{ id: "simulation", label: "Simulation" }, { id: "verlauf", label: "Verlauf CLV & EV" }, { id: "guardrails", label: "Guardrail-Tests" }, { id: "audit", label: "Audit-Log" }]} />
      {tab === "simulation" && <Simulation id={id} setId={setId} applied={applied} setApplied={setApplied} />}
      {tab === "verlauf" && <Trend id={id} applied={applied} />}
      {tab === "guardrails" && <Guardrails />}
      {tab === "audit" && <AuditLog />}
    </div>
  );
}

const iso = (d: number) => new Date(DECISION_TIME.getTime() + d * 864e5).toISOString().slice(0, 10);
type Ev = { id: string; label: string; apply: (c: RawCustomer, p: Profile) => RawCustomer };
const EVENTS: Ev[] = [
  { id: "wallbox", label: "Kauft eine Wallbox", apply: (c) => ({ ...c, shop: [...c.shop, "Wallbox 11 kW"], hems: c.hems ? { ...c.hems, devices: [...new Set([...c.hems.devices, "wallbox"])] } : c.hems }) },
  { id: "complaint", label: "Reicht eine Beschwerde ein", apply: (c) => ({ ...c, openTickets: c.openTickets + 1, openComplaint: true, churn: Math.min(0.95, c.churn + A.open_complaint), tickets: [...c.tickets, { id: "TK-SIM", at: "2026-10-01", channel: "email", category: "complaint", status: "open", text: "Beschwerde (simuliert)", csat: null }] }) },
  { id: "charging", label: "Ladeabbrüche (3+ in 30 Tagen)", apply: (c) => ({ ...c, charging: { ...(c.charging ?? { sessions: 10, kwh: 200, spend: 120, failedTotal: 0, dcShare: 0.5 }), failed30d: 4, failedTotal: (c.charging?.failedTotal ?? 0) + 4 }, churn: Math.min(0.95, c.churn + A.failed_charges_30d_ge3) }) },
  { id: "withdraw", label: "Widerruft Profiling-Einwilligung", apply: (c) => ({ ...c, consent: { ...c.consent, profiling_analytics: "withdrawn" } }) },
  { id: "gasdereg", label: "Gaszähler abgemeldet (neue Wärmepumpe)", apply: (c) => c.gas ? ({ ...c, gas: { ...c.gas, status: "terminated_meter_deregistration" } }) : ({ ...c, hems: { devices: [...(c.hems?.devices ?? []), "heat_pump"], offline: false, pvDaily: c.hems?.pvDaily ?? 0, selfConsumption: c.hems?.selfConsumption ?? null, heatPumpDaily: 20 } }) },
  { id: "consent", label: "Erteilt Werbe- und Profiling-Einwilligung", apply: (c) => ({ ...c, consent: { ...c.consent, marketing_email: "granted", profiling_analytics: "granted", portal_app_personalisation: "granted", newsletter_email: "granted" } }) },
  { id: "reject", label: "Lehnt das aktuelle Angebot ab", apply: (c, p) => ({ ...c, rejected: [...(c.rejected ?? []), p.nba.productId], contacts30d: c.contacts30d + 1 }) },
  { id: "buy", label: "Kauft ein weiteres Produkt", apply: (c) => !c.electricity
      ? { ...c, electricity: { tariff: "StromAktiv", status: "active", kwh: 3200, price: 0.329, base: 12.9, installment: 95, pgUntil: iso(365), meter: "conventional", feedIn: false, dunning: 0, cancelled: false }, margin: c.margin + 114, lines: c.lines + 1, churn: Math.max(0.05, c.churn * A.multi_line_factor) }
      : !c.mobile ? { ...c, mobile: { plan: "M", gb: 20, used: 6, limitHits: 0, sims: 1, fee: 14.99 }, margin: c.margin + 54, lines: c.lines + 1, churn: Math.max(0.05, c.churn * A.multi_line_factor) }
      : { ...c, hems: { devices: ["hems_gateway"], offline: false, pvDaily: 0, selfConsumption: null, heatPumpDaily: 0 }, margin: c.margin + 36, lines: c.lines + 1, churn: Math.max(0.05, c.churn + A.hems_user) } },
  { id: "pg", label: "Preisgarantie läuft in 30 Tagen aus", apply: (c) => c.electricity ? ({ ...c, electricity: { ...c.electricity, pgUntil: iso(30) }, churn: Math.min(0.95, c.churn + A.price_guarantee_ends_90d) }) : c },
];
const SCENARIOS = [
  { id: "MG-100332", label: "Autostrom ohne Hausstrom" },
  { id: "MG-100010", label: "Preisgarantie läuft aus" },
  { id: "MG-100009", label: "Ladeproblem → CARE" },
  { id: "MG-100125", label: "Gaszähler abgemeldet" },
];

type SimState = { id: string; applied: string[] };

function Simulation({ id, setId, applied, setApplied }: SimState & { setId: (v: string) => void; setApplied: (v: string[]) => void }) {
  const profiles = useProfiles();
  const base = profiles.find((p) => p.id === id)!;
  const after = useMemo(() => {
    let c = base.raw, p = base;
    for (const e of applied) { c = EVENTS.find((x) => x.id === e)!.apply(c, p); p = recompute(c, base); }
    return p;
  }, [base, applied]);
  const run = (e: Ev) => { setApplied([...applied, e.id]); actions.logSim(id, e.label); };
  const pick = (v: string) => { setId(v); setApplied([]); };

  const rows: [string, (p: Profile) => ReactNode, (p: Profile) => string, ReactNode?][] = [
    ["Next Best Action", (p) => <span className="flex items-center gap-2"><DecisionBadge status={p.nba.action} />{productDe(p.nba)}</span>, (p) => p.nba.action + p.nba.productId],
    ["Begründung", (p) => reasonDe(p), (p) => reasonDe(p)],
    ["Erwarteter Wert ΔCLV", (p) => eur(p.nba.dClv), (p) => p.nba.dClv.toFixed(0), <DataBadge key="s" status="simuliert" />],
    ["Kanal / Anrede", (p) => `${p.nba.channel ? CHANNEL_DE[p.nba.channel] ?? p.nba.channel : "—"} · ${p.nba.tone === "du" ? "Du" : "Sie"}`, (p) => `${p.nba.channel}${p.nba.tone}`],
    ["EcoLevel", (p) => `${p.ecoLevel} · ${ECO_DE[p.ecoLevel - 1]}`, (p) => String(p.ecoLevel)],
    ["Bedarfsabdeckung", (p) => pct(p.coverage), (p) => pct(p.coverage)],
    ["Cluster", (p) => clusterDe(p.cluster), (p) => p.cluster],
    ["Abwanderung 12 M", (p) => pct(p.raw.churn), (p) => pct(p.raw.churn), <DataBadge key="g" status="geschaetzt" />],
    ["CLV", (p) => eur(p.clvModel), (p) => eur(p.clvModel), <DataBadge key="b" status="berechnet" />],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {SCENARIOS.map((s) => <Button key={s.id} size="sm" variant={id === s.id ? "default" : "outline"} onClick={() => pick(s.id)}>{s.label}</Button>)}
        <Select value={id} onValueChange={pick}>
          <SelectTrigger className="h-8 w-[160px]" aria-label="Kunde"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>)}</SelectContent>
        </Select>
        {applied.length > 0 && <Button size="sm" variant="ghost" onClick={() => setApplied([])}>Zurücksetzen</Button>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Section title="Ereignis simulieren" sub={`${placeholderName(base.id)} · ${base.id}`} className="lg:self-start">
          <ul className="space-y-1.5">
            {EVENTS.map((e) => <li key={e.id}><Button variant="outline" size="sm" className="w-full justify-start" onClick={() => run(e)}>{e.label}</Button></li>)}
          </ul>
          {applied.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Angewendet: {applied.map((a) => EVENTS.find((e) => e.id === a)!.label).join(" → ")}</p>}
          <p className="mt-3 text-xs text-muted-foreground"><DataBadge status="simuliert" /> Nichts wird in Kundendaten geschrieben.</p>
        </Section>
        <div className="min-w-0 space-y-6">
          <Section title="Vorher → Nachher">
            <div className="relative overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-border"><th className={th}>Größe</th><th className={th}>Vorher</th><th className={th} /><th className={th}>Nachher</th></tr></thead>
              <tbody>
                {rows.map(([label, f, key, badge]) => {
                  const changed = key(base) !== key(after);
                  return (
                    <tr key={label} className="border-b border-border align-top last:border-0">
                      <td className={cn(td, "text-muted-foreground")}><span className="flex items-center gap-1">{label}{badge}</span></td>
                      <td className={td}>{f(base)}</td>
                      <td className={td}><ArrowRight className="size-4 text-muted-foreground" strokeWidth={1.75} /></td>
                      <td className={cn(td, changed && "font-semibold")}>{f(after)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </Section>
          <Section title="Bedarfswerte vorher → nachher">
            <ul className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
              {base.needs.map((n, i) => {
                const a = after.needs[i], d = a.score - n.score;
                return <li key={n.id} className="flex justify-between gap-2"><span>{NEED_DE[n.id]}</span><span className="tabular-nums">{n.score} → <b>{a.score}</b>{d !== 0 && <span className="ml-1 text-muted-foreground">({d > 0 ? "+" : ""}{d})</span>}</span></li>;
              })}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

const AXIS = "#5b6474";
const GRID = "#e1e4e9";
const NAVY = "#0b2a5b";

/** CLV and expected value (ΔCLV of the next best action) after each simulated event, in order. */
function Trend({ id, applied }: SimState) {
  const profiles = useProfiles();
  const base = profiles.find((p) => p.id === id)!;
  const data = useMemo(() => {
    const out = [{ step: "Start", clv: base.clvModel, ev: base.nba.dClv }];
    let c = base.raw, p = base;
    applied.forEach((e, i) => {
      const ev = EVENTS.find((x) => x.id === e)!;
      c = ev.apply(c, p); p = recompute(c, base);
      out.push({ step: `${i + 1}. ${ev.label}`, clv: p.clvModel, ev: p.nba.dClv });
    });
    return out;
  }, [base, applied]);
  const charts = [
    { key: "clv" as const, title: "Customer Lifetime Value (CLV)", sub: "Berechneter Kundenwert nach jedem Ereignis" },
    { key: "ev" as const, title: "Erwarteter Wert (ΔCLV der Next Best Action)", sub: "Simulierter Mehrwert des aktuellen Angebots" },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{placeholderName(base.id)} · {base.id} · {applied.length ? `${applied.length} Ereignis${applied.length > 1 ? "se" : ""} angewendet` : "Noch kein Ereignis. Im Tab „Simulation“ Ereignisse anwenden, dann entwickelt sich der Verlauf hier."}</p>
      {charts.map((c) => (
        <Section key={c.key} title={c.title} sub={c.sub} action={<DataBadge status={c.key === "clv" ? "berechnet" : "simuliert"} />}>
          <div className="h-64" role="img" aria-label={`Liniendiagramm: ${c.title} über ${data.length} Schritte`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="step" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} interval={0} />
                <YAxis tickFormatter={(v: number) => eur(v)} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={72} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number) => [eur(v), c.key === "clv" ? "CLV" : "ΔCLV"]} contentStyle={{ borderRadius: 8, border: `1px solid ${GRID}`, fontSize: 13 }} />
                <Line type="monotone" dataKey={c.key} stroke={NAVY} strokeWidth={2} dot={{ r: 4, fill: NAVY }} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ))}
    </div>
  );
}

function Guardrails() {
  const profiles = useProfiles();
  const gr = useMemo(() => guardrails(profiles), [profiles]);
  const ok = gr.filter((g) => !g.violations.length).length;
  return (
    <Section title={`${ok} von ${gr.length} Guardrails erfüllt`} sub={`Live über alle ${profiles.length} Kunden, inkl. Portal-Änderungen und Stellschrauben · Engine ${ENGINE_VERSION}`}>
      <ul className="divide-y divide-border text-sm">
        {gr.map((g) => (
          <li key={g.id} className="flex items-start gap-3 py-2.5">
            <span className={cn("mt-0.5 rounded px-1.5 text-xs font-semibold", g.violations.length ? "bg-status-care text-white" : "bg-muted text-foreground")}>{g.violations.length ? "verletzt" : "ok"}</span>
            <span><b className="tabular-nums">{g.id}</b> {GUARDRAIL_DE[g.id] ?? g.label}
              {g.violations.length > 0 && <span className="text-status-care"> – {g.violations.length} Fälle: {g.violations.slice(0, 6).map((v) => <Link key={v} to="/marketing/customers" search={{ id: v }} className="underline">{v} </Link>)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Weitere Guardrails (Portal, Chat, Stilprofil, Stellschrauben, Kündigung) laufen als automatische Tests: <code>npm test</code>.</p>
    </Section>
  );
}

function AuditLog() {
  const audit = useStore((s) => s.audit);
  const engineLog = useStore((s) => s.engineLog);
  const learning = useStore((s) => s.learning);
  const profiles = useProfiles();
  const download = () => {
    const lines = profiles.map((p) => JSON.stringify({
      exported_at: new Date().toISOString(), data_as_of: DECISION_TIME.toISOString(), engine: versionLabel(learning.activeId), customer_id: p.id,
      inputs: { eco_level: p.ecoLevel, cluster: p.cluster, profiling: p.profiling, consent: p.raw.consent, contacts_30d: p.raw.contacts30d, events_today: p.raw.signals ?? [] },
      rules: { blockers: p.blockers, flags: p.flags.map((f) => f.code), blocked: p.recs.filter((r) => r.policy !== "eligible").map((r) => ({ offer: r.productId, code: r.policyCode })) },
      scores: p.recs.slice(0, 5).map((r) => ({ offer: r.productId, p_accept: +r.pAccept.toFixed(4), dclv: +r.dClv.toFixed(2), policy: r.policyCode, status: { p_accept: "geschätzt", dclv: "simuliert" } })),
      chosen: { action: p.nba.action, offer: p.nba.productId, channel: p.nba.channel, tone: p.nba.tone, dclv: +p.nba.dClv.toFixed(2), reason_de: reasonDe(p) },
    }));
    const audits = audit.map((a) => JSON.stringify({ type: "audit", ...a }));
    const feedback = engineLog.map((e) => JSON.stringify({ engine: ENGINE_VERSION, ...e }));
    const outcomes = learning.outcomes.map((o) => JSON.stringify({ type: "outcome", ...o }));
    const versions = learning.versions.map((v) => JSON.stringify({ type: "learn_version", id: v.id, at: v.at, parent: v.parent, status: v.status, changes: v.changes }));
    const url = URL.createObjectURL(new Blob([[...lines, ...audits, ...feedback, ...outcomes, ...versions].join("\n")], { type: "application/x-ndjson" }));
    const el = document.createElement("a"); el.href = url; el.download = "entscheidungen_und_audit.jsonl"; el.click(); URL.revokeObjectURL(url);
  };
  return (
    <Section title="Audit-Log" sub="Jede Freigabe, Stellschraube, Einwilligung, Self-Service-Aktion und Service-Entscheidung aus allen Ansichten"
      action={<Button size="sm" variant="outline" onClick={download}><Download className="size-4" strokeWidth={1.75} />JSONL herunterladen</Button>}>
      {audit.length ? (
        <div className="relative max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card"><tr className="border-b border-border"><th className={th}>Zeit</th><th className={th}>Wer</th><th className={th}>Was</th><th className={th}>Kunde</th><th className={th}>Detail</th></tr></thead>
            <tbody>{audit.map((a, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className={`${td} whitespace-nowrap tabular-nums`}>{new Date(a.at).toLocaleString("de-DE")}</td><td className={td}>{a.actor}</td><td className={`${td} font-medium`}>{a.action}</td>
                <td className={td}>{a.customerId ?? "—"}</td><td className={`${td} text-muted-foreground`}>{a.detail}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      ) : <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Einträge. Eine Freigabe oder eine Aktion im Portal erscheint hier sofort.</p>}
    </Section>
  );
}
