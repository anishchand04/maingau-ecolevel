// Engine context (Master-Prompt §6b): region & weather, shop cross-selling reasons, mobile notes. Pure functions.
// engine.ts calls only regionVec() and withRegionEvidence() at two marked places. Region may raise relevance –
// it never lowers a score, blocks an offer or changes service priority (fairness test in src/test/context.test.ts).
import type { NeedResult, Profile, RawCustomer, Recommendation } from "@/lib/engine";
import type { WeatherData } from "@/lib/data-types";
import weatherRaw from "@/data/weather.json";
import { HEAT_THRESHOLDS, REGION_BONUS, REGION_TEXT, SUN_THRESHOLDS, TWIN_REGION_WEIGHT, classify, type Level } from "@/config/region";
import { HEATING_MONTHS, MAX_CARDS, MOBILE_NOTES, SHOP_RULES, type RuleCtx } from "@/config/shopRules";

export const WEATHER = weatherRaw as WeatherData;

/** Location is used like other personal signals: only with profiling consent. */
const profiled = (c: RawCustomer) => c.consent.profiling_analytics === "granted";

export type RegionInfo = { city: string; sun: Level; heat: Level; radiation: number; hdd: number; note: string };

export function regionOf(c: RawCustomer): RegionInfo | null {
  const city = c.region?.city ?? c.city;
  const w = WEATHER.cities[city];
  if (!w) return null;
  return { city, sun: classify(w.radiationKwhM2, SUN_THRESHOLDS), heat: classify(w.heatingDegreeDays, HEAT_THRESHOLDS),
    radiation: w.radiationKwhM2, hdd: w.heatingDegreeDays, note: REGION_TEXT.note };
}

const LEVELS: Level[] = ["hoch", "mittel", "niedrig"];
/** Twin-similarity features (one-hot sun + heat, weighted). Zero without consent or region – never used for clustering. */
export function regionVec(c: RawCustomer): number[] {
  const r = profiled(c) ? regionOf(c) : null;
  return [...LEVELS.map((l) => (r?.sun === l ? TWIN_REGION_WEIGHT : 0)), ...LEVELS.map((l) => (r?.heat === l ? TWIN_REGION_WEIGHT : 0))];
}

/**
 * Region as additional evidence for candidate relevance only. Raises a need score (capped at 100) when the need
 * already has other evidence – region is never the sole reason. Never lowers anything.
 */
export function withRegionEvidence(c: RawCustomer, needs: NeedResult[]): NeedResult[] {
  if (!profiled(c)) return needs;
  const r = regionOf(c);
  if (!r) return needs;
  const add: Record<string, { points: number; text: string }> = {};
  if (r.sun === REGION_BONUS.sun.level) add[REGION_BONUS.sun.need] = { points: REGION_BONUS.sun.points, text: REGION_TEXT.sunEvidence.replace("{city}", r.city) };
  if (r.heat === REGION_BONUS.heat.level) add[REGION_BONUS.heat.need] = { points: REGION_BONUS.heat.points, text: REGION_TEXT.heatEvidence.replace("{city}", r.city) };
  return needs.map((n) => {
    const a = add[n.id];
    if (!a || n.evidence.length === 0) return n;
    return { ...n, score: Math.min(100, n.score + a.points), evidence: [...n.evidence, a.text] };
  });
}

// ---------- "Passt zu dir" ----------
const has = (c: RawCustomer, d: string) => !!c.hems?.devices.includes(d);
export function ruleCtx(c: RawCustomer, month: number): RuleCtx {
  const r = profiled(c) ? regionOf(c) : null;
  const ev = !!(c.autostrom || c.charging || has(c, "wallbox") || c.shop.includes("Wallbox 11 kW"));
  const wallbox = has(c, "wallbox") || c.shop.includes("Wallbox 11 kW");
  const heatPump = has(c, "heat_pump") || (c.hems?.heatPumpDaily ?? 0) > 0 || c.electricity?.tariff === "StromWärme";
  const pv = has(c, "pv_inverter") || !!c.electricity?.feedIn || (c.hems?.pvDaily ?? 0) > 0;
  const sustainable = pv || heatPump || c.shop.some((s) => /Balkon|Solar/i.test(s)) || c.electricity?.tariff === "StromWärme";
  return { c, month, sun: r?.sun ?? null, heat: r?.heat ?? null, ev, wallbox, heatPump, pv, sustainable };
}

export type CrossSellCard = { rec: Recommendation; ruleId: string; profile: string; reason: { du: string; sie: string } };

/**
 * Up to 3 further candidates the engine already allows (eligible SELL, positive value, past the benefit gate),
 * each with a personal reason from a shop rule. No rule → no card. The main recommendation is excluded.
 */
export function crossSellCards(p: Profile, month = 10, exclude: string[] = []): CrossSellCard[] {
  const x = ruleCtx(p.raw, month);
  const out: CrossSellCard[] = [];
  for (const rec of p.recs) {
    if (out.length >= MAX_CARDS) break;
    if (rec.action !== "SELL" || rec.policy !== "eligible" || rec.dClv <= 0) continue;
    if (rec.productId === p.nba.productId || exclude.includes(rec.productId)) continue;
    const rule = SHOP_RULES.find((r) => r.productId === rec.productId && r.when(x));
    if (rule) out.push({ rec, ruleId: rule.id, profile: rule.profile, reason: { du: rule.du(x), sie: rule.sie(x) } });
  }
  return out;
}

export const isHeatingSeason = (month: number) => HEATING_MONTHS.includes(month);

/** Info notes for mobile customers – never a sale. */
export function mobileNotes(c: RawCustomer): { id: string; du: string; sie: string }[] {
  const d = c.mobile?.roamingDays3m ?? 0;
  if (!c.mobile || d < MOBILE_NOTES.roamingMinDays) return [];
  return [{ id: "roaming", du: MOBILE_NOTES.roaming.du.replace("{n}", String(d)), sie: MOBILE_NOTES.roaming.sie.replace("{n}", String(d)) }];
}
