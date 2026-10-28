// Learning loop: random holdout → outcomes → uplift → proposed rates → versioned, approved, reversible.
// Learning only changes estimates (the rates behind p(accept)); rules, consent and guardrails are never touched.
// All functions are pure; persistence lives in the store.
import { BASE_RATES, CATALOG, CONTROL_RATE, ENGINE_VERSION, RAW_CUSTOMERS, type Profile, type Rates } from "@/lib/engine";
import { LEARNING, THRESHOLDS } from "@/config/thresholds";

export type Group = "treated" | "control";
export type Outcome = {
  id: string; customerId: string; offer: string; channel: string; version: string; group: Group; at: string;
  /** null = result still open */
  converted: boolean | null; response: "sent" | "held_out" | "clicked" | "dismissed" | "converted" | "ignored";
  simulated?: boolean;
};
export type RateChange = { offer: string; channel: string; from: number; to: number; n: number; conversions: number };
export type VersionStatus = "proposed" | "active" | "archived" | "rejected" | "rolled_back";
export type LearnVersion = { id: string; at: string; parent: string | null; status: VersionStatus; rates: Rates; changes: RateChange[]; note: string; auto?: boolean; closedTreated?: number };
/** One point of the live learning curve: per offer × channel the engine's active rate, the data estimate and the sample size. */
export type HistoryPoint = { step: number; at: string; closed: number; version: string | null; cells: Record<string, { est: number; active: number; n: number }> };
export const cellKey = (offer: string, channel: string) => `${offer}|${channel}`;
export const baseRate = (offer: string, channel: string) => BASE_RATES.acceptance[offer]?.[channel] ?? BASE_RATES.offerRate[offer] ?? THRESHOLDS.noHistoryPrior;
export const currentRate = (r: Rates, offer: string, channel: string) => r.acceptance[offer]?.[channel] ?? r.offerRate[offer] ?? THRESHOLDS.noHistoryPrior;

/** Engine version string: the base engine, plus the active learning version. */
export const versionLabel = (activeId: string | null) => (activeId ? `${ENGINE_VERSION}+${activeId}` : ENGINE_VERSION);

// ---------- Holdout ----------
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Deterministic, reproducible assignment. Same customer → same group for a given percentage and salt. */
export const holdoutGroup = (customerId: string, pct: number): Group => (pct > 0 && hash(`${LEARNING.holdoutSalt}:${customerId}`) % 100 < pct ? "control" : "treated");
/** Only a SELL that is allowed anyway can be held back. CARE, WAIT and blocked cases are never part of the experiment. */
export const isHoldout = (p: Profile, pct: number) =>
  p.nba.action === "SELL" && p.nba.policy === "eligible" && p.nba.dClv > 0 && holdoutGroup(p.id, pct) === "control";

// ---------- Statistics ----------
export function wilson(x: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = x / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
export type Arm = { n: number; conversions: number; rate: number };
const arm = (n: number, conversions: number): Arm => ({ n, conversions, rate: n ? conversions / n : 0 });
export type Uplift = { treated: Arm; control: Arm; uplift: number; ci: [number, number]; enough: boolean };
/** Difference of two proportions with a Newcombe interval. `enough` is false for small control groups: no effect statement then. */
export function upliftOf(treated: Arm, control: Arm): Uplift {
  const [l1, u1] = wilson(treated.conversions, treated.n), [l2, u2] = wilson(control.conversions, control.n);
  const d = treated.rate - control.rate;
  const ci: [number, number] = [d - Math.sqrt((treated.rate - l1) ** 2 + (u2 - control.rate) ** 2), d + Math.sqrt((u1 - treated.rate) ** 2 + (control.rate - l2) ** 2)];
  const enough = control.n >= LEARNING.minControlN && control.conversions >= LEARNING.minControlConversions && treated.n > 0;
  return { treated, control, uplift: d, ci, enough };
}

const closed = (o: Outcome) => o.converted !== null;
function armOf(list: Outcome[]): Arm { const c = list.filter(closed); return arm(c.length, c.filter((o) => o.converted).length); }

/** Uplift per offer from live, randomised outcomes (this is the only data that may be called a causal estimate). */
export function upliftByOffer(outcomes: Outcome[]) {
  const offers = [...new Set(outcomes.map((o) => o.offer))];
  return offers.map((offer) => {
    const mine = outcomes.filter((o) => o.offer === offer);
    return { offer, ...upliftOf(armOf(mine.filter((o) => o.group === "treated")), armOf(mine.filter((o) => o.group === "control"))) };
  }).sort((a, b) => a.offer.localeCompare(b.offer));
}

// ---------- Rate proposal ----------
const stepLimit = (v: number, current: number) => {
  const lo = current * (1 - LEARNING.maxRelChange), hi = current * (1 + LEARNING.maxRelChange);
  return Math.min(THRESHOLDS.maxPAccept, Math.max(LEARNING.rateFloor, Math.min(hi, Math.max(lo, v))));
};
const treatedCells = (outcomes: Outcome[]) => {
  const cells = new Map<string, Outcome[]>();
  for (const o of outcomes.filter((x) => x.group === "treated" && closed(x))) cells.set(cellKey(o.offer, o.channel), [...(cells.get(cellKey(o.offer, o.channel)) ?? []), o]);
  return cells;
};
/** Data estimate per cell: shrinkage of ALL live treated results towards the BASE rate, (conversions + base·k) / (n + k). Same data → same estimate. */
export function cellEstimates(outcomes: Outcome[], base: Rates = BASE_RATES) {
  const out: Record<string, { est: number; n: number; conversions: number }> = {};
  for (const [key, list] of treatedCells(outcomes)) {
    const [offer, channel] = key.split("|");
    const prior = currentRate(base, offer, channel), conversions = list.filter((o) => o.converted).length;
    out[key] = { est: Math.min(THRESHOLDS.maxPAccept, Math.max(LEARNING.rateFloor, (conversions + prior * LEARNING.shrinkK) / (list.length + LEARNING.shrinkK))), n: list.length, conversions };
  }
  return out;
}
/**
 * Proposal: move each cell with enough data from the active rate towards its data estimate, by at most ±maxRelChange per step.
 * Cells below minCellN stay unchanged. Historical rows are not used – the base rates are already built from them.
 */
export function proposeRates(outcomes: Outcome[], current: Rates, base: Rates = BASE_RATES): { rates: Rates; changes: RateChange[] } {
  const rates: Rates = { offerRate: { ...current.offerRate }, acceptance: Object.fromEntries(Object.entries(current.acceptance).map(([k, v]) => [k, { ...v }])) };
  const changes: RateChange[] = [];
  for (const [key, e] of Object.entries(cellEstimates(outcomes, base))) {
    const [offer, channel] = key.split("|");
    if (e.n < LEARNING.minCellN || !(offer in current.offerRate)) continue;
    const from = currentRate(current, offer, channel), to = stepLimit(e.est, from);
    if (Math.abs(to - from) < 1e-4) continue;
    rates.acceptance[offer] = { ...rates.acceptance[offer], [channel]: to };
    changes.push({ offer, channel, from, to, n: e.n, conversions: e.conversions });
  }
  return { rates, changes };
}
const sameRates = (a: RateChange[], b: RateChange[]) => a.length === b.length && a.every((x) => b.some((y) => y.offer === x.offer && y.channel === x.channel && Math.abs(y.to - x.to) < 1e-4));
/** A proposal identical to one that was rolled back is not proposed again (no endless loop). */
export const repeatsRolledBack = (changes: RateChange[], versions: LearnVersion[]) => versions.some((v) => v.status === "rolled_back" && sameRates(v.changes, changes));

/**
 * Auto-rollback check: did the results under the active version contradict its change?
 * A rate moved UP is contradicted if the observed treated rate's upper bound is below the old rate; a rate moved DOWN, if the lower bound is above it.
 */
export function contradicted(outcomes: Outcome[], version: LearnVersion | undefined): { offer: string; channel: string } | null {
  if (!version) return null;
  const label = version.id;
  for (const c of version.changes) {
    const mine = outcomes.filter((o) => o.group === "treated" && closed(o) && o.offer === c.offer && o.channel === c.channel && o.version.endsWith(`+${label}`));
    if (mine.length < LEARNING.minCellN) continue;
    const [lo, hi] = wilson(mine.filter((o) => o.converted).length, mine.length);
    if ((c.to > c.from && hi < c.from) || (c.to < c.from && lo > c.from)) return { offer: c.offer, channel: c.channel };
  }
  return null;
}

/** Snapshot for the live curve. Only cells with a few results, to keep the history small. */
export function historyPoint(step: number, outcomes: Outcome[], active: Rates, activeId: string | null): HistoryPoint {
  const cells: HistoryPoint["cells"] = {};
  for (const [key, e] of Object.entries(cellEstimates(outcomes))) {
    if (e.n < 5) continue;
    const [offer, channel] = key.split("|");
    cells[key] = { est: e.est, active: currentRate(active, offer, channel), n: e.n };
  }
  return { step, at: new Date().toISOString(), closed: outcomes.filter(closed).length, version: activeId, cells };
}

export const activeRates = (versions: LearnVersion[], activeId: string | null): Rates => versions.find((v) => v.id === activeId)?.rates ?? BASE_RATES;
export const nextVersionId = (versions: LearnVersion[]) => `L${versions.length + 1}`;

// ---------- Historical comparison (observed, not causal) ----------
/** Reactions from nba_action_history incl. the old holdout. Context only – never used to change a rate. */
export function historicalOutcomes() {
  const all = RAW_CUSTOMERS.flatMap((c) => c.history.filter((h) => CATALOG.some((p) => p.product_id === h.offer)).map((h) => ({ offer: h.offer, held: h.response === "held_out", converted: h.converted })));
  const by = (held: boolean) => { const l = all.filter((x) => x.held === held); return arm(l.length, l.filter((x) => x.converted).length); };
  return { treated: by(false), control: by(true), controlRate: CONTROL_RATE };
}

// ---------- Demo: simulated results ----------
/**
 * Demo world: the real rate of a cell differs from what the engine assumes (base × a fixed factor from the range in LEARNING).
 * The engine never sees this number; it can only approach it through results. In real operation, measured conversions replace it.
 */
export function simTruth(offer: string, channel: string): number {
  const [lo, hi] = LEARNING.simFactorRange;
  const factor = lo + ((hash(`truth:${offer}|${channel}`) % 1000) / 1000) * (hi - lo);
  return Math.min(THRESHOLDS.maxPAccept, Math.max(baseRate(offer, channel), 0.03) * factor);
}
/** Deterministic pseudo result for the demo (always flagged `simulated`). Control gets the historical control rate. */
export function simulateResult(o: Outcome): boolean {
  const p = o.group === "control" ? CONTROL_RATE : simTruth(o.offer, o.channel);
  return (hash(`sim:${o.id}`) % 10000) / 10000 < p;
}
