// Mein Eco-Zuhause – pure computation. The displayed score is max(stored best, current): it never sinks.
import type { RawCustomer } from "@/lib/engine";
import { DATA_ACTIONS, ECO_BASE, ECO_LEVELS, ECO_MAX, ECO_THRESHOLDS, OWNERSHIP_BONUS, SELF_ACTIONS, type EcoAction } from "@/config/ecoHome";

export type EcoInput = { self: string[]; meterReadings: number; profiling: boolean };
export type EcoItem = EcoAction & { earned: boolean };
export type EcoResult = { score: number; items: EcoItem[]; bonus: number; level: number; next: { name: string; missing: number; step: string } | null };

function dataEarned(c: RawCustomer, id: string, input: EcoInput): boolean {
  switch (id) {
    case "zaehler_digital": return input.meterReadings > 0 || c.events.some((e) => e.type === "meter_reading_submitted");
    case "laden_guenstig": {
      const d = c.charging?.byDaytime;
      const total = d ? d.morgens + d.mittags + d.abends + d.nachts : 0;
      return total > 0 && (d!.mittags + d!.nachts) / total >= ECO_THRESHOLDS.cheapChargingShare;
    }
    case "eigenverbrauch": return (c.hems?.selfConsumption ?? 0) >= ECO_THRESHOLDS.selfConsumption;
    case "app": return c.app;
    default: return false;
  }
}

export function ownershipBonus(c: RawCustomer): number {
  const items = [
    c.electricity?.feedIn || c.hems?.devices.includes("pv_inverter"),
    c.hems?.devices.includes("heat_pump") || c.electricity?.tariff === "StromWärme",
    c.hems?.devices.includes("wallbox") || c.shop.includes("Wallbox 11 kW"),
    c.shop.includes("Balkonkraftwerk 800 W"),
    c.shop.some((s) => /Smart Plug|Thermostat/.test(s)),
  ].filter(Boolean).length;
  return Math.min(OWNERSHIP_BONUS.max, items * OWNERSHIP_BONUS.perItem);
}

export function levelIndex(score: number) {
  let i = 0;
  ECO_LEVELS.forEach((l, k) => { if (score >= l.min) i = k; });
  return i;
}

export function computeEcoHome(c: RawCustomer, input: EcoInput): EcoResult {
  const data = input.profiling ? DATA_ACTIONS.map((a) => ({ ...a, earned: dataEarned(c, a.id, input) })) : [];
  const self = SELF_ACTIONS.map((a) => ({ ...a, earned: input.self.includes(a.id) }));
  const items = [...data, ...self];
  const bonus = input.profiling ? ownershipBonus(c) : 0;
  const score = Math.min(ECO_MAX, ECO_BASE + bonus + items.filter((i) => i.earned).reduce((s, i) => s + i.points, 0));
  return { score, items, bonus, level: levelIndex(score), next: nextStep(score, items) };
}

function nextStep(score: number, items: EcoItem[]) {
  const nxt = ECO_LEVELS.find((l) => l.min > score);
  if (!nxt) return null;
  const open = items.filter((i) => !i.earned).sort((a, b) => b.points - a.points);
  return { name: nxt.name, missing: nxt.min - score, step: open[0]?.step ?? "" };
}

/** Never sinks: shown score = max(best seen, current). */
export const shownScore = (current: number, best?: number) => Math.max(current, best ?? 0);
