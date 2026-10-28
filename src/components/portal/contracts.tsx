// "Das hast du bei MAINGAU": one card per contract/product, detail sheet with a small history chart.
import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { gasDeregistered, type Profile } from "@/lib/engine";
import { fill, fmtDate, fmtNum } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { DETAIL } from "@/config/details";
import { EmptyState } from "@/components/base/EmptyState";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ICONS, STROKE } from "./icons";
import { usePortal } from "./use-portal";
import { ContractDetail } from "./ContractDetail";

const C = PORTAL.contract;
export type ContractId = keyof typeof C.titles;
type Row = [label: string, value: string];
type Chart = { label: string; unit: string; data: { x: string; v: number }[] };
export type ContractItem = { id: ContractId; title: string; subtitle: string; rows: Row[]; status?: string; chart?: Chart };

const eurMonth = (v: number) => fill(C.perMonth, { v: fmtNum(v, 2) });

export function contractsOf(p: Profile): ContractItem[] {
  const c = p.raw;
  const out: ContractItem[] = [];
  const energyRows = (e: NonNullable<typeof c.electricity>): Row[] => [
    [C.tariff, e.tariff], [C.installment, eurMonth(e.installment)], [C.consumption, fill(C.kwhYear, { v: fmtNum(e.kwh) })],
    [C.pgUntil, fmtDate(e.pgUntil)], [C.notice, e.noticeWeeks ? fill(C.noticeWeeks, { n: e.noticeWeeks }) : "—"],
    [C.meter, e.meter === "smart_meter_imsys" ? C.smartMeter : C.classicMeter], [C.lastReading, fmtDate(e.lastMeterReadingAt)],
    [C.payment, (e.paymentMethod && C.payments[e.paymentMethod]) || "—"],
  ];
  if (c.electricity) {
    const daily = (c.consumption?.daily ?? []).filter((d) => d.household != null);
    out.push({
      id: "electricity", title: C.titles.electricity, subtitle: c.electricity.tariff, rows: energyRows(c.electricity),
      status: c.electricity.cancelled ? C.status.cancelled : undefined,
      chart: daily.length ? { label: C.chartElectricity, unit: "kWh", data: daily.map((d) => ({ x: d.date.slice(8, 10), v: d.household! })) } : undefined,
    });
  }
  if (c.gas) out.push({ id: "gas", title: C.titles.gas, subtitle: c.gas.tariff, rows: energyRows(c.gas), status: gasDeregistered(c) ? C.status.deregistered : undefined });
  if (c.mobile) out.push({
    id: "mobile", title: C.titles.mobile, subtitle: c.mobile.plan,
    rows: [[C.plan, c.mobile.plan], [C.data, `${c.mobile.gb} GB`], [C.sims, String(c.mobile.sims)], [C.installment, eurMonth(c.mobile.fee)]],
  });
  if (c.autostrom) {
    const monthly = c.consumption?.chargingMonthly ?? [];
    out.push({
      id: "autostrom", title: C.titles.autostrom, subtitle: c.autostrom.car,
      rows: [[C.car, c.autostrom.car], [C.sessions, c.charging ? String(c.charging.sessions) : "—"]],
      chart: monthly.length ? { label: C.chartCharging, unit: "kWh", data: monthly.map((m) => ({ x: new Date(`${m.month}-01`).toLocaleDateString("de-DE", { month: "short" }), v: m.kwh })) } : undefined,
    });
  }
  if (c.hems) out.push({
    id: "hems", title: C.titles.hems, subtitle: `${c.hems.devices.length} ${C.devices}`,
    rows: [[C.devices, String(c.hems.devices.length)]], status: c.hems.offline ? C.status.offline : undefined,
  });
  const orders = c.shopOrders ?? [];
  if (c.shop.length || orders.length) out.push({ id: "shop", title: C.titles.shop, subtitle: orders.length ? `${orders.length} ${orders.length === 1 ? DETAIL.orders.one : DETAIL.orders.many}` : c.shop[0],
    rows: [[C.purchases, String(orders.length || c.shop.length)], [DETAIL.orders.last, orders.at(-1)?.product ?? c.shop.at(-1) ?? "—"]] });
  return out;
}

export function ContractCards({ openId, onOpen }: { openId: ContractId | null; onOpen: (id: ContractId | null) => void }) {
  const { p, t } = usePortal();
  const items = useMemo(() => (p ? contractsOf(p) : []), [p]);
  const current = items.find((i) => i.id === openId) ?? null;
  return (
    <section aria-labelledby="contracts-title">
      <h2 id="contracts-title" className="type-section">{t(PORTAL.sections.contracts)}</h2>
      {items.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((k) => {
            const Icon = ICONS[k.id];
            const main = k.rows.slice(0, 2);
            return (
              <li key={k.id}>
                <button type="button" onClick={() => onOpen(k.id)} aria-haspopup="dialog"
                  className="group flex h-full w-full cursor-pointer flex-col rounded-[24px] bg-mg-surface p-5 text-left transition-colors duration-150 ease-out hover:bg-[#e3ebf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
                  <span className="flex w-full items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-mg-navy"><Icon className="size-6" strokeWidth={STROKE} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{k.title}</span>
                      <span className="block truncate type-small text-mg-muted">{k.subtitle}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-mg-navy transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={STROKE} />
                  </span>
                  {(
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 type-small">
                      {main.map(([l, v]) => <div key={l}><dt className="text-mg-muted">{l}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
                    </dl>
                  )}
                  {k.status && <span className="mt-3 inline-flex self-start rounded-full border-2 border-mg-navy px-3 py-0.5 text-sm font-semibold">{k.status}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title={PORTAL.noContracts.title} text={PORTAL.noContracts.text} funki="idle" />}

      <Sheet open={!!current} onOpenChange={(o) => !o && onOpen(null)}>
        <SheetContent side="right" className="theme-portal w-full overflow-y-auto sm:max-w-md">
          {current && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="type-section">{current.title}</SheetTitle>
                <SheetDescription className="text-mg-muted">{current.subtitle}</SheetDescription>
              </SheetHeader>
              <div className="mt-6"><ContractDetail id={current.id} /></div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/** Single series, one hue, recessive axes, hover tooltip. Title names the series – no legend needed. */
export function HistoryChart({ chart }: { chart: Chart }) {
  const total = chart.data.reduce((s, d) => s + d.v, 0);
  return (
    <figure>
      <figcaption className="mb-3 font-semibold">{chart.label}</figcaption>
      <div className="h-44" role="img" aria-label={`${chart.label}: ${chart.data.length} Werte, zusammen ${fmtNum(total, 1)} ${chart.unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 4, right: 0, bottom: 0, left: -16 }} barCategoryGap={2}>
            <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: "#D6DEEA" }} tick={{ fill: "#4A5B78", fontSize: 13 }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#4A5B78", fontSize: 13 }} width={44} />
            <Tooltip cursor={{ fill: "#EEF3FA" }} formatter={(v: number) => [`${fmtNum(v, 1)} ${chart.unit}`, ""]} separator=""
              contentStyle={{ borderRadius: 12, border: "1px solid #D6DEEA", fontSize: 15, color: "#0B2A5B" }} />
            <Bar dataKey="v" fill="#2B63E8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
