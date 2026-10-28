// Service inbox (pure): open cases from tickets, CARE flags, Funki self-service and proactive triggers.
// Sorted by urgency from the CARE rules – never by customer value. No CLV or churn values in here.
import { DECISION_TIME, type Profile } from "@/lib/engine";
import type { ServiceCase } from "@/lib/cases";
import { styleOf } from "@/lib/style";
import { placeholderName } from "@/config/names";
import { PRIORITY, PROACTIVE, type InboxFilter } from "@/config/service";
import { PORTAL } from "@/config/portal";

export type Source = "funki" | "uebergabe" | "ticket" | "anruf" | "kuendigung" | "proaktiv" | "portal";
export type InboxItem = {
  key: string; customerId: string; name: string; filter: Exclude<InboxFilter, "alle"> | "anliegen";
  title: string; detail: string; source: Source; priority: number; critical: boolean; since: string;
  mood: "zufrieden" | "neutral" | "verärgert"; trigger?: string; suggestion?: string; deadline?: number;
  caseId?: string; ticketId?: string; resolveKeys: string[]; reason?: string; endDate?: string;
};

const days = (d: string) => Math.round((DECISION_TIME.getTime() - new Date(d).getTime()) / 864e5);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const cat = (c: string) => PORTAL.categories[c] ?? PORTAL.categories.other;

const CASE_FILTER: Record<ServiceCase["kind"], InboxItem["filter"]> = {
  kuendigung: "kuendigung", beschwerde: "beschwerde", stoerung: "technik", mitarbeiter: "uebergabe", rueckruf: "anliegen", umzug: "anliegen",
};

export function buildInbox(profiles: Profile[], cases: ServiceCase[], mood: Record<string, InboxItem["mood"]> = {}, resolved: Record<string, string[]> = {}): InboxItem[] {
  const out: InboxItem[] = [];
  const today = DECISION_TIME.toISOString().slice(0, 10);
  for (const p of profiles) {
    const c = p.raw;
    const m = mood[p.id] && p.profiling ? mood[p.id] : styleOf(c).stimmung;
    const base = { customerId: p.id, name: placeholderName(p.id), mood: m };
    const mine: InboxItem[] = [];
    const caseIds = new Set(cases.map((k) => k.id));

    for (const k of cases.filter((x) => x.customerId === p.id && x.status === "open")) {
      const filter = CASE_FILTER[k.kind];
      mine.push({ ...base, key: `${p.id}|case|${k.id}`, filter, title: k.title, detail: k.detail,
        source: k.kind === "kuendigung" ? "kuendigung" : k.source === "uebergabe" ? "uebergabe" : "funki",
        priority: PRIORITY[filter], critical: PRIORITY[filter] === 1, since: k.createdAt, caseId: k.id,
        resolveKeys: [`case:${k.id}`], reason: k.reason, endDate: k.endDate });
    }
    for (const t of c.tickets.filter((x) => x.status === "open" && !caseIds.has(x.id))) {
      const filter: InboxItem["filter"] = t.category === "complaint" ? "beschwerde" : t.category === "autostrom" || t.category === "hems" ? "technik" : "anliegen";
      mine.push({ ...base, key: `${p.id}|ticket|${t.id}`, filter, title: cat(t.category), detail: t.text || t.callNote || "",
        source: t.channel === "phone" ? "anruf" : "ticket", priority: PRIORITY[filter], critical: PRIORITY[filter] === 1, since: t.at,
        ticketId: t.id, resolveKeys: [`ticket:${t.id}`, ...(t.category === "complaint" ? ["complaint"] : [])] });
    }
    const has = (f: InboxItem["filter"]) => mine.some((x) => x.filter === f);
    if (c.openComplaint && !has("beschwerde")) mine.push({ ...base, key: `${p.id}|flag|complaint`, filter: "beschwerde", title: "Offene Beschwerde", detail: c.tickets.find((t) => t.category === "complaint")?.text ?? "", source: "ticket", priority: PRIORITY.beschwerde, critical: true, since: c.tickets.find((t) => t.category === "complaint")?.at ?? today, resolveKeys: ["complaint"] });
    if ((c.charging?.failed30d ?? 0) >= 3) mine.push({ ...base, key: `${p.id}|flag|charging`, filter: "technik", title: "Wiederholte Ladeabbrüche", detail: `${c.charging!.failed30d} fehlgeschlagene Ladevorgänge in 30 Tagen`, source: "ticket", priority: PRIORITY.technik, critical: true, since: today, resolveKeys: ["charging"] });
    if (c.hems?.offline) mine.push({ ...base, key: `${p.id}|flag|hems`, filter: "technik", title: "Smart Living offline", detail: "Gateway meldet sich nicht", source: "ticket", priority: PRIORITY.technik, critical: true, since: today, resolveKeys: ["hems"] });
    const dn = Math.max(c.electricity?.dunning ?? 0, c.gas?.dunning ?? 0);
    if (dn >= 1) mine.push({ ...base, key: `${p.id}|flag|dunning`, filter: "zahlung", title: `Zahlungserinnerung Stufe ${dn}`, detail: "Offene Zahlung – Service statt Verkauf", source: "ticket", priority: dn >= 2 ? PRIORITY.zahlung : PRIORITY.anliegen, critical: dn >= 2, since: today, resolveKeys: ["dunning"] });
    if ((c.electricity?.cancelled || c.gas?.cancelled) && !has("kuendigung")) mine.push({ ...base, key: `${p.id}|flag|cancel`, filter: "kuendigung", title: "Kündigung eingegangen", detail: `Kündigung ${c.electricity?.cancelled ? "Strom" : "Gas"}`, source: "kuendigung", priority: PRIORITY.kuendigung, critical: true, since: c.events.find((e) => e.type === "contract_cancellation_received")?.at ?? today, resolveKeys: [] });

    if (!mine.length) {
      const pro = proactive(p);
      if (pro && !(resolved[p.id] ?? []).includes(pro.resolve)) mine.push({ ...base, key: `${p.id}|pro|${pro.id}`, filter: "proaktiv", title: pro.trigger, detail: pro.suggestion, source: "proaktiv",
        priority: PRIORITY.proaktiv, critical: false, since: today, trigger: pro.trigger, suggestion: pro.suggestion, deadline: pro.deadline, resolveKeys: [pro.resolve] });
    }
    out.push(...mine);
  }
  return out.sort((a, b) => a.priority - b.priority || (a.deadline ?? 999) - (b.deadline ?? 999) || a.since.localeCompare(b.since));
}

function proactive(p: Profile): { id: string; trigger: string; suggestion: string; deadline: number; resolve: string } | null {
  const c = p.raw, T = PROACTIVE.text;
  const pg = c.electricity?.pgUntil ? -days(c.electricity.pgUntil) : null;
  if (pg !== null && pg >= 0 && pg <= PROACTIVE.pgDays && !c.electricity?.cancelled) return { id: "pg", trigger: fill(T.pg.trigger, { n: pg }), suggestion: T.pg.suggestion, deadline: pg, resolve: "pro:pg" };
  if ((c.charging?.failed30d ?? 0) >= PROACTIVE.failedCharges30d) return { id: "charging", trigger: fill(T.charging.trigger, { n: c.charging!.failed30d }), suggestion: T.charging.suggestion, deadline: 30, resolve: "pro:charging" };
  if (c.lastCsat !== null && c.lastCsat <= PROACTIVE.csatMax) return { id: "csat", trigger: fill(T.csat.trigger, { n: c.lastCsat }), suggestion: T.csat.suggestion, deadline: 60, resolve: "pro:csat" };
  const meter = c.electricity?.lastMeterReadingAt;
  if (meter && days(meter) > PROACTIVE.meterOverdueDays) return { id: "meter", trigger: T.meter.trigger, suggestion: T.meter.suggestion, deadline: 120, resolve: "pro:meter" };
  return null;
}

export function waitingLabel(since: string, t: { today: string; days: string; day: string }) {
  const d = Math.max(0, days(since));
  return d === 0 ? t.today : d === 1 ? t.day : fill(t.days, { n: d });
}
