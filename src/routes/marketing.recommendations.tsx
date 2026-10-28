import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { CAMPAIGNS, CATALOG, eur, pct } from "@/lib/engine";
import { useProfiles } from "@/lib/live";
import { actions, useStore, type Decision } from "@/lib/store";
import type { Profile } from "@/lib/engine";
import { styleOf } from "@/lib/style";
import { policyDe, productDe, reasonDe, reasonLineDe } from "@/lib/explain";
import { pickOptions } from "@/lib/picks";
import { NBA_STATS } from "@/lib/data";
import { OFFER_TEXT } from "@/config/offers";
import { placeholderName } from "@/config/names";
import { CHANNEL_DE, DECISION_DE, REASONS, REASON_OTHER } from "@/config/internal";
import { TUNING_LIMITS, TUNING_TEXT } from "@/config/tuning";
import { DataBadge, DecisionBadge } from "@/components/base/StatusBadge";
import { PageTitle, Section, TabBar, td, th } from "@/components/internal/ui";
import { ControlGroup } from "@/components/internal/ControlGroup";
import { Learning } from "@/components/internal/Learning";
import { isHoldout } from "@/lib/learning";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketing/recommendations")({
  head: () => ({ meta: [{ title: "Empfehlungen · Marketing" }] }),
  component: Recommendations,
});

type Tab = "offen" | "entschieden" | "wirkung";

function Recommendations() {
  const [tab, setTab] = useState<Tab>("offen");
  return (
    <div>
      <PageTitle title="Empfehlungen" sub="Nichts geht an Kunden, bevor es hier freigegeben ist. Es wird nichts echt versendet." />
      <TabBar label="Empfehlungen" value={tab} onChange={setTab} tabs={[{ id: "offen", label: "Zur Freigabe" }, { id: "entschieden", label: "Entschieden" }, { id: "wirkung", label: "Wirkung" }]} />
      {tab === "wirkung" ? <Impact /> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <Queue decided={tab === "entschieden"} />
          <TuningPanel />
        </div>
      )}
    </div>
  );
}

function Queue({ decided }: { decided: boolean }) {
  const profiles = useProfiles();
  const decisions = useStore((s) => s.decisions);
  const overrides = useStore((s) => s.styleOverride);
  const batchMax = useStore((s) => s.tuning.batchMax);
  const holdoutPct = useStore((s) => s.learning.holdoutPct);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [act, setAct] = useState<{ id: string; kind: "rejected" | "review" | "change" } | null>(null);
  const [limit, setLimit] = useState(30);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = useMemo(() => profiles
    .filter((p) => !q || p.id.toLowerCase().includes(q))
    .filter((p) => p.nba.action === "SELL")
    .filter((p) => !!decisions[`${p.id}:${p.nba.productId}`] === decided)
    .sort((a, b) => b.nba.dClv - a.nba.dClv), [profiles, decisions, decided, q]);

  const decide = (ids: string[], status: Decision, note?: string) => {
    for (const id of ids) {
      const p = items.find((x) => x.id === id);
      if (!p) continue;
      // random control group: an approval of a held-out customer is recorded, but nothing is sent
      const held = status === "approved" && isHoldout(p, holdoutPct);
      actions.decide(p.id, p.nba.productId, held ? "held_out" : status, productDe(p.nba), note);
      if (status === "approved") actions.recordOutcome({ customerId: p.id, offer: p.nba.productId, channel: p.nba.channel ?? "newsletter_email", group: held ? "control" : "treated" });
    }
    setSel(new Set());
    setAct(null);
    toast(`${DECISION_DE[status]}: ${ids.length} Empfehlung${ids.length === 1 ? "" : "en"}`, { description: status === "approved" ? "Simuliert – es wird nichts verschickt." : undefined });
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visible = items.slice(0, limit);
  const allSel = visible.length > 0 && visible.every((p) => sel.has(p.id));

  return (
    <Section title={`${items.length} ${decided ? "entschiedene" : "offene"} Empfehlungen`} sub="SELL nach erwartetem Wert. CARE-Fälle bearbeitet der Service."
      action={!decided && sel.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="tabular-nums">{sel.size} ausgewählt{sel.size > batchMax ? ` · max. ${batchMax} je Freigabe` : ""}</span>
          <Button size="sm" disabled={sel.size > batchMax} onClick={() => decide([...sel], "approved")}>Sammelfreigabe</Button>
          <Button size="sm" variant="outline" onClick={() => decide([...sel], "review", "Sammelaktion")}>Zurückstellen</Button>
        </div>
      ) : undefined}>
      <div className="relative mb-4 max-w-sm">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(30); }} placeholder="Kunden-ID suchen" aria-label="Kunden-ID suchen" className="pl-8" />
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            {!decided && <th className={th}><Checkbox aria-label="Alle sichtbaren auswählen" checked={allSel} onCheckedChange={(v) => setSel(v ? new Set(visible.map((p) => p.id)) : new Set())} /></th>}
            <th className={th}>Kunde</th><th className={th}>Produkt · Kundenvorteil</th><th className={th}>Kanal</th><th className={th}>Policy</th>
            <th className={`${th} text-right`}>ΔCLV <DataBadge status="simuliert" /></th><th className={th}>{decided ? "Status" : "Entscheidung"}</th>
          </tr></thead>
          <tbody>
            {visible.map((p) => {
              const r = p.nba, d = decisions[`${p.id}:${r.productId}`];
              const style = styleOf(p.raw, overrides[p.id]);
              const msg = OFFER_TEXT[r.productId];
              const alt = p.recs.filter((x) => x !== r && x.policy === "eligible" && x.action === "SELL");
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-border align-top">
                    {!decided && <td className={td}><Checkbox aria-label={`${p.id} auswählen`} checked={sel.has(p.id)} onCheckedChange={() => toggle(p.id)} /></td>}
                    <td className={td}><Link to="/marketing/customers" search={{ id: p.id }} className="font-medium hover:underline">{placeholderName(p.id)}</Link><div className="text-xs text-muted-foreground">{p.id}</div></td>
                    <td className={td}>
                      <div className="font-medium">{productDe(r)}{holdoutPct > 0 && isHoldout(p, holdoutPct) && <span className="ml-2 rounded-full border border-dashed border-foreground/40 px-2 py-0.5 text-xs font-medium text-muted-foreground" title="Bei Freigabe wird nichts gesendet; der Kunde zählt zur Kontrollgruppe.">Kontrollgruppe</span>}</div>
                      <div className="text-xs text-muted-foreground">{r.benefitDe}</div>
                      <div className="mt-0.5 text-xs" title={reasonDe(p)}><span className="font-medium">Warum:</span> {reasonLineDe(p)}</div>
                      <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}
                        className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">
                        Begründung, Vorschau{alt.length ? ` und ${alt.length} weitere Chance${alt.length === 1 ? "" : "n"}` : ""}<ChevronDown className={cn("size-3.5 transition-transform", open === p.id && "rotate-180")} />
                      </button>
                    </td>
                    <td className={td}>{r.channel ? CHANNEL_DE[r.channel] ?? r.channel : "—"}</td>
                    <td className={td}>{policyDe(r)}</td>
                    <td className={`${td} text-right tabular-nums`}>{eur(r.dClv)}</td>
                    <td className={td}>
                      {decided ? <span>{d ? DECISION_DE[d.status] : "—"}</span> : (
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" onClick={() => decide([p.id], "approved")}>Freigeben</Button>
                          <Button size="sm" variant="outline" aria-expanded={act?.id === p.id && act.kind === "change"} onClick={() => setAct(act?.id === p.id && act.kind === "change" ? null : { id: p.id, kind: "change" })}>Ändern</Button>
                          <Button size="sm" variant="outline" aria-expanded={act?.id === p.id && act.kind === "rejected"} onClick={() => setAct(act?.id === p.id && act.kind === "rejected" ? null : { id: p.id, kind: "rejected" })}>Ablehnen</Button>
                          <Button size="sm" variant="ghost" aria-expanded={act?.id === p.id && act.kind === "review"} onClick={() => setAct(act?.id === p.id && act.kind === "review" ? null : { id: p.id, kind: "review" })}>Zurückstellen</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {!decided && act?.id === p.id && (
                    <tr className="border-b border-border bg-muted/50">
                      <td colSpan={7} className="px-3 py-3"><ActionPanel p={p} kind={act.kind} onCancel={() => setAct(null)} onDecide={(st, note) => decide([p.id], st, note)} onDone={() => { setAct(null); toast("Empfehlung geändert", { description: "Im Audit-Log festgehalten." }); }} /></td>
                    </tr>
                  )}
                  {open === p.id && (
                    <tr className="border-b border-border bg-muted/50">
                      <td colSpan={decided ? 6 : 7} className="px-3 py-3 text-sm">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div><p className="text-xs font-medium text-muted-foreground">Begründung</p><p className="mt-1">{reasonDe(p)}</p></div>
                          <div><p className="text-xs font-medium text-muted-foreground">Vorschau Kundennachricht ({style.anrede === "du" ? "Du" : "Sie"}, {style.laenge})</p>
                            <p className="mt-1 rounded-md border border-border bg-card p-2">{msg ? (style.anrede === "du" ? msg.du : msg.sie) : "—"}</p></div>
                          <div><p className="text-xs font-medium text-muted-foreground">Weitere Cross-Sell-Chancen</p>
                            <ul className="mt-1 space-y-1">{alt.slice(0, 4).map((x) => <li key={x.productId} className="flex justify-between gap-2"><span>{productDe(x)}</span><span className="tabular-nums">{eur(x.dClv)}</span></li>)}
                              {!alt.length && <li className="text-muted-foreground">keine</li>}</ul></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!items.length && <p className="py-8 text-center text-sm text-muted-foreground">{q ? `Keine Empfehlung für „${query.trim()}“ gefunden.` : decided ? "Noch nichts entschieden." : "Keine offenen Empfehlungen."}</p>}
      </div>
      {items.length > limit && <div className="mt-4 text-center"><Button variant="outline" size="sm" onClick={() => setLimit(limit + 30)}>Weitere 30 anzeigen</Button></div>}
    </Section>
  );
}

const field = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** Reason is mandatory for reject / defer / change – it goes into the audit log. */
function ActionPanel({ p, kind, onCancel, onDecide, onDone }: { p: Profile; kind: "rejected" | "review" | "change"; onCancel: () => void; onDecide: (s: Decision, note: string) => void; onDone: () => void }) {
  const { recs, channels } = pickOptions(p);
  const engineFrom = p.nba.manual?.from ?? productDe(p.nba);
  const [product, setProduct] = useState(p.nba.productId);
  const [channel, setChannel] = useState(p.nba.channel ?? channels[0] ?? "");
  const [preset, setPreset] = useState("");
  const [text, setText] = useState("");
  const reason = preset === REASON_OTHER ? text.trim() : preset;
  const rec = recs.find((r) => r.productId === product) ?? p.nba;
  const unchanged = product === p.nba.productId && channel === (p.nba.channel ?? "");
  const ok = !!reason && (kind !== "change" || !unchanged);
  const submit = () => {
    if (!ok) return;
    if (kind !== "change") return onDecide(kind, reason);
    actions.pickNba(p.id, { productId: product, channel, reason, from: engineFrom },
      `${productDe(p.nba)} (${p.nba.channel ? CHANNEL_DE[p.nba.channel] ?? p.nba.channel : "—"}) → ${productDe(rec)} (${CHANNEL_DE[channel] ?? channel})`);
    onDone();
  };
  const title = { rejected: "Ablehnen", review: "Zurückstellen", change: "Empfehlung ändern" }[kind];
  return (
    <form className="flex flex-wrap items-end gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <span className="font-medium">{title}</span>
      {kind === "change" && (<>
        <label className="grid gap-1 text-xs text-muted-foreground">Produkt
          <select className={field} value={product} onChange={(e) => setProduct(e.target.value)}>
            {recs.map((r) => <option key={r.productId} value={r.productId}>{productDe(r)} · {eur(r.dClv)}</option>)}
          </select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Kanal (nur mit Einwilligung)
          <select className={field} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channels.map((c) => <option key={c} value={c}>{CHANNEL_DE[c] ?? c}</option>)}
          </select></label>
      </>)}
      <label className="grid gap-1 text-xs text-muted-foreground">Grund (Pflicht)
        <select className={field} value={preset} onChange={(e) => setPreset(e.target.value)} required>
          <option value="">Bitte wählen …</option>
          {REASONS[kind].map((r) => <option key={r} value={r}>{r}</option>)}
        </select></label>
      {preset === REASON_OTHER && (
        <label className="grid gap-1 text-xs text-muted-foreground">Begründung
          <input className={`${field} w-56`} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-required /></label>
      )}
      <Button size="sm" type="submit" disabled={!ok}>Bestätigen</Button>
      <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>
      {kind === "change" && p.nba.manual && (
        <Button size="sm" type="button" variant="outline" onClick={() => { actions.clearPick(p.id); onCancel(); toast("Engine-Vorschlag wiederhergestellt"); }}>Zurück zum Engine-Vorschlag</Button>
      )}
      {kind === "change" && unchanged && <span className="text-xs text-muted-foreground">Produkt oder Kanal ändern, um zu speichern.</span>}
    </form>
  );
}

function TuningPanel() {
  const t = useStore((s) => s.tuning);
  const offers = CATALOG.filter((c) => OFFER_TEXT[c.product_id]);
  return (
    <aside className="xl:sticky xl:top-20 xl:self-start">
      <Section title={TUNING_TEXT.title} sub={TUNING_TEXT.intro} action={<Button size="sm" variant="ghost" onClick={() => actions.setTuning({ minEv: 0, maxContacts30d: TUNING_LIMITS.maxContacts30d.max, paused: [], batchMax: 50 })}>{TUNING_TEXT.reset}</Button>}>
        <div className="space-y-5 text-sm">
          <Knob label={TUNING_TEXT.minEv} value={t.minEv} unit=" €" {...TUNING_LIMITS.minEv} onCommit={(v) => actions.setTuning({ minEv: v })} />
          <div>
            <Knob label={TUNING_TEXT.maxContacts} value={t.maxContacts30d} {...TUNING_LIMITS.maxContacts30d} onCommit={(v) => actions.setTuning({ maxContacts30d: v })} />
            <p className="mt-1 text-xs text-muted-foreground">{TUNING_TEXT.maxContactsHint}</p>
          </div>
          <Knob label={TUNING_TEXT.batchMax} value={t.batchMax} {...TUNING_LIMITS.batchMax} onCommit={(v) => actions.setTuning({ batchMax: v })} />
          <fieldset>
            <legend className="font-medium">{TUNING_TEXT.paused}</legend>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {offers.map((o) => (
                <li key={o.product_id}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={t.paused.includes(o.product_id)}
                      onCheckedChange={(v) => actions.setTuning({ paused: v ? [...t.paused, o.product_id] : t.paused.filter((x) => x !== o.product_id) })} />
                    {o.product_name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      </Section>
    </aside>
  );
}

function Knob({ label, value, min, max, step, unit = "", onCommit }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onCommit: (v: number) => void }) {
  const [v, setV] = useState(value);
  return (
    <div>
      <div className="flex justify-between"><span className="font-medium">{label}</span><span className="tabular-nums">{v}{unit}</span></div>
      <Slider className="mt-2" value={[v]} min={min} max={max} step={step} aria-label={label} onValueChange={([x]) => setV(x)} onValueCommit={([x]) => onCommit(x)} />
    </div>
  );
}

const rate = (a: number, b: number) => (b ? pct(a / b, 1) : "—");

function Impact() {
  const fb = useStore((s) => s.feedback);
  const local = Object.values(fb).reduce((m, f) => ({ ...m, [f]: (m[f] ?? 0) + 1 }), {} as Record<string, number>);
  const { treated, control } = NBA_STATS;
  return (
    <div className="space-y-6">
      <Section title="Kampagnen" sub="newsletter_campaigns / newsletter_performance · Öffnungen inkl. maschineller Öffnungen (Apple MPP)">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className={th}>Versand</th><th className={th}>Betreff</th><th className={th}>Kanal</th><th className={`${th} text-right`}>Empfänger</th><th className={`${th} text-right`}>Öffnung</th><th className={`${th} text-right`}>Klick</th><th className={`${th} text-right`}>Abschluss</th><th className={`${th} text-right`}>Abmeldung</th></tr></thead>
            <tbody>
              {CAMPAIGNS.map((c) => {
                const x = c as typeof c & { delivered?: number; unsubscribes?: number; channel?: string };
                const n = x.delivered ?? c.recipients;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className={`${td} tabular-nums`}>{c.sent}</td><td className={td}>{c.subject}</td><td className={td}>{CHANNEL_DE[x.channel ?? "newsletter_email"]}</td>
                    <td className={`${td} text-right tabular-nums`}>{n}</td><td className={`${td} text-right tabular-nums`}>{rate(c.opens, n)}</td>
                    <td className={`${td} text-right tabular-nums`}>{rate(c.clicks, n)}</td><td className={`${td} text-right tabular-nums`}>{rate(c.conversions, n)}</td>
                    <td className={`${td} text-right tabular-nums`}>{rate(x.unsubscribes ?? 0, n)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Reaktionen auf Empfehlungen je Kanal" sub="nba_action_history (ohne Kontrollgruppe) · angenommen = Abschluss in 14 Tagen">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className={th}>Kanal</th><th className={`${th} text-right`}>n</th><th className={`${th} text-right`}>angenommen</th><th className={`${th} text-right`}>abgelehnt</th><th className={`${th} text-right`}>ignoriert</th></tr></thead>
            <tbody>
              {Object.entries(NBA_STATS.byChannel).map(([ch, r]) => (
                <tr key={ch} className="border-b border-border last:border-0">
                  <td className={td}>{CHANNEL_DE[ch] ?? ch}</td><td className={`${td} text-right tabular-nums`}>{r.n}</td>
                  <td className={`${td} text-right tabular-nums`}>{rate(r.converted, r.n)}</td><td className={`${td} text-right tabular-nums`}>{rate(r.dismissed, r.n)}</td><td className={`${td} text-right tabular-nums`}>{rate(r.ignored, r.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Im Portal dieser Demo: {local.learn_more ?? 0}× „Mehr erfahren“, {local.not_interested ?? 0}× „Kein Interesse“, {local.already_have ?? 0}× „Habe ich schon“.</p>
        </Section>
        <ControlGroup treated={treated} control={control} />
      </div>
      <Learning />
    </div>
  );
}
