// One-sentence German reasons for the internal views (the engine's own explanation stays English for the log).
import { NEED_DE, NO_PROFILE_CLUSTER, pct, type Profile, type Recommendation } from "@/lib/engine";
import { CHANNEL_DE, FLAG_DE, POLICY_DE } from "@/config/internal";

/** Machine-readable CARE codes as shown to service, e.g. "CARE – OPEN_COMPLAINT". */
export const CARE_CODE: Record<string, string> = {
  complaint: "OPEN_COMPLAINT", cancel: "CANCELLATION", dunning: "DUNNING", dunning1: "PAYMENT_REMINDER",
  charging: "CHARGING_FAILURES", hems: "TECHNICAL_OUTAGE", ticket: "OPEN_TICKET", csat: "LOW_SATISFACTION",
};

export const productDe = (r: Recommendation) => (r.productId === "P-SV-01" ? "Proaktive Service-Hilfe" : r.productId === "-" ? "Keine Aktion" : r.product);

export function careCode(p: Profile): string {
  const f = p.flags.find((x) => x.critical) ?? p.flags[0];
  return f ? CARE_CODE[f.code] ?? f.code.toUpperCase() : "OPEN_TICKET";
}

/** The whole reason in ONE line for the approval table (details stay in reasonDe). */
export function reasonLineDe(p: Profile, r: Recommendation = p.nba): string {
  if (r.action !== "SELL") return reasonDe(p, r);
  const base = `${NEED_DE[r.need] ?? r.needLabel} ${r.needScore}/100 · Annahme ${pct(r.pAccept)} · ${r.tone === "du" ? "Du" : "Sie"}`;
  return r.manual ? `Manuell geändert: ${r.manual.reason}` : base;
}

export function reasonDe(p: Profile, r: Recommendation = p.nba): string {
  if (r.action === "SELL" && r.manual) {
    const ch = r.channel ? CHANNEL_DE[r.channel] ?? r.channel : "—";
    return `Manuell von Marketing geändert (Engine schlug ${r.manual.from} vor). Grund: ${r.manual.reason}. Jetzt: ${productDe(r)} über ${ch}.`;
  }
  if (r.action === "SELL") {
    const ch = r.channel ? CHANNEL_DE[r.channel] ?? r.channel : "—";
    return `${NEED_DE[r.need] ?? r.needLabel} (Bedarf ${r.needScore}/100) → ${productDe(r)}: ${r.benefitDe}. Kanal ${ch}, per ${r.tone === "du" ? "Du" : "Sie"}.`;
  }
  if (r.action === "CARE") {
    const labels = p.flags.filter((f) => f.critical || f.code === "ticket").map((f) => FLAG_DE[f.code] ?? f.label);
    return `${labels.join(", ") || "Offenes Anliegen"} – erst helfen, kein Verkauf.`;
  }
  if (p.blockers.length) return `Verkauf pausiert: ${p.flags.map((f) => FLAG_DE[f.code] ?? f.label).join(", ")}.`;
  if (r.policyNote?.startsWith("TUNING")) return `Durch Stellschraube zurückgehalten: ${POLICY_DE[r.policyNote] ?? r.policyNote}.`;
  if (!p.consentOk) return "Keine Werbeeinwilligung – Wunsch des Kunden respektieren.";
  const blocked = p.recs.find((x) => x.action === "SELL" && x.policy !== "eligible");
  if (blocked) return `${productDe(blocked)} wäre passend, aber: ${POLICY_DE[blocked.policyCode] ?? blocked.policyCode}.`;
  return "Kein Angebot mit positivem Erwartungswert – nichts zu tun ist hier am besten.";
}

export const policyDe = (r: Recommendation) => POLICY_DE[r.policyCode] ?? r.policyCode;

const NEED_SHORT_DE: Record<string, string> = {
  "Energy costs": "Energiekosten", Consumption: "Verbrauch", "Home charging": "Laden zu Hause", "Public charging": "Laden unterwegs",
  Connectivity: "Vernetzung", Renewables: "Erneuerbare", "Price stability": "Preisstabilität", Service: "Service",
  "Mobile data": "Mobile Daten", "Energy mgmt": "Energiesteuerung",
};
/** Cluster names are built from English need short labels in the engine – translated for display only. */
export const clusterDe = (name: string) =>
  name === NO_PROFILE_CLUSTER ? "Ohne Profiling-Einwilligung" : name.split(" & ").map((x) => NEED_SHORT_DE[x.trim()] ?? x).join(" & ");
