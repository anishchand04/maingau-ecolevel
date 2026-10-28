// Rich detail sheets per contract (Master-Prompt §4 "Detailansichten"): at least 4 blocks from real data,
// a friendly empty state with next step where data is missing – never an empty area.
import type { ReactNode } from "react";
import { Car, Cpu, Plug, Sun, Thermometer, Zap, ShoppingBag, Home, Gauge } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { daysFromToday, fill, fmtDate, fmtNum, passendCards, pgProgress, tx } from "@/lib/portal";
import { mobileNotes } from "@/engine/context";
import { DETAIL as D, PRODUCT_TIPS } from "@/config/details";
import { OFFER_TEXT } from "@/config/offers";
import { PORTAL } from "@/config/portal";
import { EmptyState } from "@/components/base/EmptyState";
import { PillButton } from "@/components/base/PillButton";
import { cn } from "@/lib/utils";
import { HistoryChart, type ContractId } from "./contracts";
import { InvoiceList } from "./InvoiceList";
import { STROKE } from "./icons";
import { usePortal } from "./use-portal";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-mg-line pt-5">
      <h3 className="mb-3 font-bold">{title}</h3>
      {children}
    </section>
  );
}
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-mg-line">
      {rows.map(([l, v]) => <div key={l} className="flex justify-between gap-4 py-2"><dt className="text-mg-muted">{l}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>)}
    </dl>
  );
}
function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-mg-surface" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <div className="h-full rounded-full bg-mg-navy" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  );
}

export function ContractDetail({ id }: { id: ContractId }) {
  const { p } = usePortal();
  if (!p) return null;
  switch (id) {
    case "electricity": case "gas": return <EnergyDetail kind={id} />;
    case "autostrom": return <ChargingDetail />;
    case "mobile": return <MobileDetail />;
    case "hems": return <HemsDetail />;
    case "shop": return <ShopDetail />;
  }
}

function EnergyDetail({ kind }: { kind: "electricity" | "gas" }) {
  const { p, t } = usePortal();
  const e = p!.raw[kind]!;
  const left = daysFromToday(e.pgUntil);
  const prog = pgProgress(e, PORTAL.pgMonthsAssumption);
  const daily = (p!.raw.consumption?.daily ?? []).filter((d) => d.household != null);
  return (
    <div className="space-y-5">
      <Block title={D.energy.prices}>
        <Rows rows={[
          [PORTAL.contract.tariff, e.tariff],
          [D.energy.workPrice, fill(D.energy.ctKwh, { v: fmtNum(e.price * 100, 2) })],
          [D.energy.basePrice, fill(D.energy.perMonth, { v: fmtNum(e.base, 2) })],
          [PORTAL.contract.installment, fill(D.energy.perMonth, { v: fmtNum(e.installment, 2) })],
          [PORTAL.contract.payment, (e.paymentMethod && PORTAL.contract.payments[e.paymentMethod]) || "—"],
        ]} />
      </Block>
      <Block title={D.energy.guarantee}>
        {e.pgUntil && left !== null ? (
          <>
            <p className="mb-2">{fmtDate(e.pgUntil)} · {left >= 0 ? fill(D.energy.guaranteeLeft, { n: left }) : D.energy.guaranteeEnded}</p>
            {prog !== null && <Meter value={prog * 100} max={100} label={D.energy.guarantee} />}
          </>
        ) : <p className="text-mg-muted">{D.energy.guaranteeNone}</p>}
        <p className="mt-3 type-small text-mg-muted">{PORTAL.contract.notice}: {e.noticeWeeks ? fill(PORTAL.contract.noticeWeeks, { n: e.noticeWeeks }) : "—"}</p>
      </Block>
      <Block title={D.energy.meter}>
        <Rows rows={[[PORTAL.contract.meter, e.meter === "smart_meter_imsys" ? PORTAL.contract.smartMeter : PORTAL.contract.classicMeter], [D.energy.lastReading, fmtDate(e.lastMeterReadingAt)]]} />
        <PillButton variant="outline" size="sm" className="mt-3" onClick={() => actions.openChat({ customerId: p!.id, actionId: "zaehlerstand" })}>{D.energy.meterAction}</PillButton>
      </Block>
      <Block title={D.energy.usage}>
        <p className="mb-3">{fill(D.energy.usageYear, { v: fmtNum(e.kwh) })}</p>
        {kind === "electricity" && daily.length
          ? <HistoryChart chart={{ label: PORTAL.contract.chartElectricity, unit: "kWh", data: daily.map((d) => ({ x: d.date.slice(8, 10), v: d.household! })) }} />
          : <EmptyState title={PORTAL.contract.noHistory} text={t(D.usageEmpty)} className="rounded-[24px] bg-mg-surface py-6" />}
      </Block>
      <Block title={D.energy.invoices}><InvoiceList contract={kind} /></Block>
      <PillButton onClick={() => actions.openChat({ customerId: p!.id, actionId: "abschlag" })}>{D.energy.action}</PillButton>
    </div>
  );
}

function ChargingDetail() {
  const { p, style, t } = usePortal();
  const c = p!.raw;
  const ch = c.charging;
  const months = c.consumption?.chargingMonthly ?? [];
  const du = style.anrede === "du";
  const wallbox = c.hems?.devices.includes("wallbox") || c.shop.includes("Wallbox 11 kW");
  if (!ch) {
    return (
      <div className="space-y-5">
        <Block title={D.charging.car}><p className="text-lg font-bold">{c.autostrom?.car}</p></Block>
        <EmptyState title={D.charging.noData.title} text={D.charging.noData.text} funki="idle" className="rounded-[24px] bg-mg-surface" />
      </div>
    );
  }
  const total = (ch.acCount ?? 0) + (ch.dcCount ?? 0);
  const dt = ch.byDaytime;
  const dtMax = dt ? Math.max(1, ...Object.values(dt)) : 1;
  return (
    <div className="space-y-5">
      <Block title={D.charging.car}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-mg-yellow"><Car className="size-6" strokeWidth={STROKE} /></span>
          <div><p className="text-lg font-bold">{c.autostrom?.car ?? "—"}</p>{c.autostrom && <p className="type-small text-mg-muted">{fill(D.charging.battery, { v: c.autostrom.battery })}</p>}</div>
        </div>
        <p className="mt-3"><span className="font-semibold">{D.charging.wallbox}: </span>{wallbox ? (du ? D.charging.wallboxYes : D.charging.wallboxYesSie) : t(D.charging.wallboxNo)}</p>
      </Block>
      <Block title={D.charging.monthly}>
        {months.length ? <HistoryChart chart={{ label: D.charging.monthlyUnit, unit: "", data: months.map((m) => ({ x: new Date(`${m.month}-01`).toLocaleDateString("de-DE", { month: "short" }), v: m.sessions })) }} /> : <p className="text-mg-muted">{D.blocksEmpty}</p>}
        <h4 className="mt-4 font-semibold">{D.charging.costs}</h4>
        <ul className="mt-1 space-y-1 type-small">
          {months.map((m) => <li key={m.month} className="tabular-nums">{fill(D.charging.costRow, { month: new Date(`${m.month}-01`).toLocaleDateString("de-DE", { month: "long" }), eur: `${fmtNum(m.eur ?? 0, 2)} €`, kwh: fmtNum(m.kwh, 1) })}</li>)}
        </ul>
      </Block>
      <Block title={du ? D.charging.mix : D.charging.mixSie}>
        <div className="flex h-3 overflow-hidden rounded-full bg-mg-surface" aria-hidden>
          <div className="h-full bg-mg-navy" style={{ width: `${total ? ((ch.acCount ?? 0) / total) * 100 : 0}%` }} />
          <div className="h-full bg-mg-yellow" style={{ width: `${total ? ((ch.dcCount ?? 0) / total) * 100 : 0}%` }} />
        </div>
        <p className="mt-2 flex justify-between type-small"><span><span className="mr-1 inline-block size-2.5 rounded-full bg-mg-navy" />{D.charging.ac}: {ch.acCount ?? 0}</span><span><span className="mr-1 inline-block size-2.5 rounded-full bg-mg-yellow" />{D.charging.dc}: {ch.dcCount ?? 0}</span></p>
        {dt && (
          <>
            <h4 className="mt-4 font-semibold">{du ? D.charging.daytime : D.charging.daytimeSie}</h4>
            <ul className="mt-2 space-y-1.5">
              {(["morgens", "mittags", "abends", "nachts"] as const).map((k) => (
                <li key={k} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 type-small">
                  <span>{D.charging.daytimes[k]}</span>
                  <span className="h-2 rounded-full bg-mg-surface"><span className="block h-full rounded-full bg-mg-blue" style={{ width: `${(dt[k] / dtMax) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{dt[k]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Block>
      <Block title={D.charging.failed}>
        {ch.failedSessions?.length ? (
          <ul className="divide-y divide-mg-line">
            {ch.failedSessions.slice().reverse().map((f) => (
              <li key={f.at} className="py-2">
                <p className="font-semibold">{fmtDate(f.at)} · {f.city ?? "—"} · {f.type}</p>
                <p className="type-small text-mg-muted">{D.charging.status[f.status] ?? f.status}{f.reason ? ` – ${D.charging.reasons[f.reason] ?? f.reason}` : ""}</p>
              </li>
            ))}
          </ul>
        ) : <p>{t(D.charging.allGood)}</p>}
      </Block>
      <Block title={D.charging.tipTitle}><p>{t(D.charging.tip)}</p></Block>
      <PillButton variant={ch.failed30d ? "primary" : "outline"} onClick={() => actions.openChat({ customerId: p!.id, actionId: "stoerung" })}>{D.charging.report}</PillButton>
    </div>
  );
}

function MobileDetail() {
  const { p, t } = usePortal();
  const m = p!.raw.mobile!;
  const given = useStore((s) => s.feedback[`${p!.id}:P-MO-02`]);
  const upgrade = p!.recs.some((r) => r.productId === "P-MO-02" && r.policy === "eligible");
  const notes = mobileNotes(p!.raw);
  const share = Math.min(1, m.used / m.gb);
  const R = 42, C = 2 * Math.PI * R;
  return (
    <div className="space-y-5">
      <Block title={D.mobile.plan}>
        <Rows rows={[[D.mobile.plan, /^Mobil/.test(m.plan) ? m.plan : `Mobil ${m.plan}`], [D.mobile.fee, `${fmtNum(m.fee, 2)} €`], [D.mobile.minTerm, fmtDate(m.minTermEnd)]]} />
      </Block>
      <Block title={D.mobile.volume}>
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 100 100" className="size-28 shrink-0" role="img" aria-label={fill(D.mobile.volumeText, { used: fmtNum(m.used, 1), gb: m.gb })}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="#EEF3FA" strokeWidth="10" />
            <circle cx="50" cy="50" r={R} fill="none" stroke={share >= 0.9 ? "#0B2A5B" : "#2B63E8"} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${share * C} ${C}`} transform="rotate(-90 50 50)" />
            <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0B2A5B">{Math.round(share * 100)} %</text>
          </svg>
          <div>
            <p className="font-semibold">{fill(D.mobile.volumeText, { used: fmtNum(m.used, 1), gb: m.gb })}</p>
            <p className="mt-1 type-small text-mg-muted">{m.limitHits ? fill(t(D.mobile.limitHit), { n: m.limitHits }) : t(D.mobile.limitOk)}</p>
          </div>
        </div>
      </Block>
      <Block title={D.mobile.simBlock}>
        <p>{fill(D.mobile.simText, { sims: m.sims, household: p!.raw.household })}</p>
      </Block>
      <Block title={D.mobile.roaming}>
        <p className="text-lg font-bold tabular-nums">{m.roamingDays3m ?? 0}</p>
        {notes.map((n) => <p key={n.id} className="mt-1 type-small text-mg-muted">{t(n)}</p>)}
      </Block>
      {upgrade && (given
        ? <p className="font-semibold">{D.mobile.upgradeDone}</p>
        : <PillButton onClick={() => { actions.feedback(p!.id, "P-MO-02", "learn_more"); toast(D.mobile.upgradeDone); }}>{D.mobile.upgrade}</PillButton>)}
    </div>
  );
}

const DEVICE_ICON: Record<string, typeof Cpu> = { hems_gateway: Cpu, pv_inverter: Sun, home_battery: Zap, wallbox: Plug, heat_pump: Thermometer, smart_meter: Gauge };

function HemsDetail() {
  const { p, t } = usePortal();
  const h = p!.raw.hems!;
  const list = h.deviceList?.length ? h.deviceList : h.devices.map((d) => ({ type: d, manufacturer: null, status: h.offline ? "offline" : "online", lastSeen: null }));
  return (
    <div className="space-y-5">
      <Block title={D.hems.devices}>
        <ul className="divide-y divide-mg-line">
          {list.map((d, i) => {
            const Icon = DEVICE_ICON[d.type] ?? Home;
            const on = d.status === "online";
            return (
              <li key={`${d.type}-${i}`} className="flex items-center gap-3 py-2.5">
                <Icon className="size-6 shrink-0" strokeWidth={STROKE} aria-hidden />
                <div className="min-w-0 flex-1"><p className="font-semibold">{D.hems.types[d.type] ?? d.type}</p>{d.manufacturer && <p className="type-small text-mg-muted">{d.manufacturer}</p>}</div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 text-sm font-semibold", on ? "border-mg-line" : "border-mg-navy")}>
                  <span aria-hidden className={cn("size-2 rounded-full", on ? "bg-[#1E7A4C]" : "bg-[#B42318]")} />{on ? D.hems.online : D.hems.offline}
                </span>
              </li>
            );
          })}
        </ul>
      </Block>
      <Block title={D.hems.pv}>
        {h.pvDaily ? <p>{fill(D.hems.pvDaily, { v: fmtNum(h.pvDaily, 1) })}</p> : <p className="text-mg-muted">{D.hems.noPv}</p>}
      </Block>
      <Block title={D.hems.self}>
        {h.selfConsumption !== null ? (<><p className="mb-2">{fill(D.hems.selfText, { p: Math.round(h.selfConsumption * 100) })}</p><Meter value={h.selfConsumption * 100} max={100} label={D.hems.self} /></>) : <p className="text-mg-muted">{D.hems.noPv}</p>}
      </Block>
      <Block title={D.hems.connection}>
        <p className={cn(!h.offline && "text-mg-muted")}>{h.offline ? t(D.hems.offlineHelp) : t(D.allOnline)}</p>
        {h.offline && <PillButton className="mt-3" onClick={() => actions.openChat({ customerId: p!.id, actionId: "stoerung" })}>{D.hems.report}</PillButton>}
      </Block>
    </div>
  );
}

function ShopDetail() {
  const { p, style, t } = usePortal();
  const orders = p!.raw.shopOrders ?? [];
  const du = style.anrede === "du";
  const accessories = passendCards(p!).filter((k) => /^P-(SH|SL)-/.test(k.rec.productId));
  const delivered = [...new Set(orders.filter((o) => o.status === "delivered").map((o) => o.product))];
  if (!orders.length) return <EmptyState title={D.shop.empty.title} text={D.shop.empty.text} funki="idle" className="rounded-[24px] bg-mg-surface" />;
  const ICON: Record<string, typeof Sun> = { sun: Sun, car: Car, home: Home, gauge: Gauge, shop: ShoppingBag };
  return (
    <div className="space-y-5">
      <Block title={D.shop.orders}>
        <ul className="divide-y divide-mg-line">
          {orders.slice().reverse().map((o) => {
            const Icon = ICON[D.shop.categoryIcon[o.category ?? ""] ?? "shop"] ?? ShoppingBag;
            return (
              <li key={o.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mg-surface"><Icon className="size-5" strokeWidth={STROKE} aria-hidden /></span>
                <div className="min-w-0 flex-1"><p className="font-semibold">{o.product}{o.quantity > 1 ? ` × ${o.quantity}` : ""}</p><p className="type-small text-mg-muted">{fmtDate(o.at)} · {D.shop.status[o.status] ?? o.status}</p></div>
                <span className="tabular-nums">{o.valueEur !== null ? `${fmtNum(o.valueEur, 2)} €` : "—"}</span>
              </li>
            );
          })}
        </ul>
      </Block>
      {delivered.some((x) => PRODUCT_TIPS[x]) && (
        <Block title={du ? D.shop.tipTitle : D.shop.tipTitleSie}>
          <ul className="space-y-2">{delivered.filter((x) => PRODUCT_TIPS[x]).map((x) => <li key={x}><span className="font-semibold">{x}: </span>{tx(style, PRODUCT_TIPS[x])}</li>)}</ul>
        </Block>
      )}
      <Block title={D.shop.accessories}>
        {accessories.length ? (
          <ul className="space-y-2">{accessories.map((k) => <li key={k.rec.productId}><span className="font-semibold">{OFFER_TEXT[k.rec.productId]?.title ?? k.rec.product}: </span>{t(k.reason)}</li>)}</ul>
        ) : <p className="text-mg-muted">{t(D.nothingMore)}</p>}
      </Block>
      <Block title={D.shop.help}>
        <p className="mb-3">{t(D.shop.helpText)}</p>
        <PillButton variant="outline" onClick={() => actions.openChat({ customerId: p!.id, draft: fill(D.shop.helpDraft, { product: orders.at(-1)!.product }) })}>{D.shop.help}</PillButton>
      </Block>
    </div>
  );
}
