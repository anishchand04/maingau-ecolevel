// Versioned engine configuration (Spec V2 §0: all weights, thresholds, costs and assumptions in config).
export const ENGINE_VERSION = "ecolevel-nba-v2.0";

export const THRESHOLDS = {
  /** Customer Benefit Gate: a SELL needs a need score of at least this (0–100) on the need it solves. */
  benefitMinNeedScore: 30,
  /** Contact limits (marketing contacts in the last 30 days) by customer-chosen frequency in the portal. */
  contactLimit30d: { low: 1, normal: 3, high: 4 } as Record<string, number>,
  defaultFrequency: "normal",
  /** Price guarantee retention window (days until end). Already expired guarantees count as open. */
  priceGuaranteeWindowDays: 90,
  /** p(accept) cap – scores are heuristics, never shown as more certain than this. */
  maxPAccept: 0.6,
  /** Assumed success of a proactive service fix (assumption, not measured). */
  careSuccess: 0.65,
  /** Twin search: number of look-alikes. */
  twins: 5,
  /** k-means: tried range, chosen by silhouette (Spec V2 §3). */
  kRange: [3, 8] as [number, number],
  /** Assumed acceptance prior for offers with no legacy response history (assumption). */
  noHistoryPrior: 0.03,
  /** Multiplier on p(accept) when a hard, dated contract signal points at the product (assumption). */
  strongSignalLift: 3,
};

/**
 * Legacy response baselines that are not usable: the old rule engine sent 37 % of its Autostrom offers to
 * customers who already had Autostrom, so the observed 0 % says nothing about real acceptance.
 */
export const UNRELIABLE_LEGACY_BASELINE: Record<string, string> = {
  "P-AS-01": "legacy rule engine mostly targeted existing Autostrom customers (0 % conversion is a targeting artefact)",
};

/** Offers that may be made WITHOUT profiling consent because they rest on contract facts only. */
export const CONTRACT_TRIGGER_OFFERS = ["P-EN-02", "P-EN-03", "P-MO-02", "P-MO-03"];

/** Customer benefit per product (Spec V2 §6 Customer Benefit Gate) – no invented euro savings. */
export const BENEFIT: Record<string, { de: string; en: string }> = {
  "P-EN-01": { de: "Strom und Autostrom aus einer Hand", en: "One provider for home and on-the-road charging" },
  "P-EN-02": { de: "Erneut 24 Monate Preisgarantie – planbare Kosten", en: "24 more months of price certainty" },
  "P-EN-03": { de: "Eigener Tarif für die Wärmepumpe", en: "Dedicated tariff for the heat pump" },
  "P-EN-04": { de: "Strom und Gas aus einer Hand", en: "Electricity and gas from one provider" },
  "P-EN-05": { de: "Strom nutzen, wenn er günstig ist (Smart Meter vorhanden)", en: "Use power when it is cheap (smart meter in place)" },
  "P-MO-01": { de: "Mobilfunk beim bestehenden Anbieter", en: "Mobile plan with an existing provider" },
  "P-MO-02": { de: "Kein Drosseln mehr am Monatsende", en: "No more throttling at month end" },
  "P-MO-03": { de: "Weitere SIM für den Haushalt", en: "Extra SIM for the household" },
  "P-IN-01": { de: "Internet vom selben Anbieter", en: "Internet from the same provider" },
  "P-SL-01": { de: "PV, Auto und Wärmepumpe gemeinsam steuern", en: "Control PV, EV and heat pump together" },
  "P-SL-02": { de: "Speicher automatisch zum besten Zeitpunkt laden", en: "Charge the battery at the best time automatically" },
  "P-SL-03": { de: "Auto mit eigenem Solarstrom laden", en: "Charge the car with own solar power" },
  "P-SH-01": { de: "Eigener Solarstrom vom Balkon", en: "Own solar power from the balcony" },
  "P-SH-02": { de: "Bequem zu Hause laden", en: "Convenient charging at home" },
  "P-SH-03": { de: "Nur heizen, wenn jemand zu Hause ist", en: "Heat only when someone is home" },
  "P-SH-04": { de: "Stromfresser im Haushalt finden", en: "Find power hogs at home" },
  "P-AS-01": { de: "Unterwegs laden an über 927.000 Ladepunkten", en: "Charge on the road at 927,000+ points" },
  "P-SV-01": { de: "Ihr Anliegen wird gelöst – ohne Verkaufsgespräch", en: "Problem solved – no sales pitch" },
};

/** Status labels shown next to every number (Spec V2: disclose computed / estimated / simulated). */
export const ESTIMATE_STATUS = {
  clv: "computed – MAINGAU clv_method",
  pAccept: "estimated – legacy response baseline × need fit (not calibrated)",
  dClv: "scenario – expected value under the assumptions above",
  twins: "correlation – similar customers, not proof of purchase intent",
};

/**
 * Learning loop (src/lib/learning.ts). Learning only changes estimates (p(accept) rates), never a rule or guardrail.
 * Every value is an assumption and can be tightened here.
 */
export const LEARNING = {
  /** Random holdout: share of otherwise eligible SELL customers who do NOT get the offer (0 = off). */
  holdoutOptions: [0, 5, 10, 20] as number[],
  holdoutSalt: "ecolevel-holdout-v1",
  /** Minimum live treated outcomes per offer × channel before a rate may change. */
  minCellN: 20,
  /** Minimum control group before an uplift statement is shown (same bar as the observed comparison). */
  minControlN: 100,
  minControlConversions: 10,
  /** Shrinkage towards the current rate: k pseudo-observations (few data → small change). */
  shrinkK: 50,
  /** A single update may change a rate by at most this share (relative). */
  maxRelChange: 0.3,
  rateFloor: 0.005,
  /** Automatic learning (demo): holdout share used for the simulated run, even if the queue holdout is off. */
  autoHoldoutPct: 10,
  /** Customers processed per tick and tick length. */
  autoBatch: 8,
  autoTickMs: 700,
  /** A new version is only created after this many new closed treated results since the last one. */
  autoMinNew: 30,
  /** Demo world: the real rate of a cell is the engine's base rate times a factor in this range (unknown to the engine). */
  simFactorRange: [0.5, 1.6] as [number, number],
};
