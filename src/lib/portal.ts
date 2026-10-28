// Portal rules as pure functions (testable). The portal never sees CLV, churn, cluster or scores.
import { DECISION_TIME, contactLimit, type Energy, type Profile, type Recommendation } from "@/lib/engine";
import { crossSellCards, type CrossSellCard } from "@/engine/context";
import type { StyleProfile } from "@/lib/data-types";
import { OFFER_TEXT } from "@/config/offers";
import { PORTAL, type DuSie } from "@/config/portal";

export const tx = (s: StyleProfile, t: DuSie) => (s.anrede === "du" ? t.du : t.sie);
export const fill = (str: string, vars: Record<string, string | number>) =>
  str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

export const daysFromToday = (d: string | null | undefined) =>
  d ? Math.ceil((new Date(d).getTime() - DECISION_TIME.getTime()) / 864e5) : null;
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
export const fmtNum = (v: number, digits = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Help-card reasons. Any of them = open problem → no offers, no tips. */
export function helpReasons(p: Profile): string[] {
  const codes = p.flags.filter((f) => f.critical || f.code === "ticket" || f.code === "dunning1").map((f) => f.code);
  return [...new Set(codes)];
}
export const hasOpenProblem = (p: Profile) => helpReasons(p).length > 0 || p.blockers.length > 0;

export type DecisionLookup = (customerId: string, productId: string) => string | undefined;

/**
 * The ONE prominent recommendation (Master-Prompt §4 / §9):
 * engine SELL + marketing approved + portal consent + no open problem. Not approved → demo hint only.
 */
export function recommendationState(p: Profile, decision: DecisionLookup): "visible" | "demo-hint" | "none" {
  const nba = p.nba;
  if (hasOpenProblem(p) || nba.action !== "SELL" || !OFFER_TEXT[nba.productId]) return "none";
  if (p.raw.consent.portal_app_personalisation !== "granted") return "none";
  const status = decision(p.id, nba.productId);
  if (status === "held_out") return "none"; // random control group: the customer gets no offer, by design
  return status === "approved" ? "visible" : "demo-hint";
}

/** "Mehr entdecken": other permitted candidates, small and secondary. Max 3. */
export function discoverList(p: Profile): Recommendation[] {
  if (hasOpenProblem(p) || p.raw.consent.portal_app_personalisation !== "granted") return [];
  return p.recs
    .filter((r) => r.policy === "eligible" && r.action === "SELL" && r.productId !== p.nba.productId && OFFER_TEXT[r.productId])
    .slice(0, 3);
}

export type HeadlineKey = keyof typeof PORTAL.headline;
export function headlineOf(p: Profile): { key: HeadlineKey; days?: number } {
  const c = p.raw;
  if (helpReasons(p).includes("cancel")) return { key: "cancel" };
  if (hasOpenProblem(p)) return { key: "problem" };
  const d = daysFromToday(c.electricity?.pgUntil);
  if (d !== null && d < 0 && d > -365) return { key: "pgEnded" };
  if (d !== null && d >= 0 && d <= PORTAL.pgHeadlineDays) return { key: "pgEnds", days: d };
  const m = daysFromToday(c.electricity?.lastMeterReadingAt);
  if (m !== null && -m > PORTAL.meterOverdueDays) return { key: "meter" };
  return { key: "fine" };
}

export const daytimeGreeting = (hour: number) => PORTAL.daytime.find((d) => hour < d.until)!.text;

export type PortalNote = { id: string; kind: "service" | "offer"; text: string; productId?: string };

/**
 * Notifications (simulated, nothing is sent). Service notes need no advertising consent.
 * Offer notes only after marketing approval, with portal_app_personalisation, under the contact limit.
 */
export function notificationsOf(
  p: Profile, s: StyleProfile, opts: { decision: DecisionLookup; feedback: (pid: string) => string | undefined; callback?: string; solved?: string[] },
): PortalNote[] {
  const n = PORTAL.notifications;
  const cat = (c: string) => PORTAL.categories[c] ?? PORTAL.categories.other;
  const out: PortalNote[] = [];
  for (const t of p.raw.tickets.filter((t) => t.status === "open"))
    out.push({ id: `ticket:${t.id}`, kind: "service", text: fill(tx(s, n.ticketOpen), { cat: cat(t.category) }) });
  for (const id of opts.solved ?? []) {
    const t = p.raw.tickets.find((x) => x.id === id);
    out.push({ id: `solved:${id}`, kind: "service", text: fill(tx(s, n.ticketSolved), { cat: cat(t?.category ?? "other") }) });
  }
  if (opts.callback) out.push({ id: `callback:${opts.callback}`, kind: "service", text: fill(tx(s, n.callback), { slot: opts.callback }) });
  const offerOk = recommendationState(p, opts.decision) === "visible" && p.raw.contacts30d < contactLimit(p.raw) && !opts.feedback(p.nba.productId);
  if (offerOk) out.push({ id: `offer:${p.nba.productId}`, kind: "offer", productId: p.nba.productId, text: fill(tx(s, n.offer), { title: OFFER_TEXT[p.nba.productId].title }) });
  return out;
}

/** "Passt zu dir": only with portal consent and without an open problem; the main recommendation is never repeated. */
export function passendCards(p: Profile, month = DECISION_TIME.getMonth() + 1): CrossSellCard[] {
  if (hasOpenProblem(p) || p.raw.consent.portal_app_personalisation !== "granted") return [];
  return crossSellCards(p, month);
}

/** Share of the price-guarantee period already used (0–1); null without a guarantee. */
export function pgProgress(e: Energy | null | undefined, months: number): number | null {
  if (!e?.pgUntil) return null;
  const left = daysFromToday(e.pgUntil);
  if (left === null) return null;
  const end = new Date(e.pgUntil).getTime();
  const fallback = new Date(e.pgUntil); fallback.setMonth(fallback.getMonth() - months);
  const start = Math.max(e.startDate ? new Date(e.startDate).getTime() : 0, fallback.getTime());
  return Math.min(1, Math.max(0, 1 - (left * 864e5) / (end - start)));
}
