// Demo invoices – every amount is computed from the contract data (installment × months, consumption × price
// + base price, charging costs from charge_sessions, mobile fee). Clearly marked as demo, never a real invoice.
import { DECISION_TIME, type RawCustomer } from "@/lib/engine";
import { INVOICE_TEXT as T } from "@/config/details";

export type InvoiceLine = { label: string; amount: number };
export type Invoice = {
  id: string; contract: "electricity" | "gas" | "autostrom" | "mobile"; title: string;
  periodFrom: string; periodTo: string; issued: string; due: string;
  /** positive = to pay, negative = refund */
  amount: number; lines: InvoiceLine[]; bars: { label: string; value: number; unit: string }[];
  tariff: string | null; pgUntil: string | null; customerId: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(s).getTime() + n * 864e5));
const r2 = (v: number) => Math.round(v * 100) / 100;
const de = (v: number, d = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const monthName = (ym: string) => new Date(`${ym}-01`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
const CONTRACT = { electricity: "Strom", gas: "Gas", autostrom: "Autostrom", mobile: "Mobilfunk" };

export function invoicesOf(c: RawCustomer): Invoice[] {
  const out: Invoice[] = [];
  const issued = iso(DECISION_TIME);
  const from = "2025-10-01", to = "2026-09-30";
  for (const key of ["electricity", "gas"] as const) {
    const e = c[key];
    if (!e) continue;
    const energy = r2(e.kwh * e.price), base = r2(e.base * 12), paid = r2(e.installment * 12);
    const coveredKwh = Math.max(0, (paid - base) / e.price);
    out.push({
      id: `RE-${c.id}-${key === "electricity" ? "S" : "G"}26`, contract: key, title: fill(T.annual, { contract: CONTRACT[key] }),
      periodFrom: from, periodTo: to, issued, due: addDays(issued, T.dueDays),
      amount: r2(energy + base - paid),
      lines: [
        { label: fill(T.lines.energy, { kwh: Math.round(e.kwh).toLocaleString("de-DE"), price: de(e.price * 100, 2) }), amount: energy },
        { label: fill(T.lines.base, { base: de(e.base) }), amount: base },
        { label: fill(T.lines.paid, { inst: de(e.installment) }), amount: -paid },
      ],
      bars: [{ label: T.bars.used, value: Math.round(e.kwh), unit: "kWh" }, { label: T.bars.covered, value: Math.round(coveredKwh), unit: "kWh" }],
      tariff: e.tariff, pgUntil: e.pgUntil, customerId: c.id,
    });
  }
  const months = c.consumption?.chargingMonthly ?? [];
  if (c.autostrom) {
    for (const m of months.filter((x) => (x.eur ?? 0) > 0)) {
      const end = iso(new Date(new Date(`${m.month}-01`).getFullYear(), new Date(`${m.month}-01`).getMonth() + 1, 0, 12));
      out.push({
        id: `AS-${c.id}-${m.month.replace("-", "")}`, contract: "autostrom", title: fill(T.monthly, { contract: CONTRACT.autostrom, month: monthName(m.month) }),
        periodFrom: `${m.month}-01`, periodTo: end, issued: addDays(end, 3), due: addDays(end, 3 + T.dueDays),
        amount: r2(m.eur ?? 0), lines: [{ label: fill(T.lines.charge, { n: m.sessions, kwh: de(m.kwh, 1) }), amount: r2(m.eur ?? 0) }],
        bars: months.map((x) => ({ label: new Date(`${x.month}-01`).toLocaleDateString("de-DE", { month: "short" }), value: Math.round(x.kwh), unit: "kWh" })),
        tariff: "Autostrom", pgUntil: null, customerId: c.id,
      });
    }
  }
  if (c.mobile) {
    for (const ym of ["2026-07", "2026-08", "2026-09"]) {
      const end = iso(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0, 12));
      out.push({
        id: `MO-${c.id}-${ym.replace("-", "")}`, contract: "mobile", title: fill(T.monthly, { contract: CONTRACT.mobile, month: monthName(ym) }),
        periodFrom: `${ym}-01`, periodTo: end, issued: `${ym}-01`, due: addDays(`${ym}-01`, T.dueDays),
        amount: r2(c.mobile.fee), lines: [{ label: fill(T.lines.mobile, { plan: c.mobile.plan, sims: c.mobile.sims }), amount: r2(c.mobile.fee) }],
        bars: [{ label: "Ø genutzt", value: c.mobile.used, unit: "GB" }, { label: "Inklusive", value: c.mobile.gb, unit: "GB" }],
        tariff: `Mobil ${c.mobile.plan}`, pgUntil: null, customerId: c.id,
      });
    }
  }
  return out.sort((a, b) => b.issued.localeCompare(a.issued));
}

/** Sum of the lines must equal the amount – checked in tests. */
export const linesTotal = (inv: Invoice) => r2(inv.lines.reduce((s, l) => s + l.amount, 0));
