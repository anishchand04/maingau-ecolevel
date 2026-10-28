import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { eur } from "@/lib/engine";
import { waitingLabel, type InboxItem } from "@/lib/inbox";
import { FILTERS, PRIORITY_LABEL, SERVICE_TEXT as T, SOURCE_DE, type InboxFilter } from "@/config/service";
import { DataBadge } from "@/components/base/StatusBadge";
import { Kpi, PageTitle, Section, td, th } from "@/components/internal/ui";
import { useInbox } from "@/components/internal/use-inbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/service/")({
  head: () => ({ meta: [{ title: "Eingang · Service" }] }),
  component: Inbox,
});

function Inbox() {
  const { items, relief, handovers } = useInbox();
  const [filter, setFilter] = useState<InboxFilter>("alle");
  const [limit, setLimit] = useState(40);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();
  const acute = items.filter((i) => i.filter !== "proaktiv");
  const shown = useMemo(() => items.filter((i) => filter === "alle" ? i.filter !== "proaktiv" : i.filter === filter), [items, filter]);
  const count = (f: InboxFilter) => (f === "alle" ? acute.length : items.filter((i) => i.filter === f).length);
  const open = (i: InboxItem) => navigate({ to: "/service/fall", search: { key: i.key } });

  return (
    <div className="space-y-6">
      <PageTitle title={T.title} sub={T.sub} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={T.stats.open} value={acute.length} status="berechnet" />
        <Kpi label={T.stats.critical} value={acute.filter((i) => i.critical).length} status="berechnet" />
        <Kpi label={T.stats.funki} value={relief.count} status="berechnet">
          {T.relief}. {T.reliefDetail.replace("{n}", String(relief.count)).replace("{eur}", eur(relief.eur, 2))} <DataBadge status="simuliert" className="ml-1" />
        </Kpi>
        <Kpi label={T.stats.handover} value={handovers} status="berechnet" />
      </div>

      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setLimit(40); }}
            className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-sm", filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
            {f.label} <span className="tabular-nums opacity-70">{count(f.id)}</span>
          </button>
        ))}
      </div>

      <Section title={`${shown.length} Fälle`} sub={filter === "proaktiv" ? "Kunden ohne Ticket, bei denen sich Hilfe lohnt, bevor sie sich melden. Sortiert nach Frist." : undefined}>
        {shown.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>{T.cols.priority}</th><th className={th}>{T.cols.customer}</th><th className={th}>{T.cols.matter}</th>
                <th className={th}>{T.cols.source}</th><th className={th}>{T.cols.mood}</th><th className={th}>{T.cols.waiting}</th><th className={th}><span className="sr-only">{T.open}</span></th>
              </tr></thead>
              <tbody>
                {shown.slice(0, limit).map((i) => {
                  const long = i.detail.length > 90;
                  return (
                    <tr key={i.key} className="border-b border-border align-top last:border-0 hover:bg-muted/50">
                      <td className={td}><span className={cn("inline-flex rounded px-1.5 text-xs font-semibold", i.priority === 1 ? "bg-status-care text-white" : i.priority === 2 ? "border border-status-care text-status-care" : "bg-muted text-muted-foreground")}>{PRIORITY_LABEL[i.priority]}</span></td>
                      <td className={td}><span className="font-medium">{i.name}</span><div className="text-xs text-muted-foreground">{i.customerId}</div></td>
                      <td className={cn(td, "max-w-md")}>
                        <div className="font-medium">{i.title}</div>
                        {i.detail && <p className="text-xs text-muted-foreground">{expanded === i.key || !long ? i.detail : `${i.detail.slice(0, 90)}…`}
                          {long && <button type="button" onClick={() => setExpanded(expanded === i.key ? null : i.key)} className="ml-1 cursor-pointer font-semibold text-foreground underline-offset-4 hover:underline">{expanded === i.key ? T.less : T.more}</button>}</p>}
                        {i.suggestion && i.filter === "proaktiv" && <p className="mt-1 text-xs">→ {i.suggestion}</p>}
                      </td>
                      <td className={td}>{SOURCE_DE[i.source]}</td>
                      <td className={cn(td, i.mood === "verärgert" && "font-semibold")}>{T.mood[i.mood]}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{waitingLabel(i.since, T)}</td>
                      <td className={td}><Button size="sm" variant="outline" onClick={() => open(i)}>{T.open}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">{T.empty}</p>}
        {shown.length > limit && <div className="mt-4 text-center"><Button size="sm" variant="outline" onClick={() => setLimit(limit + 40)}>Weitere 40 anzeigen</Button></div>}
      </Section>
      <p className="text-xs text-muted-foreground">Service sieht keine Kundenwerte. <Link to="/marketing" className="underline">Marketing</Link> sieht die Folgen jeder Entscheidung sofort.</p>
    </div>
  );
}
