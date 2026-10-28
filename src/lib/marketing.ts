// Marketing aggregations (pure). Every number is computed from the dataset or the engine – nothing invented.
import { DECISION_TIME, NO_PROFILE_CLUSTER, type Profile } from "@/lib/engine";
import type { ServiceCase } from "@/lib/cases";
import { CONSENT_CHANNELS } from "@/config/internal";

const daysTo = (d: string | null | undefined) => (d ? Math.ceil((new Date(d).getTime() - DECISION_TIME.getTime()) / 864e5) : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function pgEnding(profiles: Profile[]) {
  const buckets = { d30: 0, d60: 0, d90: 0 };
  for (const p of profiles) {
    const d = daysTo(p.raw.electricity?.pgUntil);
    if (d === null || d < 0 || d > 90 || p.raw.electricity?.cancelled) continue;
    if (d <= 30) buckets.d30++; else if (d <= 60) buckets.d60++; else buckets.d90++;
  }
  return { total: buckets.d30 + buckets.d60 + buckets.d90, ...buckets };
}

export const crossSellRate = (profiles: Profile[]) => avg(profiles.map((p) => p.raw.lines));
export const avgClv = (profiles: Profile[]) => avg(profiles.map((p) => p.raw.clv));
/** Σ ΔCLV of the current recommendation list (SELL + CARE) – a scenario value. */
export const expectedValue = (profiles: Profile[]) => profiles.filter((p) => p.nba.action !== "WAIT").reduce((s, p) => s + Math.max(0, p.nba.dClv), 0);

export const hasEv = (p: Profile) => !!(p.raw.autostrom || p.raw.charging || p.raw.shop.includes("Wallbox 11 kW") || p.raw.hems?.devices.includes("wallbox"));
export const hasPv = (p: Profile) => !!(p.raw.electricity?.feedIn || (p.raw.hems?.pvDaily ?? 0) > 0);
export const hasHeatPump = (p: Profile) => !!((p.raw.hems?.heatPumpDaily ?? 0) > 0 || p.raw.electricity?.tariff === "StromWärme" || p.raw.hems?.devices.includes("heat_pump"));
export const hasSmartMeter = (p: Profile) => p.raw.electricity?.meter === "smart_meter_imsys";

export type SegmentRow = { cluster: string; eco: number; size: number; clv: number; churn: number; ev: number; pv: number; hp: number; sm: number };
export function segments(profiles: Profile[]): SegmentRow[] {
  const map = new Map<string, Profile[]>();
  for (const p of profiles) {
    const k = `${p.cluster}|${p.ecoLevel}`;
    map.set(k, [...(map.get(k) ?? []), p]);
  }
  const share = (g: Profile[], f: (p: Profile) => boolean) => g.filter(f).length / g.length;
  return [...map.entries()].map(([k, g]) => {
    const [cluster, eco] = k.split("|");
    return { cluster, eco: Number(eco), size: g.length, clv: avgClv(g), churn: avg(g.map((p) => p.raw.churn)),
      ev: share(g, hasEv), pv: share(g, hasPv), hp: share(g, hasHeatPump), sm: share(g, hasSmartMeter) };
  }).sort((a, b) => (a.cluster === NO_PROFILE_CLUSTER ? 1 : 0) - (b.cluster === NO_PROFILE_CLUSTER ? 1 : 0) || b.size - a.size);
}

export const decisionMix = (profiles: Profile[]) => ({
  SELL: profiles.filter((p) => p.nba.action === "SELL").length,
  CARE: profiles.filter((p) => p.nba.action === "CARE").length,
  WAIT: profiles.filter((p) => p.nba.action === "WAIT").length,
});

/** Blocked SELL candidates by reason – each customer counted once per reason. */
export function blockedByReason(profiles: Profile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of profiles) {
    const codes = new Set(p.recs.filter((r) => r.action === "SELL" && r.policy !== "eligible").map((r) => r.policyCode));
    for (const c of codes) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
}

/** Top actions: undecided SELL/CARE, by expected value. Expiring guarantee + high CLV rises to the top by itself. */
export function topActions(profiles: Profile[], decided: (id: string, pid: string) => boolean, n = 10) {
  return profiles.filter((p) => p.nba.action !== "WAIT" && !decided(p.id, p.nba.productId))
    .sort((a, b) => b.nba.dClv - a.nba.dClv).slice(0, n);
}

export function consentShares(profiles: Profile[]) {
  return CONSENT_CHANNELS.map((c) => ({ ...c, share: profiles.filter((p) => p.raw.consent[c.key] === "granted").length / (profiles.length || 1) }));
}

/** Churn signals: cancellations (with reason if captured), payment reminders, billing tickets → service, not sales. */
export function churnSignals(profiles: Profile[], cases: ServiceCase[]) {
  const cancellations = [
    ...profiles.filter((p) => p.raw.electricity?.cancelled || p.raw.gas?.cancelled).filter((p) => !cases.some((k) => k.customerId === p.id && k.kind === "kuendigung"))
      .map((p) => ({ id: p.id, contract: p.raw.electricity?.cancelled ? "Strom" : "Gas", reason: null as string | null, source: "Datensatz / Event" })),
    ...cases.filter((k) => k.kind === "kuendigung").map((k) => ({ id: k.customerId, contract: k.title.replace("Kündigung ", ""), reason: k.reason ?? null, source: "Funki" })),
  ];
  const dunning = profiles.filter((p) => Math.max(p.raw.electricity?.dunning ?? 0, p.raw.gas?.dunning ?? 0) >= 1)
    .map((p) => ({ id: p.id, level: Math.max(p.raw.electricity?.dunning ?? 0, p.raw.gas?.dunning ?? 0) }));
  const billing = profiles.filter((p) => p.raw.tickets.some((t) => t.category === "billing" && t.status === "open")).map((p) => p.id);
  return { cancellations, dunning, billing };
}
