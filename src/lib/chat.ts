// Funki chat logic (pure, testable): context for the AI, offline fallback, action tags, start chips, tips.
import { DECISION_TIME, type Profile } from "@/lib/engine";
import type { StyleProfile } from "@/lib/data-types";
import type { ServiceCase } from "@/lib/cases";
import { daysFromToday, fill, fmtDate, hasOpenProblem, tx } from "@/lib/portal";
import { styleSummary } from "@/lib/style";
import { FAQ, FALLBACK } from "@/config/faq";
import { CONTRACT_LABEL, isSelfServiceId, selfServiceById, type SelfServiceId } from "@/config/selfService";
import { TIPS, type Tip } from "@/config/tips";
import { PORTAL } from "@/config/portal";

const eur = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Open matters in customer language: tickets + self-service cases. */
export function openMatters(p: Profile, cases: ServiceCase[]): string[] {
  const fromTickets = p.raw.tickets.filter((t) => t.status === "open" && !cases.some((k) => k.id === t.id))
    .map((t) => `${PORTAL.categories[t.category] ?? PORTAL.categories.other} (seit ${fmtDate(t.at)})`);
  const fromCases = cases.filter((k) => k.customerId === p.id && k.status === "open").map((k) => `${k.title} (seit ${fmtDate(k.createdAt)})`);
  return [...fromTickets, ...fromCases];
}

/**
 * Compact context for the AI. Whitelist only: contracts, tariff, guarantee, installment, consumption,
 * open matters, consents, style, the approved recommendation, FAQ. Never CLV, churn, cluster, scores or risk.
 */
export function buildChatContext(p: Profile, s: StyleProfile, opts: { recommendation?: { title: string; text: string } | null; cases: ServiceCase[] }): string {
  const c = p.raw;
  const lines: string[] = [];
  lines.push(`Stil: ${styleSummary(s)}; Fachwissen ${s.fachwissen}; Stimmung ${s.stimmung}.`);
  if (c.electricity) {
    const e = c.electricity;
    lines.push(`Strom: Tarif ${e.tariff}; Abschlag ${eur(e.installment)} im Monat; Jahresverbrauch ${Math.round(e.kwh)} kWh; Preisgarantie bis ${fmtDate(e.pgUntil)}; Kündigungsfrist ${e.noticeWeeks ?? "unbekannt"} Wochen; Zähler ${e.meter === "smart_meter_imsys" ? "Smart Meter" : "konventionell"}; letzte Ablesung ${fmtDate(e.lastMeterReadingAt)}${e.cancelled ? "; Kündigung eingegangen" : ""}.`);
  }
  if (c.gas) lines.push(`Gas: Tarif ${c.gas.tariff}; Abschlag ${eur(c.gas.installment)}; Status ${c.gas.status === "active" ? "aktiv" : "Zähler abgemeldet"}.`);
  if (c.mobile) lines.push(`Mobilfunk: ${c.mobile.plan}, ${c.mobile.gb} GB, ${c.mobile.sims} SIM.`);
  if (c.autostrom) lines.push(`Autostrom: ${c.autostrom.car}${c.charging ? `, ${c.charging.sessions} Ladevorgänge seit Juni` : ""}.`);
  if (c.hems) lines.push(`Smart Living: ${c.hems.devices.length} Geräte${c.hems.offline ? ", Gerät offline" : ""}.`);
  if (c.shop.length) lines.push(`Shop-Käufe: ${c.shop.join(", ")}.`);
  const open = openMatters(p, opts.cases);
  lines.push(`Offene Anliegen: ${open.length ? open.join("; ") : "keine"}.`);
  lines.push(`Einwilligungen: ${Object.entries(c.consent).map(([k, v]) => `${k}=${v === "granted" ? "ja" : "nein"}`).join(", ")}.`);
  lines.push(opts.recommendation && !hasOpenProblem(p) ? `Freigegebene Empfehlung: ${opts.recommendation.title} – ${opts.recommendation.text}` : "Freigegebene Empfehlung: keine.");
  lines.push("FAQ:");
  for (const f of FAQ) lines.push(`- ${f.keywords[0]}: ${fill(tx(s, f), facts(p, opts.cases))}`);
  return lines.join("\n");
}

function facts(p: Profile, cases: ServiceCase[]): Record<string, string> {
  const e = p.raw.electricity;
  const open = openMatters(p, cases);
  return {
    pgUntil: fmtDate(e?.pgUntil), installment: e ? eur(e.installment) : "—", tariff: e?.tariff ?? "—",
    kwh: e ? `${Math.round(e.kwh).toLocaleString("de-DE")} kWh` : "—", noticeWeeks: String(e?.noticeWeeks ?? "—"),
    openCases: open.length ? open.join(", ") : FALLBACK.noOpenCases,
  };
}

const norm = (t: string) => t.toLowerCase().normalize("NFC");

/** Offline answer: keyword intent → FAQ text (+ action), otherwise "Das weiß ich nicht sicher" + callback. */
export function fallbackAnswer(text: string, p: Profile, s: StyleProfile, cases: ServiceCase[]): { text: string; action?: SelfServiceId } {
  const q = norm(text);
  const hit = FAQ
    .map((f) => ({ f, score: f.keywords.filter((k) => q.includes(norm(k))).reduce((a, k) => a + k.length, 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.f;
  if (!hit) return { text: tx(s, FALLBACK.unknown), action: "rueckruf" };
  if (hit.needs === "electricity" && !p.raw.electricity) return { text: tx(s, FALLBACK.noData), action: hit.action };
  return { text: fill(tx(s, hit), facts(p, cases)), action: hit.action };
}

const TAG_RE = /\[\[aktion:([a-z_]+)\]\]/gi;
/** Strips every tag; keeps the first one if it is on the whitelist. */
export function parseActionTag(answer: string): { text: string; action?: SelfServiceId } {
  const ids = [...answer.matchAll(TAG_RE)].map((m) => m[1].toLowerCase());
  const action = ids.find(isSelfServiceId);
  return { text: answer.replace(TAG_RE, "").trim(), action };
}

export type Chip = { label: string; action?: SelfServiceId; prompt?: string };
export function startChips(p: Profile, s: StyleProfile): Chip[] {
  const out: Chip[] = [];
  if (hasOpenProblem(p)) {
    out.push({ label: "Wie ist der Stand?", prompt: "Wie ist der Stand meines Anliegens?" });
    out.push({ label: "Rückruf anfragen", action: "rueckruf" });
    out.push({ label: "Mit einem Menschen sprechen", action: "mitarbeiter" });
  }
  const d = daysFromToday(p.raw.electricity?.pgUntil);
  if (!hasOpenProblem(p) && d !== null && d <= 90) out.push({ label: tx(s, { du: "Wann endet meine Preisgarantie?", sie: "Wann endet meine Preisgarantie?" }), prompt: "Wann endet meine Preisgarantie?" });
  if (p.raw.electricity || p.raw.gas) out.push({ label: "Zählerstand melden", action: "zaehlerstand" });
  if (p.raw.electricity) out.push({ label: "Abschlag anpassen", action: "abschlag" }, { label: "Rechnung erklären", action: "rechnung" });
  if (p.raw.autostrom || p.raw.charging) out.push({ label: "Ladeproblem melden", action: "stoerung" });
  out.push({ label: "Umzug melden", action: "umzug" }, { label: "Rückruf anfragen", action: "rueckruf" }, { label: "Daten ändern", action: "kontodaten" });
  return out.filter((c, i) => out.findIndex((x) => x.label === c.label) === i).slice(0, 4);
}

/** At most one tip per visit; none with an open problem; product tips only with a visible recommendation. */
export function pickTip(p: Profile, opts: { recommendationVisible: boolean; tipsOff: boolean; month?: number }): Tip | null {
  if (opts.tipsOff || hasOpenProblem(p)) return null;
  const reading = daysFromToday(p.raw.electricity?.lastMeterReadingAt ?? p.raw.gas?.lastMeterReadingAt);
  const ctx = {
    p, month: opts.month ?? DECISION_TIME.getMonth() + 1, daysToPgEnd: daysFromToday(p.raw.electricity?.pgUntil),
    daysSinceReading: reading === null ? null : -reading, recommendationVisible: opts.recommendationVisible,
  };
  return TIPS.find((t) => (t.category !== "Produkt" || opts.recommendationVisible) && t.when(ctx)) ?? null;
}

export const actionTitle = (id: SelfServiceId) => selfServiceById(id)?.title ?? id;
export { CONTRACT_LABEL };
