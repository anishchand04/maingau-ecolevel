import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { productsOf, type Profile } from "@/lib/engine";
import { actions, useStore } from "@/lib/store";
import { styleOf, styleSummary } from "@/lib/style";
import { caseFacts, nextStep, replyDraft, templateSummary } from "@/lib/caseSummary";
import { summarizeCase } from "@/lib/funkiAi";
import { fmtDate } from "@/lib/portal";
import type { InboxItem } from "@/lib/inbox";
import { CONSENT_CHANNELS, EVENT_DE } from "@/config/internal";
import { PORTAL } from "@/config/portal";
import { PRIORITY_LABEL, SERVICE_TEXT as T, SOURCE_DE } from "@/config/service";
import { Section } from "@/components/internal/ui";
import { useInbox } from "@/components/internal/use-inbox";
import { Button } from "@/components/ui/button";
import { SlotDialog } from "@/components/SlotPicker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/service/fall")({
  validateSearch: (s: Record<string, unknown>): { key?: string } => ({ key: typeof s.key === "string" ? s.key : undefined }),
  head: () => ({ meta: [{ title: "Fall · Service" }] }),
  component: CaseView,
});

function CaseView() {
  const { key } = Route.useSearch();
  const { profiles, items } = useInbox();
  const item = items.find((i) => i.key === key);
  const p = item && profiles.find((x) => x.id === item.customerId);
  if (!item || !p) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold">{T.notFound}</p>
        <Link to="/service" className="mt-3 inline-block text-sm underline">{T.back}</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Link to="/service" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" strokeWidth={1.75} />{T.back}</Link>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <span className={cn("rounded px-1.5 text-xs font-semibold", item.priority === 1 ? "bg-status-care text-white" : "bg-muted")}>{PRIORITY_LABEL[item.priority]}</span>
        <span className="text-sm text-muted-foreground">{item.name} · {item.customerId} · {SOURCE_DE[item.source]} · seit {fmtDate(item.since)}</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
        <CustomerColumn p={p} others={items.filter((i) => i.customerId === p.id && i.key !== item.key && i.filter !== "proaktiv")} />
        <MiddleColumn p={p} item={item} />
        <ActionColumn p={p} item={item} />
      </div>
    </div>
  );
}

function CustomerColumn({ p, others }: { p: Profile; others: InboxItem[] }) {
  const c = p.raw;
  const s = styleOf(c);
  return (
    <Section title={T.customer} className="xl:self-start">
      <dl className="space-y-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{T.contracts}</dt><dd className="mt-1 space-y-0.5">{productsOf(c).map((x) => <div key={x}>{x}</div>)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{T.since}</dt><dd className="mt-1 tabular-nums">{fmtDate(c.since)}</dd></div>
        <div>
          <dt className="text-xs text-muted-foreground">{T.style}</dt><dd className="mt-1">{styleSummary(s)} · {s.fachwissen}</dd>
          {s.belege[0] && <dd className="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground">„{s.belege[0]}“</dd>}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{T.consents}</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {[...CONSENT_CHANNELS, { key: "profiling_analytics", label: "Profiling" }].map((k) => {
              const v = c.consent[k.key];
              return <span key={k.key} className="inline-flex items-center gap-1 text-xs"><span aria-hidden className={cn("size-2 rounded-full", v === "granted" ? "bg-success" : v === "withdrawn" ? "bg-status-care" : "bg-status-wait/50")} />{k.label}<span className="sr-only">: {v === "granted" ? "ja" : "nein"}</span></span>;
            })}
          </dd>
        </div>
      </dl>
      {others.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">{T.otherCases}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {others.map((o) => <li key={o.key}><Link to="/service/fall" search={{ key: o.key }} className="underline-offset-4 hover:underline">{o.title}</Link></li>)}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{T.noValues}</p>
    </Section>
  );
}

type Entry = { at: string; kind: string; text: string; long?: string };

function MiddleColumn({ p, item }: { p: Profile; item: InboxItem }) {
  const chats = useStore((s) => s.chats[p.id]);
  const cached = useStore((s) => s.summaries[item.key]);
  const ai = useStore((s) => s.aiEnabled);
  const cases = useStore((s) => s.cases);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const template = templateSummary(p, item);

  const timeline = useMemo<Entry[]>(() => {
    const c = p.raw;
    const out: Entry[] = [
      ...c.tickets.map((t) => ({ at: t.at, kind: PORTAL.categories[t.category] ?? t.category, text: t.text || t.callNote || "" })),
      ...c.transcripts.map((t) => ({ at: t.at, kind: "Gespräch", text: t.text.split("\n").find((l) => l.startsWith("Kunde:"))?.slice(7) ?? "", long: t.text })),
      ...(chats ?? []).map((l) => ({ at: l.at, kind: l.from === "kunde" ? "Chat · Kunde" : "Chat · Funki", text: l.text })),
      ...cases.filter((k) => k.customerId === p.id).map((k) => ({ at: k.createdAt, kind: "Self-Service", text: `${k.title}${k.reason ? ` · Grund: ${k.reason}` : ""}` })),
      ...c.events.filter((e) => !["portal_login", "page_viewed", "newsletter_opened", "charge_session_started", "charge_session_completed", "hems_daily_summary"].includes(e.type))
        .map((e) => ({ at: e.at, kind: "Ereignis", text: EVENT_DE[e.type] ?? e.type })),
    ];
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [p, chats, cases]);

  async function makeSummary() {
    setBusy(true);
    try {
      const res = await summarizeCase({ data: { facts: caseFacts(p, item, chats) } });
      if (res.ok) actions.setSummary(item.key, { text: res.text, ai: true });
      else toast("KI gerade nicht erreichbar – die Vorlage bleibt.");
    } catch { toast("KI gerade nicht erreichbar – die Vorlage bleibt."); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Section title={T.summary} sub={cached?.ai ? T.summaryAi : T.summaryTemplate}
        action={ai && !cached ? <Button size="sm" variant="outline" disabled={busy} onClick={makeSummary}>{T.summaryMake}</Button> : undefined}>
        {cached?.ai && <p className="mb-1 text-xs font-semibold text-muted-foreground">{T.summaryAi}</p>}
        <p className="text-sm">{cached?.text ?? template}</p>
      </Section>
      <Section title={T.timeline}>
        <ol className="space-y-3">
          {timeline.map((e, i) => (
            <li key={i} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
              <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(e.at)}</span>
              <div>
                <span className="text-xs font-semibold">{e.kind}</span>
                <p className="whitespace-pre-line text-muted-foreground">{open === i && e.long ? e.long : e.text}</p>
                {e.long && <button type="button" onClick={() => setOpen(open === i ? null : i)} className="cursor-pointer text-xs font-semibold underline-offset-4 hover:underline">{open === i ? T.less : "Ganzes Gespräch"}</button>}
              </div>
            </li>
          ))}
          {!timeline.length && <li className="text-sm text-muted-foreground">Keine Einträge.</li>}
        </ol>
      </Section>
    </div>
  );
}

function ActionColumn({ p, item }: { p: Profile; item: InboxItem }) {
  const [draft, setDraft] = useState(() => replyDraft(p, item));
  const [callbackOpen, setCallbackOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => setDraft(replyDraft(p, item)), [item.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const note = (action: string, msg: string) => { actions.serviceNote(p.id, action, `${item.title} · ${item.key}`); toast(msg); };
  const solve = () => {
    actions.resolve(p.id, item.resolveKeys.length ? item.resolveKeys : [], `${item.title} · ${item.key}`);
    toast.success(T.solved);
    navigate({ to: "/service" });
  };
  const isCancel = item.filter === "kuendigung";

  return (
    <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <Section title={T.nextStep}>
        <p className="text-sm font-semibold">{nextStep(p, item)}</p>
        {isCancel && (item.reason || item.endDate) && (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {item.reason && <div><dt className="text-muted-foreground">{T.reason}</dt><dd>{item.reason}</dd></div>}
            {item.endDate && <div><dt className="text-muted-foreground">{T.endDate}</dt><dd className="tabular-nums">{fmtDate(item.endDate)}</dd></div>}
          </dl>
        )}
      </Section>
      <Section title={T.draft} sub={T.draftHint}>
        <label className="sr-only" htmlFor="draft">{T.draft}</label>
        <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6}
          className="w-full rounded-md border border-input bg-card p-2 text-sm focus:border-ring focus:outline-none" />
        <Button size="sm" className="mt-2" onClick={() => note("Antwort gesendet (Status)", T.sent)}>{T.send}</Button>
      </Section>
      <Section title="Aktionen">
        <div className="grid gap-2">
          {isCancel ? (
            <>
              <Button onClick={() => { note("Kündigung bestätigt", T.cancelConfirmed); solve(); }}>{T.confirmCancel}</Button>
              <Button variant="outline" onClick={() => note("Halteangebot angeboten (auf Wunsch)", T.retentionNote)}>{T.retention}</Button>
            </>
          ) : (
            <Button onClick={solve}>{T.solve}</Button>
          )}
          <Button variant="outline" onClick={() => setCallbackOpen(true)}>{T.callback}</Button>
          <SlotDialog open={callbackOpen} onOpenChange={setCallbackOpen} kind="call" title={PORTAL.help.callbackTitle}
            onPick={(slot) => { actions.callback(p.id, slot); note(`Rückruf geplant: ${slot}`, T.callback); }} />
          {!isCancel && <Button variant="outline" onClick={() => note("Kulanz vorgeschlagen (Freigabe nötig)", T.goodwillNote)}>{T.goodwill}</Button>}
          <Button variant="ghost" onClick={() => note("Weitergeleitet", T.forwarded)}>{T.forward}</Button>
        </div>
      </Section>
    </div>
  );
}
