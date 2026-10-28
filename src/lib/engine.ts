// MAINGAU EcoLevel – Customer Intelligence Engine (Spec V2).
// Runs fully in the browser on the synthetic MAINGAU Build Days dataset.
// Scores are transparent heuristics (rule-based + statistical), NOT calibrated ML probabilities.
//
// Decision path (Spec V2 §1):
// snapshot + event replay → data-use policy → profile → need discovery → need vector → clustering
// → twins → need gap → solution matching → CARE/consent gatekeeper → benefit gate + ΔCLV → SELL/CARE/WAIT
import raw from "@/data/maingau.json";
import type { Consumption, PortalPage, ShopOrder, StyleProfile, Transcript } from "@/lib/data-types";
import { regionVec, withRegionEvidence } from "@/engine/context";
import { BENEFIT, CONTRACT_TRIGGER_OFFERS, ENGINE_VERSION, ESTIMATE_STATUS, THRESHOLDS, UNRELIABLE_LEGACY_BASELINE } from "@/config/thresholds";

export { ENGINE_VERSION, ESTIMATE_STATUS, BENEFIT, UNRELIABLE_LEGACY_BASELINE, THRESHOLDS };

export type Energy = {
  tariff: string; status: string; kwh: number; price: number; base: number; installment: number;
  pgUntil: string | null; meter: string; feedIn: boolean; dunning: number; cancelled: boolean;
  noticeWeeks?: number | null; paymentMethod?: string | null; lastMeterReadingAt?: string | null; startDate?: string | null;
};
export type Declared = { heating?: "heat_pump" | "gas" | "other"; ev?: boolean; moving?: boolean };
export type RawCustomer = {
  id: string; since: string; birthYear: number; city: string; household: number; portal: boolean; app: boolean;
  clv: number; margin: number; cts: number; churn: number; churnDrivers: string; serviceImpact: number; lines: number;
  electricity: Energy | null; gas: Energy | null;
  mobile: { plan: string; gb: number; used: number; limitHits: number; sims: number; fee: number; roamingDays3m?: number; minTermEnd?: string | null } | null;
  autostrom: { car: string; battery: number } | null;
  charging: {
    sessions: number; kwh: number; spend: number; failed30d: number; failedTotal: number; dcShare: number;
    acCount?: number; dcCount?: number; byDaytime?: Record<"morgens" | "mittags" | "abends" | "nachts", number>;
    failedSessions?: { at: string; status: string; reason: string | null; city: string | null; type: string }[];
  } | null;
  hems: {
    devices: string[]; offline: boolean; pvDaily: number; selfConsumption: number | null; heatPumpDaily: number;
    deviceList?: { type: string; manufacturer: string | null; status: string; lastSeen: string | null }[];
  } | null;
  shop: string[]; consent: Record<string, string>;
  tickets12m: number; openTickets: number; openComplaint: boolean; lastCsat: number | null;
  tickets: {
    id: string; at: string; channel: string; category: string; status: string; text: string; csat: number | null;
    callNote?: string | null; handlingCostEur?: number | null; firstContactResolution?: boolean | null;
    resolutionCode?: string | null; goodwillEur?: number | null; repeatOf?: string | null; resolvedAt?: string | null;
  }[];
  contacts30d: number;
  history: { at: string; offer: string; channel: string; response: string; converted: boolean }[];
  portalSessions90d: number;
  events: { type: string; at: string; payload: Record<string, unknown> }[];
  transcripts: Transcript[]; consumption: Consumption | null; portalPages: PortalPage[]; style: StyleProfile;
  region?: { city: string; postalPrefix: number }; shopOrders?: ShopOrder[];
  rejected?: string[];
  /** set by event replay / portal */
  signals?: string[];
  declared?: Declared;
  frequency?: string;
};
export type Product = {
  product_id: string; business_line: string; product_name: string; description: string;
  price_indicative_eur: string | number | null; action_type: string; annual_margin_if_bought_eur: number;
  churn_effect_if_bought: number | null; typical_target_signal: string;
};

const data = raw as unknown as {
  snapshot: string; customers: RawCustomer[]; catalog: Product[]; assumptions: Record<string, number>;
  acceptance: Record<string, Record<string, number>>; offerRate: Record<string, number>; controlRate: number;
  campaigns: { id: string; sent: string; subject: string; focus: string; tone: string; recipients: number; opens: number; clicks: number; conversions: number }[];
};
export const SNAPSHOT = new Date(data.snapshot + "T23:59:00");
/** Decision time = after replaying the 2026-10-01 event stream. */
export const DECISION_TIME = new Date("2026-10-01T23:59:00");
export const A = data.assumptions;
/** Response rates the engine uses for p(accept). The learning loop (src/lib/learning.ts) can replace them with an approved version. */
export type Rates = { offerRate: Record<string, number>; acceptance: Record<string, Record<string, number>> };
export const BASE_RATES: Rates = { offerRate: data.offerRate, acceptance: data.acceptance };
export const CONTROL_RATE = data.controlRate;
export const CATALOG = data.catalog;
export const CAMPAIGNS = data.campaigns;
export const productById = (id: string) => CATALOG.find((p) => p.product_id === id)!;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const daysUntil = (d: string | null) => (d ? (new Date(d).getTime() - DECISION_TIME.getTime()) / 864e5 : Infinity);
const has = (c: RawCustomer, dev: string) => !!c.hems?.devices.includes(dev);
export const gasActive = (c: RawCustomer) => !!c.gas && c.gas.status === "active";
export const gasDeregistered = (c: RawCustomer) => !!c.gas && c.gas.status === "terminated_meter_deregistration";
const smartMeter = (c: RawCustomer) => c.electricity?.meter === "smart_meter_imsys";
export const canProfile = (c: RawCustomer) => c.consent.profiling_analytics === "granted";
const heatPumpEvidence = (c: RawCustomer) =>
  has(c, "heat_pump") || (c.hems?.heatPumpDaily ?? 0) > 0 || gasDeregistered(c) || (canProfile(c) && c.declared?.heating === "heat_pump");
const isEV = (c: RawCustomer) => !!c.autostrom || !!c.charging || has(c, "wallbox") || c.shop.includes("Wallbox 11 kW") || (canProfile(c) && !!c.declared?.ev);
const hasWallbox = (c: RawCustomer) => has(c, "wallbox") || c.shop.includes("Wallbox 11 kW");

// =====================================================================================
// Event replay (2026-10-01 stream): today's events change consent, contracts and cases.
// =====================================================================================
export function replayEvents(c0: RawCustomer): RawCustomer {
  const c: RawCustomer = structuredClone(c0);
  c.signals = [];
  const seen = new Set<string>();
  const evs = [...c.events].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of evs) {
    const key = `${e.type}|${e.at}|${JSON.stringify(e.payload)}`;
    if (seen.has(key)) continue; // idempotent: duplicate events are ignored
    seen.add(key);
    const p = e.payload as Record<string, string | number | undefined>;
    switch (e.type) {
      case "consent_changed":
        c.consent[String(p.consent_type)] = String(p.new_status);
        c.signals.push(`Consent ${p.consent_type} → ${p.new_status} (today)`);
        break;
      case "contract_cancellation_received": {
        const tgt = p.commodity === "gas" ? c.gas : c.electricity;
        if (tgt) { tgt.cancelled = true; tgt.status = "cancellation_pending"; }
        c.churn = Math.max(c.churn, A.cancellation_pending ?? 0.95);
        c.signals.push("Cancellation received today");
        break;
      }
      case "dunning_level_changed": {
        const lvl = Number(p.new_level ?? 0);
        const before = Math.max(c.electricity?.dunning ?? 0, c.gas?.dunning ?? 0);
        if (c.electricity) c.electricity.dunning = lvl; else if (c.gas) c.gas.dunning = lvl;
        if (lvl >= 2 && before < 2) c.churn = Math.min(0.95, c.churn + A.dunning_ge2);
        c.signals.push(`Payment reminder level ${lvl} (today)`);
        break;
      }
      case "gas_meter_deregistration_received":
        if (c.gas) c.gas.status = "terminated_meter_deregistration";
        c.signals.push(`Gas meter deregistration received (effective ${p.effective_date ?? "soon"}) – new heating system likely`);
        break;
      case "ticket_created": {
        const cat = String(p.category ?? "other");
        c.tickets = [...c.tickets, { id: String(p.ticket_id ?? `TK-EV-${c.tickets.length}`), at: e.at.slice(0, 10), channel: String(p.channel ?? "portal_form"), category: cat, status: "open", text: String(p.message_text ?? ""), csat: null }];
        c.openTickets += 1; c.tickets12m += 1;
        if (cat === "complaint" && !c.openComplaint) { c.openComplaint = true; c.churn = Math.min(0.95, c.churn + A.open_complaint); }
        break;
      }
      case "ticket_updated":
        if (p.status === "open" && String(p.ticket_id).includes("complaint") && !c.openComplaint) {
          c.openComplaint = true; c.openTickets = Math.max(1, c.openTickets);
        }
        break;
      case "charge_session_failed":
        if (c.charging) {
          const before = c.charging.failed30d;
          c.charging = { ...c.charging, failed30d: before + 1, failedTotal: c.charging.failedTotal + 1 };
          if (before + 1 >= 3 && before < 3) c.churn = Math.min(0.95, c.churn + A.failed_charges_30d_ge3);
        }
        break;
      case "hems_device_offline":
        if (c.hems) c.hems = { ...c.hems, offline: true };
        break;
      case "order_placed":
        if (p.product_name && !c.shop.includes(String(p.product_name))) c.shop = [...c.shop, String(p.product_name)];
        break;
      case "mobile_data_threshold":
        c.signals.push(`Mobile data at ${p.threshold_pct} % (today)`);
        break;
      case "agent_nba_feedback":
        if (p.dismiss_reason === "customer_upset" && p.suggested_offer_id) c.rejected = [...(c.rejected ?? []), String(p.suggested_offer_id)];
        break;
    }
  }
  return c;
}

/**
 * New customer data that re-opens "Habe ich schon" blocks (the need may be new): a move re-opens everything,
 * a newly declared EV / heat pump only the products that belong to it. The engine then scores them normally again.
 */
export function unlockedByDeclared(prev: Declared | undefined, next: Declared): string[] | "all" {
  if (next.moving && !prev?.moving) return "all";
  const out: string[] = [];
  if (next.ev === true && prev?.ev !== true) out.push("P-SH-02", "P-AS-01", "P-SL-03", "P-SL-01");
  if (next.heating === "heat_pump" && prev?.heating !== "heat_pump") out.push("P-EN-03", "P-SL-01", "P-SH-03");
  return out;
}

/** Portal changes (consent, feedback, preferences, voluntary answers) applied on top of the replayed record. */
export type Overrides = {
  consent?: Record<string, string>;
  feedback?: Record<string, string>; // productId -> feedback
  frequency?: string;
  declared?: Declared;
};
export function applyOverrides(c0: RawCustomer, o: Overrides): RawCustomer {
  const c: RawCustomer = { ...c0, consent: { ...c0.consent, ...(o.consent ?? {}) } };
  const rej = Object.entries(o.feedback ?? {}).filter(([, f]) => f === "not_interested" || f === "already_have").map(([pid]) => pid);
  if (rej.length) c.rejected = [...new Set([...(c0.rejected ?? []), ...rej])];
  if (o.frequency) c.frequency = o.frequency;
  if (o.declared) c.declared = { ...c0.declared, ...o.declared };
  return c;
}

export const RAW_CUSTOMERS: RawCustomer[] = data.customers.map(replayEvents);

// ---------- Need taxonomy ----------
export const NEEDS = [
  { id: "N01", label: "Reduce energy costs", short: "Energy costs" },
  { id: "N02", label: "Optimize energy consumption", short: "Consumption" },
  { id: "N03", label: "Charge EVs at home", short: "Home charging" },
  { id: "N04", label: "Reduce public charging costs", short: "Public charging" },
  { id: "N05", label: "Improve household connectivity", short: "Connectivity" },
  { id: "N06", label: "Generate renewable energy", short: "Renewables" },
  { id: "N07", label: "Increase price stability", short: "Price stability" },
  { id: "N08", label: "Resolve service problems", short: "Service" },
  { id: "N09", label: "Improve mobile data availability", short: "Mobile data" },
  { id: "N10", label: "Simplify household energy management", short: "Energy mgmt" },
] as const;
export const NEED_DE: Record<string, string> = {
  N01: "Energiekosten senken", N02: "Verbrauch optimieren", N03: "Zu Hause laden", N04: "Unterwegs günstig laden",
  N05: "Gut vernetzter Haushalt", N06: "Eigene erneuerbare Energie", N07: "Planbare Preise", N08: "Hilfe bei Anliegen",
  N09: "Genug mobiles Datenvolumen", N10: "Energie im Haus einfach steuern",
};
export type NeedId = (typeof NEEDS)[number]["id"];
export type NeedKind = "confirmed" | "inferred" | "potential";
export type NeedResult = {
  id: NeedId; label: string; score: number; kind: NeedKind; fulfilled: boolean;
  existing: string | null; solution: string | null; evidence: string[];
};

/**
 * Need discovery. Without profiling consent only contract facts are used (safe fallback, Spec V2 §0/§7):
 * no page views, clicks, telemetry patterns, events or voluntary answers.
 * Payment data (dunning) and age are never used as scoring input.
 */
function discoverNeeds(c: RawCustomer): NeedResult[] {
  const out: NeedResult[] = [];
  const prof = canProfile(c);
  const add = (id: NeedId, score: number, kind: NeedKind, fulfilled: boolean, existing: string | null, solution: string | null, evidence: string[]) => {
    const n = NEEDS.find((x) => x.id === id)!;
    out.push({ id, label: n.label, score: Math.round(clamp(score)), kind, fulfilled, existing, solution, evidence });
  };
  const e = c.electricity;
  const confirmedCat = (cat: string) => c.tickets.some((t) => t.category === cat);
  const behavioural = (fn: () => boolean) => prof && fn();

  // N01 energy costs
  { let s = 15; const ev: string[] = [];
    if (e) { if (e.price >= 0.34) { s += 25; ev.push(`Energy price ${e.price.toFixed(3)} €/kWh`); }
      if (e.kwh > 3500) { s += 20; ev.push(`${e.kwh} kWh/year consumption`); } }
    if (behavioural(() => c.events.some((x) => x.payload?.page === "invoice" || x.payload?.page === "tariff_overview"))) { s += 10; ev.push("Viewed invoice/tariff pages"); }
    if (gasActive(c)) s += 10;
    if (heatPumpEvidence(c) && e?.tariff !== "StromWärme") { s += 30; ev.push(gasDeregistered(c) ? "Gas meter deregistered – new heating system" : "Heat pump in household"); }
    const conf = confirmedCat("tariff") || confirmedCat("billing");
    if (conf) { s += 15; ev.push("Contacted service about tariff/billing"); }
    const sol = heatPumpEvidence(c) && e?.tariff !== "StromWärme" ? "StromWärme" : e ? (smartMeter(c) ? "Dynamischer Stromtarif" : "StromGarant") : "StromAktiv";
    add("N01", s, conf || gasDeregistered(c) ? "confirmed" : "inferred", !!e && e.tariff !== "StromAktiv" && !(heatPumpEvidence(c) && e.tariff !== "StromWärme"), e ? `MAINGAU ${e.tariff}` : null, sol, ev); }
  // N02 optimize consumption
  { let s = 10; const ev: string[] = [];
    if (smartMeter(c)) { s += 25; ev.push("Smart meter installed"); }
    if (e && e.kwh > 4000) { s += 20; ev.push("High household consumption"); }
    if (c.hems) { s += 25; ev.push(`HEMS devices: ${c.hems.devices.join(", ")}`); }
    if (c.shop.some((p) => /Smart|Lesekopf/.test(p))) { s += 15; ev.push("Bought smart-home / metering products"); }
    add("N02", s, "inferred", !!c.hems?.devices.includes("hems_gateway"), c.hems?.devices.includes("hems_gateway") ? "HEMS gateway" : null, smartMeter(c) ? "Dynamischer Stromtarif" : "HEMS Starter-Set", ev); }
  // N03 home charging
  { let s = 0; const ev: string[] = [];
    if (isEV(c)) { s = 45; ev.push(c.autostrom ? `Drives ${c.autostrom.car}` : c.declared?.ev ? "Customer says: drives an EV" : "EV charging signals"); }
    if (behavioural(() => !!c.charging && c.charging.dcShare < 0.5)) { s += 20; ev.push(`${Math.round((1 - c.charging!.dcShare) * 100)}% AC sessions`); }
    if (c.household >= 2 && isEV(c)) s += 10;
    const wb = hasWallbox(c);
    add("N03", s, c.declared?.ev ? "confirmed" : "inferred", wb, wb ? "Wallbox" : null, "Wallbox 11 kW", ev); }
  // N04 public charging costs
  { let s = 0; const ev: string[] = [];
    if (c.charging && prof) { s = 40 + Math.min(40, c.charging.spend / 20); ev.push(`${c.charging.sessions} sessions, ${c.charging.spend.toFixed(0)} € spend (Jun–Sep)`);
      if (c.charging.dcShare > 0.5) { s += 10; ev.push(`${Math.round(c.charging.dcShare * 100)}% fast charging`); } }
    else if (isEV(c)) { s = 40; ev.push(c.autostrom ? "Autostrom customer" : "Drives electric"); }
    add("N04", s, "inferred", !!c.autostrom, c.autostrom ? "MAINGAU Autostrom" : null, "MAINGAU Autostrom", ev); }
  // N05 household connectivity
  { let s = 15 + (c.household - 1) * 15; const ev: string[] = [`Household of ${c.household}`];
    if (c.mobile) { s += 15; ev.push(`Mobile ${c.mobile.plan}`); }
    if (c.app) s += 5;
    add("N05", s, "inferred", false, null, c.mobile ? (c.household > c.mobile.sims ? "Zusatz-SIM" : "Internet (DSL/Glasfaser)") : "Mobil S / M / L", ev); }
  // N06 renewables
  { let s = 10; const ev: string[] = [];
    const pv = has(c, "pv_inverter") || !!e?.feedIn;
    if (pv) { s += 50; ev.push("PV system / feed-in meter"); }
    if (c.shop.includes("Balkonkraftwerk 800 W")) { s += 40; ev.push("Bought Balkonkraftwerk"); }
    if (c.shop.includes("Powerbank Solar")) { s += 15; ev.push("Bought solar powerbank"); }
    if (has(c, "home_battery")) s += 15;
    if (behavioural(() => c.events.some((x) => x.type === "cart_abandoned"))) { s += 10; ev.push("Abandoned a shop cart recently"); }
    const ful = pv || c.shop.includes("Balkonkraftwerk 800 W");
    add("N06", s, "inferred", ful, ful ? (pv ? "PV system" : "Balkonkraftwerk") : null, "Balkonkraftwerk 800 W", ev); }
  // N07 price stability (contract fact – allowed without profiling)
  { let s = 10; const ev: string[] = [];
    const d = daysUntil(e?.pgUntil ?? null);
    if (e && !e.cancelled && d < THRESHOLDS.priceGuaranteeWindowDays) { s += 55; ev.push(d < 0 ? "Price guarantee expired" : `Price guarantee ends in ${Math.round(d)} days`); }
    else if (e && d < 180) { s += 30; ev.push(`Price guarantee ends in ${Math.round(d)} days`); }
    if (e?.tariff === "StromAktiv") { s += 15; ev.push("Tariff without long guarantee"); }
    add("N07", s, "inferred", !!e && (e.tariff === "StromGarant" || e.tariff === "StromKomfort") && d > THRESHOLDS.priceGuaranteeWindowDays, e && e.tariff !== "StromAktiv" ? `${e.tariff} guarantee` : null, "StromGarant", ev); }
  // N08 service problems (always evaluated – service is not profiling)
  { let s = 0; const ev: string[] = [];
    if (c.openTickets) { s += 50; ev.push(`${c.openTickets} open ticket(s)`); }
    if (c.openComplaint) { s += 20; ev.push("Open complaint"); }
    if (c.charging && c.charging.failed30d >= 1) { s += c.charging.failed30d * 12; ev.push(`${c.charging.failed30d} failed charges (30d)`); }
    if (c.lastCsat !== null && c.lastCsat <= 2) { s += 15; ev.push(`Last CSAT ${c.lastCsat}/5`); }
    if (c.hems?.offline) { s += 20; ev.push("HEMS device offline"); }
    if (c.tickets12m >= 2) s += 10;
    add("N08", s, c.openTickets ? "confirmed" : "inferred", s < 30, null, "Service-Only / No offer", ev); }
  // N09 mobile data
  { let s = 0; const ev: string[] = [];
    if (c.mobile) { s = 20 + (c.mobile.used / c.mobile.gb) * 40 + c.mobile.limitHits * 15; ev.push(`${c.mobile.used} of ${c.mobile.gb} GB used avg`); if (c.mobile.limitHits) ev.push(`Limit reached ${c.mobile.limitHits}× in 3m`); }
    else if (behavioural(() => c.app && c.household > 1)) s = 30;
    const conf = c.events.some((x) => x.type === "mobile_data_threshold");
    if (conf) { s += 20; ev.push("Data at 80 % today"); }
    add("N09", s, conf ? "confirmed" : "inferred", !!c.mobile && c.mobile.limitHits === 0 && !conf, c.mobile ? `Mobil ${c.mobile.plan}` : null, c.mobile ? "Mobil Upgrade" : "Mobil S / M / L", ev); }
  // N10 simplify energy management
  { let s = 5; const ev: string[] = [];
    const devs = c.hems?.devices.length ?? 0;
    if (devs >= 2) { s += 20 + devs * 8; ev.push(`${devs} connected energy devices`); }
    if (isEV(c) && e) { s += 15; ev.push("EV + household energy"); }
    if (c.lines >= 2) { s += 15; ev.push(`${c.lines} MAINGAU business lines`); }
    if (heatPumpEvidence(c)) { s += 10; ev.push("Heat pump"); }
    if (has(c, "pv_inverter") || e?.feedIn) { s += 10; ev.push("PV system"); }
    const gw = has(c, "hems_gateway");
    add("N10", s, "inferred", gw, gw ? "HEMS gateway" : null, gw ? "Wallbox-Integration" : "HEMS Starter-Set", ev); }
  return out;
}

// ---------- Clustering (k-means, deterministic, k chosen by silhouette) ----------
const vec = (needs: NeedResult[]) => needs.map((n) => n.score / 100);
function seededRandom(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
export const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};
function kmeans(X: number[][], k: number) {
  const rnd = seededRandom(42);
  const C: number[][] = [X[Math.floor(rnd() * X.length)]];
  while (C.length < k) { // k-means++
    const d = X.map((x) => Math.min(...C.map((c) => dist2(x, c)))); const tot = d.reduce((a, b) => a + b, 0);
    let r = rnd() * tot, i = 0; while (r > d[i]) r -= d[i++]; C.push(X[Math.min(i, X.length - 1)]);
  }
  let assign = new Array(X.length).fill(0);
  for (let it = 0; it < 40; it++) {
    assign = X.map((x) => C.reduce((b, c, j) => (dist2(x, c) < dist2(x, C[b]) ? j : b), 0));
    for (let j = 0; j < k; j++) { const m = X.filter((_, i) => assign[i] === j); if (m.length) C[j] = m[0].map((_, d) => m.reduce((s, r) => s + r[d], 0) / m.length); }
  }
  return { centroids: C, assign };
}
function silhouette(X: number[][], assign: number[], k: number) {
  // sampled silhouette (deterministic every-3rd point) to stay fast in the browser
  const idx = X.map((_, i) => i).filter((i) => i % 3 === 0);
  let tot = 0;
  for (const i of idx) {
    const sums = new Array(k).fill(0), cnt = new Array(k).fill(0);
    for (let j = 0; j < X.length; j++) { if (i === j) continue; sums[assign[j]] += Math.sqrt(dist2(X[i], X[j])); cnt[assign[j]]++; }
    const a = cnt[assign[i]] ? sums[assign[i]] / cnt[assign[i]] : 0;
    let b = Infinity; for (let c = 0; c < k; c++) if (c !== assign[i] && cnt[c]) b = Math.min(b, sums[c] / cnt[c]);
    tot += b === Infinity ? 0 : (b - a) / Math.max(a, b);
  }
  return tot / idx.length;
}

// ---------- CLV (official clv_method) ----------
export function clvFormula(margin: number, cts: number, churn: number) {
  let s = 0; const r = A.discount_rate ?? 0.06; const ch = clamp(churn, 0.01, 0.99);
  for (let t = 1; t <= (A.horizon_years ?? 10); t++) s += ((margin - cts) * (1 - ch) ** (t - 1)) / (1 + r) ** t;
  return s;
}

// ---------- CARE FIRST ----------
export type CareFlag = { code: string; label: string; critical: boolean; churnAdd: number };
export function careFlags(c: RawCustomer): CareFlag[] {
  const f: CareFlag[] = [];
  if (c.openComplaint) f.push({ code: "complaint", label: "Open complaint", critical: true, churnAdd: A.open_complaint });
  else if (c.openTickets) f.push({ code: "ticket", label: `${c.openTickets} open service ticket(s)`, critical: false, churnAdd: 0 });
  const dn = Math.max(c.electricity?.dunning ?? 0, c.gas?.dunning ?? 0);
  if (dn >= 2) f.push({ code: "dunning", label: `Payment problem (reminder level ${dn})`, critical: true, churnAdd: A.dunning_ge2 });
  else if (dn === 1) f.push({ code: "dunning1", label: "Payment reminder open (level 1) – no sales content", critical: false, churnAdd: 0 });
  if ((c.charging?.failed30d ?? 0) >= 3) f.push({ code: "charging", label: `${c.charging!.failed30d} failed charging sessions in 30 days`, critical: true, churnAdd: A.failed_charges_30d_ge3 });
  if (c.hems?.offline) f.push({ code: "hems", label: "HEMS device offline (technical disruption)", critical: true, churnAdd: 0 });
  if (c.electricity?.cancelled || c.gas?.cancelled || c.electricity?.status === "cancellation_pending") f.push({ code: "cancel", label: "Active cancellation process", critical: true, churnAdd: 0 });
  if (c.lastCsat !== null && c.lastCsat <= 2) f.push({ code: "csat", label: `Low satisfaction (CSAT ${c.lastCsat}/5)`, critical: false, churnAdd: A.csat_le2 });
  return f;
}
/** Hard sales blockers (Spec V2 §7 / slide 12 "Exclusions beat offers"). Payment data used ONLY here. */
export function salesBlockers(c: RawCustomer): string[] {
  const b: string[] = [];
  if (c.openComplaint) b.push("open complaint");
  if (c.electricity?.cancelled || c.gas?.cancelled || c.electricity?.status === "cancellation_pending") b.push("cancellation in progress");
  if (Math.max(c.electricity?.dunning ?? 0, c.gas?.dunning ?? 0) >= 1) b.push("payment reminder open");
  if ((c.charging?.failed30d ?? 0) >= 3) b.push("repeated charging failures");
  if (c.hems?.offline) b.push("technical disruption (HEMS offline)");
  return b;
}
export const contactLimit = (c: RawCustomer) => THRESHOLDS.contactLimit30d[c.frequency ?? THRESHOLDS.defaultFrequency] ?? 3;

// ---------- Consent ----------
export const CHANNELS: Record<string, { label: string; consent: string; cost: number; requires?: "portal" | "app" }> = {
  newsletter_email: { label: "E-mail", consent: "marketing_email", cost: A.contact_cost_email_eur },
  sms: { label: "SMS", consent: "marketing_sms", cost: A.contact_cost_sms_eur },
  outbound_call: { label: "Phone call", consent: "marketing_phone", cost: A.contact_cost_call_eur },
  portal_popup: { label: "Portal", consent: "portal_app_personalisation", cost: A.contact_cost_popup_eur, requires: "portal" },
  app_push: { label: "App push", consent: "portal_app_personalisation", cost: A.contact_cost_popup_eur, requires: "app" },
};
export const allowedChannels = (c: RawCustomer) =>
  Object.entries(CHANNELS).filter(([, ch]) => c.consent[ch.consent] === "granted" && (!ch.requires || (ch.requires === "portal" ? c.portal : c.app))).map(([k]) => k);
/** Safe default channel order when there is no response history (Spec V2 §8). */
const CHANNEL_ORDER = ["portal_popup", "app_push", "newsletter_email", "sms", "outbound_call"];

// ---------- Solution matching + Delta-CLV ----------
const PRODUCT_NEED: Record<string, NeedId> = {
  "P-EN-01": "N04", "P-EN-02": "N07", "P-EN-03": "N01", "P-EN-04": "N01", "P-EN-05": "N02", "P-MO-01": "N05", "P-MO-02": "N09",
  "P-MO-03": "N05", "P-IN-01": "N05", "P-SL-01": "N10", "P-SL-02": "N02", "P-SL-03": "N03", "P-SH-01": "N06", "P-SH-02": "N03",
  "P-SH-03": "N01", "P-SH-04": "N02", "P-AS-01": "N04", "P-SV-01": "N08",
};
/** Hard eligibility: prerequisites + products already held. Similarity never overrides these (Spec V2 §4). */
function eligibleProducts(c: RawCustomer): string[] {
  const e = c.electricity; const o: string[] = [];
  const ownsElectricity = !!e && !e.cancelled;
  if (!e && (c.autostrom || gasActive(c) || c.mobile)) o.push("P-EN-01");
  if (ownsElectricity && daysUntil(e!.pgUntil) < THRESHOLDS.priceGuaranteeWindowDays) o.push("P-EN-02");
  if (e?.tariff !== "StromWärme" && heatPumpEvidence(c)) o.push("P-EN-03");
  if (ownsElectricity && !c.gas && !heatPumpEvidence(c)) o.push("P-EN-04");
  if (ownsElectricity && smartMeter(c) && (c.hems || isEV(c) || heatPumpEvidence(c))) o.push("P-EN-05");
  if (!c.mobile && (e || gasActive(c))) o.push("P-MO-01");
  if (c.mobile && (c.mobile.limitHits >= 2 || c.events.some((x) => x.type === "mobile_data_threshold"))) o.push("P-MO-02");
  if (c.mobile && c.household > c.mobile.sims) o.push("P-MO-03");
  if (e || c.mobile) o.push("P-IN-01");
  if ((has(c, "pv_inverter") || e?.feedIn || heatPumpEvidence(c) || isEV(c)) && !has(c, "hems_gateway")) o.push("P-SL-01");
  if (has(c, "hems_gateway") && has(c, "home_battery")) o.push("P-SL-02");
  if (has(c, "hems_gateway") && hasWallbox(c)) o.push("P-SL-03");
  if (!has(c, "pv_inverter") && !e?.feedIn && !c.shop.includes("Balkonkraftwerk 800 W")) o.push("P-SH-01");
  if (isEV(c) && !hasWallbox(c)) o.push("P-SH-02");
  if (gasActive(c) && !c.shop.includes("Smarte Thermostate 3er")) o.push("P-SH-03");
  if (c.portal && !c.shop.includes("Smart Plug 4er-Set")) o.push("P-SH-04");
  if (isEV(c) && !c.autostrom) o.push("P-AS-01");
  return o.filter((x) => !c.rejected?.includes(x));
}

/** Hard, dated contract signals that point directly at a product (slide 6 examples). */
export function strongSignal(c: RawCustomer, pid: string): string | null {
  if (pid === "P-EN-03" && gasDeregistered(c)) return "gas meter deregistered";
  if (pid === "P-EN-03" && canProfile(c) && c.declared?.heating === "heat_pump") return "customer says: heats with a heat pump";
  if (pid === "P-AS-01" && c.shop.includes("Wallbox 11 kW")) return "bought a wallbox in our shop";
  if (pid === "P-AS-01" && canProfile(c) && c.declared?.ev) return "customer says: drives an EV";
  if (pid === "P-MO-02" && c.events.some((x) => x.type === "mobile_data_threshold")) return "data at 80 % today";
  return null;
}

export type Policy ="eligible" | "blocked_consent" | "blocked_care_first" | "blocked_fatigue" | "blocked_profiling" | "blocked_no_benefit";
export type Recommendation = {
  productId: string; product: string; action: "SELL" | "CARE" | "WAIT"; need: NeedId; needLabel: string; needScore: number;
  pAccept: number; dClv: number; clvAfter: number; channel: string | null; tone: "du" | "sie"; toneNote: string;
  benefit: string; benefitDe: string; explanation: string; policy: Policy; policyNote: string; policyCode: string;
  /** set when marketing changed the engine's choice by hand */
  manual?: { reason: string; from: string };
};

/** Tone from the customer's own words only (simple, checkable rules). No age or other demographic proxies. */
export function deriveTone(c: RawCustomer): { tone: "du" | "sie"; note: string } {
  if (!canProfile(c)) return { tone: "sie", note: "Default 'Sie' (no profiling consent)" };
  const txt = c.tickets.map((t) => t.text).join(" ");
  const du = (txt.match(/\b(du|dir|dich|dein\w*|euch|habt|könnt)\b|\b(Hi|Hey|Hallo)\b|danke dir|tschüss/gi) ?? []).length;
  const sie = (txt.match(/\b(Sie|Ihnen|Ihr\w*)\b|Sehr geehrte|Mit freundlichen Grüßen|Guten Tag/g) ?? []).length;
  const empathic = c.openComplaint || c.tickets.some((t) => t.status === "open");
  const extra = empathic ? " · empathetic wording (open case)" : "";
  if (du > sie) return { tone: "du", note: `Customer writes informally (${du} vs ${sie} markers)${extra}` };
  if (sie > 0) return { tone: "sie", note: `Customer writes formally (${sie} markers)${extra}` };
  return { tone: "sie", note: `No own texts – safe default 'Sie'${extra}` };
}

function baseChurnDriversToRemove(c: RawCustomer, flags: CareFlag[]) {
  return flags.filter((f) => f.critical).reduce((s, f) => s + f.churnAdd, 0) + (c.tickets12m >= 2 ? A.tickets_12m_ge2 : 0);
}

function evaluate(c: RawCustomer, needs: NeedResult[], flags: CareFlag[], twinBoost: Record<string, number>, rates: Rates): Recommendation[] {
  const now = clvFormula(c.margin, c.cts, c.churn);
  const { tone, note: toneNote } = deriveTone(c);
  const channels = allowedChannels(c).sort((a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b));
  const blockers = salesBlockers(c);
  const serviceCase = blockers.length > 0;
  const fatigue = c.contacts30d >= contactLimit(c);
  const prof = canProfile(c);
  const recs: Recommendation[] = [];
  for (const pid of eligibleProducts(c)) {
    const p = productById(pid); const needId = PRODUCT_NEED[pid]; const need = needs.find((n) => n.id === needId)!;
    const usable = pid in rates.offerRate && !(pid in UNRELIABLE_LEGACY_BASELINE);
    const base = usable ? Math.max(rates.offerRate[pid], 0.01) : THRESHOLDS.noHistoryPrior;
    const strong = strongSignal(c, pid);
    let best = { ch: null as string | null, p: 0, val: -Infinity };
    for (const ch of channels.length ? channels : ["newsletter_email"]) {
      const rate = Math.max(usable ? rates.acceptance[pid]?.[ch] ?? base : base, 0.005);
      const boost = prof ? (twinBoost[pid] ?? 0) : 0;
      const pAcc = Math.min(THRESHOLDS.maxPAccept, rate * (0.4 + need.score / 60) * (1 + boost) * (strong ? THRESHOLDS.strongSignalLift : 1));
      const v = pAcc * 50 - CHANNELS[ch].cost;
      if (v > best.val + 1e-9) best = { ch, p: pAcc, val: v };
    }
    const pAcc = best.p;
    const oneOff = p.action_type === "one_off";
    let after: number;
    if (pid === "P-EN-02") after = clvFormula(c.margin, c.cts, c.churn - A.price_guarantee_ends_90d);
    else if (oneOff) after = clvFormula(c.margin, c.cts, c.churn + (p.churn_effect_if_bought ?? 0)) + (p.annual_margin_if_bought_eur ?? 0);
    else {
      const newLine = !({ energy: !!c.electricity || gasActive(c), mobile: !!c.mobile, e_mobility: !!c.autostrom, smart_living: !!c.hems, internet: false } as Record<string, boolean>)[p.business_line];
      after = clvFormula(c.margin + (p.annual_margin_if_bought_eur ?? 0), c.cts + (newLine ? A.base_per_business_line_eur : 0), c.churn + (p.churn_effect_if_bought ?? 0));
    }
    const reject = serviceCase ? clvFormula(c.margin, c.cts, c.churn + A.contact_during_service_case) : now;
    const cost = best.ch ? CHANNELS[best.ch].cost : 0;
    const d = pAcc * (after - now) + (1 - pAcc) * (reject - now) - cost;

    let policy: Policy = "eligible"; let code = "OK"; let note = "Consent verified for " + (best.ch ? CHANNELS[best.ch].label : "—");
    const contractTrigger = CONTRACT_TRIGGER_OFFERS.includes(pid);
    if (serviceCase) { policy = "blocked_care_first"; code = "CARE_FIRST"; note = `CARE FIRST: ${blockers.join(", ")}`; }
    else if (!channels.length) { policy = "blocked_consent"; code = "NO_CHANNEL_CONSENT"; note = "No marketing consent on any channel"; }
    else if (!prof && !contractTrigger) { policy = "blocked_profiling"; code = "NO_PROFILING_CONSENT"; note = "No profiling consent – only contract-based offers allowed"; }
    else if (fatigue) { policy = "blocked_fatigue"; code = "CONTACT_LIMIT"; note = `Contact limit: ${c.contacts30d} contacts in 30 days (limit ${contactLimit(c)})`; }
    else if (need.score < THRESHOLDS.benefitMinNeedScore && !contractTrigger) { policy = "blocked_no_benefit"; code = "NO_CLEAR_BENEFIT"; note = `Benefit gate: need "${need.label}" only ${need.score}/100`; }
    const ev = strong ?? (need.evidence[0] ? need.evidence[0].toLowerCase() : "contract data");
    const restriction = policy === "eligible" ? `${best.ch ? CHANNELS[best.ch].label : "—"}, '${tone === "du" ? "Du" : "Sie"}'` : note;
    recs.push({
      productId: pid, product: p.product_name, action: "SELL", need: needId, needLabel: need.label, needScore: need.score,
      pAccept: pAcc, dClv: d, clvAfter: after, channel: channels.length ? best.ch : null, tone, toneNote,
      benefit: BENEFIT[pid]?.en ?? "", benefitDe: BENEFIT[pid]?.de ?? "",
      explanation: `${need.label} (${need.score}/100: ${ev}) → ${p.product_name}: ${BENEFIT[pid]?.en ?? ""}. ${restriction}.`,
      policy, policyNote: note, policyCode: code,
    });
  }
  // CARE action (P-SV-01) – prioritised on open critical problems regardless of sales value
  if (flags.some((f) => f.critical) || c.openTickets) {
    const removed = baseChurnDriversToRemove(c, flags);
    const pA = THRESHOLDS.careSuccess;
    const after = clvFormula(c.margin, c.cts, c.churn - removed) - A.service_resolution_cost_eur;
    const d = pA * (after - now) - A.contact_cost_call_eur;
    const top = flags.find((f) => f.critical) ?? flags[0];
    recs.push({
      productId: "P-SV-01", product: "Proactive service assistance", action: "CARE", need: "N08", needLabel: "Resolve service problems",
      needScore: needs.find((n) => n.id === "N08")!.score, pAccept: pA, dClv: d, clvAfter: after, channel: "outbound_call", tone, toneNote,
      benefit: BENEFIT["P-SV-01"].en, benefitDe: BENEFIT["P-SV-01"].de,
      explanation: `${top?.label ?? "Open service case"} → solve it before any marketing. Service contact, no sales content.`,
      policy: "eligible", policyNote: "Service contact – no marketing consent required. Compensation needs human approval.", policyCode: "CARE",
    });
  }
  return recs.sort((a, b) => b.dClv - a.dClv);
}

// ---------- Full profile ----------
export type Profile = {
  raw: RawCustomer; id: string; needs: NeedResult[]; vector: number[]; cluster: string; clusterReason: string;
  coverage: number; ecoLevel: 1 | 2 | 3 | 4; flags: CareFlag[]; recs: Recommendation[]; nba: Recommendation;
  potential: "High Potential" | "Growth Potential" | "Low Current Potential"; churnRisk: "High" | "Medium" | "Low";
  clvModel: number; twins: { id: string; similarity: number }[]; products: string[]; consentOk: boolean;
  profiling: boolean; twinBoost: Record<string, number>; blockers: string[];
};

export const ECO_LEVELS = [
  { level: 1, name: "Discover", desc: "Customer needs are being identified.", min: 0 },
  { level: 2, name: "Connect", desc: "MAINGAU already fulfills multiple relevant needs.", min: 0.25 },
  { level: 3, name: "Optimize", desc: "Several connected needs are fulfilled through MAINGAU.", min: 0.45 },
  { level: 4, name: "EcoChampion", desc: "Benefits from a highly integrated MAINGAU ecosystem.", min: 0.65 },
] as const;

export const productsOf = (c: RawCustomer) => [
  c.electricity && `Strom · ${c.electricity.tariff}${c.electricity.cancelled ? " (gekündigt)" : ""}`,
  c.gas && `Gas · ${c.gas.tariff}${gasDeregistered(c) ? " (Zähler abgemeldet)" : ""}`, c.mobile && `Mobil ${c.mobile.plan}`,
  c.autostrom && "Autostrom", c.hems && "HEMS / Smart Living", ...c.shop.map((s) => `Shop · ${s}`),
].filter(Boolean) as string[];

/** Coverage = Σ(relevance × fulfilled) / Σ(relevance), only sufficiently evidenced needs (Spec V2 §3). */
function coverageOf(needs: NeedResult[]) {
  const rel = needs.filter((n) => n.score >= 35 && n.id !== "N08" && n.evidence.length > 0);
  const tot = rel.reduce((s, n) => s + n.score, 0);
  return tot ? rel.filter((n) => n.fulfilled).reduce((s, n) => s + n.score, 0) / tot : 0;
}
const levelOf = (cov: number, lines: number): 1 | 2 | 3 | 4 => {
  let l: 1 | 2 | 3 | 4 = 1; for (const e of ECO_LEVELS) if (cov >= e.min) l = e.level as 1 | 2 | 3 | 4;
  if (l >= 3 && lines < 2) l = 2; // integration requires 2+ business lines
  return l;
};

let centroids: number[][] = [];
export let CLUSTER_NAMES: string[] = [];
export const NO_PROFILE_CLUSTER = "Not profiled (no consent)";
export let CLUSTER_STATS = { k: 0, silhouette: 0, tried: [] as { k: number; silhouette: number }[] };

function nameClusters(C: number[][], X: number[][]) {
  const mean = NEEDS.map((_, d) => X.reduce((s, x) => s + x[d], 0) / X.length);
  const used = new Set<string>();
  return C.map((c) => {
    const rel = NEEDS.map((n, d) => ({ n, v: c[d] - mean[d] })).filter((x) => x.n.id !== "N08").sort((a, b) => b.v - a.v);
    let name = `${rel[0].n.short} & ${rel[1].n.short}`;
    if (used.has(name)) name = `${rel[0].n.short} & ${rel[2].n.short}`;
    used.add(name);
    return name;
  });
}
function assignCluster(v: number[]) {
  const j = centroids.reduce((b, c, i) => (dist2(v, c) < dist2(v, centroids[b]) ? i : b), 0);
  return { name: CLUSTER_NAMES[j], j };
}

function buildProfile(c: RawCustomer, needs: NeedResult[], twins: { id: string; similarity: number }[], twinBoost: Record<string, number>, rates: Rates = BASE_RATES): Profile {
  const v = vec(needs);
  const prof = canProfile(c);
  let name = NO_PROFILE_CLUSTER; let reason = "No profiling consent: excluded from clustering and twin search (safe fallback).";
  if (prof && centroids.length) {
    const a = assignCluster(v); name = a.name;
    const top = NEEDS.map((n, i) => ({ n, s: v[i] })).sort((x, y) => y.s - x.s).slice(0, 2);
    reason = `Need vector closest to the "${name}" centroid – strongest needs: ${top.map((t) => `${t.n.short} ${Math.round(t.s * 100)}`).join(", ")}.`;
  }
  const coverage = coverageOf(needs);
  const flags = careFlags(c);
  // [V3 context hook 1] region as extra evidence for candidate relevance only – coverage, EcoLevel and cluster stay on `needs`
  const recs = evaluate(c, withRegionEvidence(c, needs), flags, prof ? twinBoost : {}, rates);
  const critical = flags.some((f) => f.critical);
  const care = recs.find((r) => r.action === "CARE");
  const bestSell = recs.find((r) => r.action === "SELL" && r.policy === "eligible" && r.dClv > 0);
  let nba: Recommendation;
  const { tone, note: toneNote } = deriveTone(c);
  if (critical && care) nba = care;
  else if (bestSell) nba = bestSell;
  else if (care) nba = care;
  else {
    const blocked = recs.find((r) => r.action === "SELL" && r.policy !== "eligible");
    const why = salesBlockers(c).length ? `Sales paused: ${salesBlockers(c).join(", ")}.`
      : !allowedChannels(c).length ? "No marketing consent – respect preferences."
      : c.contacts30d >= contactLimit(c) ? `Contact limit reached (${c.contacts30d}/${contactLimit(c)} in 30 days) – let the customer rest.`
      : blocked ? `${blocked.policyNote}.`
      : "No offer with positive expected Δ-CLV – doing nothing is best.";
    nba = { productId: "-", product: "No action", action: "WAIT", need: needs.slice().sort((a, b) => b.score - a.score)[0].id, needLabel: "—", needScore: 0, pAccept: 0, dClv: 0, clvAfter: c.clv, channel: null, tone, toneNote, benefit: "", benefitDe: "", explanation: why, policy: "eligible", policyNote: why, policyCode: "WAIT" };
  }
  const churnRisk = c.churn >= 0.3 ? "High" : c.churn >= 0.18 ? "Medium" : "Low";
  const potential = nba.dClv >= 25 || (c.clv >= 1500 && nba.action === "SELL") ? "High Potential" : nba.dClv >= 3 ? "Growth Potential" : "Low Current Potential";
  return {
    raw: c, id: c.id, needs, vector: v, cluster: name, clusterReason: reason, coverage, ecoLevel: levelOf(coverage, c.lines), flags, recs, nba,
    potential, churnRisk, clvModel: clvFormula(c.margin, c.cts, c.churn), twins: prof ? twins : [], products: productsOf(c),
    consentOk: allowedChannels(c).length > 0, profiling: prof, twinBoost: prof ? twinBoost : {}, blockers: salesBlockers(c),
  };
}

const ownershipVec = (c: RawCustomer) => [!!c.electricity, gasActive(c), !!c.mobile, !!c.autostrom, !!c.hems, c.shop.length > 0, isEV(c)].map((b) => (b ? 0.6 : 0));

function computeAll(customers: RawCustomer[]): Profile[] {
  const needsAll = customers.map(discoverNeeds);
  const X = needsAll.map(vec);
  // Only customers with profiling consent are used for clustering and twin search (Spec V2 §0, §7).
  const ok = customers.map((c, i) => (canProfile(c) ? i : -1)).filter((i) => i >= 0);
  const Xp = ok.map((i) => X[i]);
  let best = { k: 5, s: -1, km: kmeans(Xp, 5) };
  const tried: { k: number; silhouette: number }[] = [];
  for (let k = THRESHOLDS.kRange[0]; k <= THRESHOLDS.kRange[1]; k++) {
    const km = kmeans(Xp, k);
    const sizes = new Array(k).fill(0); km.assign.forEach((a) => sizes[a]++);
    const s = silhouette(Xp, km.assign, k);
    tried.push({ k, silhouette: Math.round(s * 1000) / 1000 });
    if (Math.min(...sizes) >= 15 && s > best.s) best = { k, s, km }; // small/unstable clusters → not chosen
  }
  centroids = best.km.centroids; CLUSTER_NAMES = nameClusters(centroids, Xp);
  CLUSTER_STATS = { k: best.k, silhouette: Math.round(best.s * 1000) / 1000, tried };

  // [V3 context hook 2] region classes as allowed context features in twin similarity – not in the clustering vector
  const sim = customers.map((c, i) => [...X[i], ...ownershipVec(c), ...regionVec(c)]);
  return customers.map((c, i) => {
    if (!canProfile(c)) return buildProfile(c, needsAll[i], [], {});
    const scores = ok.map((j) => [j === i ? -1 : cosine(sim[i], sim[j]), j] as [number, number]);
    const twinIdx = scores.sort((a, b) => b[0] - a[0]).slice(0, THRESHOLDS.twins);
    const twins = twinIdx.map(([s, j]) => ({ id: customers[j].id, similarity: s }));
    // Potential needs = hypothesis: twins rate a need much higher than this customer (correlation, not intent)
    const needs = needsAll[i].map((n, k) => {
      const tw = twinIdx.reduce((s, [, j]) => s + X[j][k], 0) / twinIdx.length * 100;
      if (n.kind === "inferred" && tw - n.score > 20) return { ...n, kind: "potential" as NeedKind, score: Math.round((n.score + tw) / 2), evidence: [...n.evidence, `Similar customers score ${Math.round(tw)} (hypothesis)`] };
      return n;
    });
    // product affinity: share of twins owning the product category (affinity ≠ acceptance)
    const own = (cc: RawCustomer) => ({ "P-EN-01": !!cc.electricity, "P-AS-01": !!cc.autostrom, "P-MO-01": !!cc.mobile, "P-SL-01": !!cc.hems, "P-SH-02": has(cc, "wallbox") });
    const twinBoost: Record<string, number> = {};
    for (const k of Object.keys(own(c))) twinBoost[k] = twinIdx.filter(([, j]) => (own(customers[j]) as Record<string, boolean>)[k]).length / twinIdx.length * 0.5;
    return buildProfile(c, needs, twins, twinBoost);
  });
}

export const PROFILES: Profile[] = computeAll(RAW_CUSTOMERS);
const BY_ID = new Map(PROFILES.map((p) => [p.id, p]));
export const profileById = (id: string) => BY_ID.get(id);

/** Recompute one customer after a change (clusters fixed, twins kept if profiling is still allowed). */
export function recompute(c: RawCustomer, base?: Profile, rates: Rates = BASE_RATES): Profile {
  const needs = discoverNeeds(c);
  const prof = canProfile(c);
  return buildProfile(c, needs, prof ? base?.twins ?? [] : [], prof ? base?.twinBoost ?? {} : {}, rates);
}

export function twinComparison(a: Profile, b: Profile) {
  const shared = a.needs.filter((n, i) => n.score >= 40 && b.needs[i].score >= 40).map((n) => n.label);
  const diffs = a.products.filter((p) => !b.products.includes(p)).concat(b.products.filter((p) => !a.products.includes(p)).map((p) => `Twin has ${p}`));
  const unmet = b.needs.filter((n, i) => n.fulfilled && !a.needs[i].fulfilled && a.needs[i].score >= 30).map((n) => n.label);
  return { shared, diffs: diffs.slice(0, 4), unmet };
}

// ---------- Guardrail checks (Spec V2 §12) – run over ALL customers ----------
export type GuardrailResult = { id: string; label: string; violations: string[] };
export function guardrails(profiles: Profile[]): GuardrailResult[] {
  const sells = profiles.filter((p) => p.nba.action === "SELL");
  const chk = (id: string, label: string, bad: Profile[]) => ({ id, label, violations: bad.map((p) => p.id) });
  return [
    chk("G1", "No SELL during complaint, cancellation, payment reminder or technical disruption", sells.filter((p) => salesBlockers(p.raw).length > 0)),
    chk("G2", "No SELL on a channel without consent", sells.filter((p) => !p.nba.channel || p.raw.consent[CHANNELS[p.nba.channel].consent] !== "granted")),
    chk("G3", "No personalised SELL without profiling consent", sells.filter((p) => !canProfile(p.raw) && !CONTRACT_TRIGGER_OFFERS.includes(p.nba.productId))),
    chk("G4", "No 'Du' without profiling consent (tone derivation is profiling)", profiles.filter((p) => !canProfile(p.raw) && p.nba.tone === "du")),
    chk("G5", "No SELL above the customer's contact limit", sells.filter((p) => p.raw.contacts30d >= contactLimit(p.raw))),
    chk("G6", "No offer the customer rejected or already has", sells.filter((p) => p.raw.rejected?.includes(p.nba.productId))),
    chk("G7", "No SELL with negative expected value (WAIT = 0 is the reference)", sells.filter((p) => p.nba.dClv <= 0)),
    chk("G8", "Every decision has a reason", profiles.filter((p) => !p.nba.explanation)),
    chk("G9", "No SELL without a clear customer benefit", sells.filter((p) => !p.nba.benefit)),
  ];
}

export const eur = (v: number, d = 0) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(v);
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
