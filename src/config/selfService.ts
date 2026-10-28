// Self-Service-Aktionen (Master-Prompt §5): deterministische, geführte Abläufe – nicht KI-gesteuert.
// Dieselbe Liste in Portal ("Selbst erledigen"), Suche und Funki-Chat. Jede Aktion: Felder, Validierung,
// Effekt auf den gemeinsamen State, Audit-Text. Effekte werden in src/lib/selfServiceRun.ts ausgeführt.
import type { Profile } from "@/lib/engine";
import { nextFreeCallSlots } from "@/lib/slots";
import type { StyleProfile } from "@/lib/data-types";
import type { CaseKind, ContractChange } from "@/lib/cases";

export type SelfServiceId =
  | "zaehlerstand" | "abschlag" | "umzug" | "rechnung" | "kontodaten" | "preisgarantie" | "stoerung"
  | "einwilligungen" | "rueckruf" | "mitarbeiter" | "kuendigung";

export type SelfServiceEntry = { id: SelfServiceId; title: string; text: string; icon: string };

export const SELF_SERVICE: SelfServiceEntry[] = [
  { id: "zaehlerstand", title: "Zählerstand melden", text: "Stand eingeben, wir prüfen ihn sofort auf Plausibilität.", icon: "gauge" },
  { id: "abschlag", title: "Abschlag anpassen", text: "Aktuellen Abschlag und Verbrauch sehen und ändern.", icon: "wallet" },
  { id: "rechnung", title: "Rechnung erklären", text: "Jeder Posten in einfacher Sprache.", icon: "file" },
  { id: "umzug", title: "Umzug melden", text: "Neue Adresse und Datum angeben, Vertrag mitnehmen.", icon: "truck" },
  { id: "kontodaten", title: "Bank- oder Kontaktdaten ändern", text: "IBAN, E-Mail oder Telefonnummer aktualisieren.", icon: "user" },
  { id: "preisgarantie", title: "Preisgarantie verlängern", text: "Neue Preisgarantie oder anderen Tarif wählen.", icon: "shield" },
  { id: "stoerung", title: "Störung oder Ladeproblem melden", text: "Wir kümmern uns und melden uns zurück.", icon: "alert" },
  { id: "einwilligungen", title: "Werbung und Kontakt einstellen", text: "Werbung abbestellen oder Kontakthäufigkeit festlegen.", icon: "toggle" },
  { id: "rueckruf", title: "Rückruf anfragen", text: "Wunschzeit wählen, wir rufen an.", icon: "phone" },
  { id: "mitarbeiter", title: "Mit einem Menschen sprechen", text: "Funki übergibt an das Service-Team.", icon: "headset" },
  { id: "kuendigung", title: "Vertrag kündigen", text: "Sofort aufnehmen mit Frist und Enddatum.", icon: "x" },
];

export const selfServiceById = (id: string) => SELF_SERVICE.find((s) => s.id === id);
export const isSelfServiceId = (id: string): id is SelfServiceId => SELF_SERVICE.some((s) => s.id === id);

// ---------------------------------------------------------------------------------------------
// Flow definitions
// ---------------------------------------------------------------------------------------------
export type Opt = { value: string; label: string };
export type Field =
  | { id: string; kind: "number"; label: string; unit?: string; min?: number; max?: number }
  | { id: string; kind: "date"; label: string }
  | { id: string; kind: "text"; label: string; placeholder?: string; optional?: boolean; multiline?: boolean }
  | { id: string; kind: "choice"; label: string; options: Opt[] }
  /** value = comma-separated list of option values */
  | { id: string; kind: "multi"; label: string; options: Opt[]; optional?: boolean }
  | { id: string; kind: "email" | "tel" | "iban"; label: string; placeholder?: string };

export type FlowCtx = {
  p: Profile; s: StyleProfile; today: Date;
  t: (du: string, sie: string) => string;
  lastReading?: { contract: string; value: number; date: string };
};
export type Effect =
  | { type: "meter"; contract: string; value: number; date: string }
  | { type: "contract"; change: ContractChange; audit: string }
  | { type: "case"; kind: CaseKind; title: string; detail: string; contract?: "electricity" | "gas" | "mobile" | "autostrom" | "hems"; endDate?: string }
  | { type: "callback"; slot: string }
  | { type: "consents"; consents: Record<string, string>; detail: string }
  | { type: "frequency"; value: string }
  | { type: "contact"; data: { iban?: string; email?: string; phone?: string }; detail: string };

export type Values = Record<string, string>;
export type FlowResult = { reply: string; effects: Effect[]; facts?: [string, string][] };
export type Flow = {
  id: SelfServiceId;
  /** null = available; otherwise the reason in customer language plus a fallback action */
  unavailable?: (ctx: FlowCtx) => { text: string; next?: SelfServiceId } | null;
  intro: (ctx: FlowCtx) => string;
  /** read-only facts shown above the form */
  facts?: (ctx: FlowCtx) => [string, string][];
  fields: (ctx: FlowCtx) => Field[];
  defaults?: (ctx: FlowCtx) => Values;
  validate?: (v: Values, ctx: FlowCtx) => string | null;
  confirm: string;
  run: (v: Values, ctx: FlowCtx) => FlowResult;
  /** optional, voluntary follow-up question (cancellation reason) */
  followUp?: { question: (ctx: FlowCtx) => string; options: Opt[] };
};

export const SELF_SERVICE_TEXT = {
  required: "Bitte fülle dieses Feld aus.",
  requiredSie: "Bitte füllen Sie dieses Feld aus.",
  cancel: "Abbrechen",
  optional: "(freiwillig)",
  done: "Erledigt",
  aborted: "Kein Problem, ich habe nichts geändert.",
  /** Annahme, falls im Vertrag keine Kündigungsfrist steht */
  defaultNoticeWeeks: 4,
  ibanCountry: "DE",
};

const eur = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const kwh = (v: number) => `${Math.round(v).toLocaleString("de-DE")} kWh`;
const date = (d: Date | string) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);

const energyOptions = (ctx: FlowCtx): Opt[] => [
  ctx.p.raw.electricity && { value: "electricity", label: `Strom · ${ctx.p.raw.electricity.tariff}` },
  ctx.p.raw.gas && ctx.p.raw.gas.status === "active" && { value: "gas", label: `Gas · ${ctx.p.raw.gas.tariff}` },
].filter(Boolean) as Opt[];

export const CONTRACT_LABEL: Record<string, string> = {
  electricity: "Strom", gas: "Gas", mobile: "Mobilfunk", autostrom: "Autostrom", hems: "Smart Living",
};
export const contractOptions = (p: Profile): Opt[] => {
  const c = p.raw;
  return [
    c.electricity && !c.electricity.cancelled && { value: "electricity", label: `Strom · ${c.electricity.tariff}` },
    c.gas && c.gas.status === "active" && !c.gas.cancelled && { value: "gas", label: `Gas · ${c.gas.tariff}` },
    c.mobile && { value: "mobile", label: `Mobilfunk · ${c.mobile.plan}` },
    c.autostrom && { value: "autostrom", label: "Autostrom" },
    c.hems && { value: "hems", label: "Smart Living" },
  ].filter(Boolean) as Opt[];
};

/** Annual cost from the contract's own figures (computed, no estimate). */
export function invoiceLines(e: NonNullable<Profile["raw"]["electricity"]>) {
  const energy = e.kwh * e.price;
  const base = e.base * 12;
  const paid = e.installment * 12;
  return { energy, base, total: energy + base, paid, diff: paid - (energy + base) };
}

const IBAN_RE = /^DE\d{20}$/;
export function ibanValid(raw: string) {
  const v = raw.replace(/\s+/g, "").toUpperCase();
  if (!IBAN_RE.test(v)) return false;
  const re = v.slice(4) + v.slice(0, 4);
  const num = re.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of num) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Umzug: welche Verträge mitkommen – Internet und Mobilfunk-Adresse auch ohne Energie. */
function moveOptions(ctx: FlowCtx): Opt[] {
  const c = ctx.p.raw;
  return [
    c.electricity && { value: "strom", label: "Strom" },
    c.gas && c.gas.status === "active" && { value: "gas", label: "Gas" },
    { value: "internet", label: "Internet" },
    c.mobile && { value: "mobil", label: "Mobilfunk-Adresse" },
  ].filter(Boolean) as Opt[];
}

export const CANCEL_REASONS: Opt[] = [
  { value: "preis", label: "Preis" }, { value: "service", label: "Service" }, { value: "umzug", label: "Umzug" },
  { value: "anderes", label: "Anderes" }, { value: "keine_angabe", label: "Keine Angabe" },
];

export const FLOWS: Record<SelfServiceId, Flow> = {
  zaehlerstand: {
    id: "zaehlerstand",
    unavailable: (ctx) => (energyOptions(ctx).length ? null : { text: ctx.t("Für deine Verträge brauchen wir keinen Zählerstand.", "Für Ihre Verträge benötigen wir keinen Zählerstand.") }),
    intro: (ctx) => ctx.t("Gib deinen Zählerstand ein. Ich prüfe ihn sofort.", "Geben Sie Ihren Zählerstand ein. Ich prüfe ihn sofort."),
    facts: (ctx) => {
      const e = ctx.p.raw.electricity;
      if (!e) return [];
      const last = e.lastMeterReadingAt;
      const out: [string, string][] = [["Jahresverbrauch laut Vertrag", kwh(e.kwh)]];
      if (last) {
        out.push(["Letzte Ablesung", date(last)]);
        out.push(["Erwarteter Verbrauch seitdem", `ca. ${kwh((e.kwh / 365) * Math.max(0, days(new Date(last), ctx.today)))}`]);
      }
      return out;
    },
    fields: (ctx) => [
      { id: "contract", kind: "choice", label: "Zähler", options: energyOptions(ctx) },
      { id: "value", kind: "number", label: "Zählerstand", unit: "kWh", min: 0, max: 999999 },
      { id: "date", kind: "date", label: "Abgelesen am" },
    ],
    defaults: (ctx) => ({ contract: energyOptions(ctx)[0]?.value ?? "", date: iso(ctx.today) }),
    validate: (v, ctx) => {
      const value = Number(v.value);
      if (!Number.isFinite(value) || value <= 0 || !/^\d{1,6}$/.test(v.value)) return "Bitte nur ganze Zahlen ohne Komma, höchstens 6 Stellen.";
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime()) || d > addDays(ctx.today, 1)) return "Das Ablesedatum darf nicht in der Zukunft liegen.";
      const prev = ctx.lastReading?.contract === v.contract ? ctx.lastReading : undefined;
      if (prev) {
        if (value < prev.value) return `Der Stand ist kleiner als zuletzt gemeldet (${prev.value.toLocaleString("de-DE")}). Bitte prüfen.`;
        const e = v.contract === "gas" ? ctx.p.raw.gas : ctx.p.raw.electricity;
        const expected = ((e?.kwh ?? 0) / 365) * Math.max(1, days(new Date(prev.date), d));
        if (expected > 0 && value - prev.value > expected * 3) return "Das wäre deutlich mehr Verbrauch als üblich. Bitte prüfe den Stand noch einmal.";
      }
      return null;
    },
    confirm: "Zählerstand senden",
    run: (v, ctx) => ({
      reply: ctx.t(`Danke! Dein Zählerstand ${Number(v.value).toLocaleString("de-DE")} vom ${date(v.date)} ist gespeichert.`,
        `Vielen Dank. Ihr Zählerstand ${Number(v.value).toLocaleString("de-DE")} vom ${date(v.date)} ist gespeichert.`),
      effects: [{ type: "meter", contract: v.contract, value: Number(v.value), date: v.date }],
    }),
  },

  abschlag: {
    id: "abschlag",
    unavailable: (ctx) => (ctx.p.raw.electricity ? null : { text: ctx.t("Du hast keinen Energievertrag mit Abschlag.", "Sie haben keinen Energievertrag mit Abschlag.") }),
    intro: (ctx) => ctx.t("Hier siehst du deinen Abschlag und was dein Verbrauch rechnerisch kostet.", "Hier sehen Sie Ihren Abschlag und was Ihr Verbrauch rechnerisch kostet."),
    facts: (ctx) => {
      const e = ctx.p.raw.electricity!;
      const l = invoiceLines(e);
      return [["Aktueller Abschlag", `${eur(e.installment)} im Monat`], ["Jahresverbrauch", kwh(e.kwh)], ["Rechnerisch nötig", `${eur(l.total / 12)} im Monat`]];
    },
    fields: () => [{ id: "amount", kind: "number", label: "Neuer Abschlag", unit: "€ im Monat", min: 10 }],
    defaults: (ctx) => ({ amount: String(Math.round(invoiceLines(ctx.p.raw.electricity!).total / 12)) }),
    validate: (v, ctx) => {
      const a = Number(v.amount.replace(",", "."));
      const need = invoiceLines(ctx.p.raw.electricity!).total / 12;
      if (!Number.isFinite(a) || a < 10) return "Der Abschlag muss mindestens 10 € betragen.";
      if (a < need * 0.7) return `Das ist deutlich weniger als rechnerisch nötig (${eur(need)}). Dann droht eine hohe Nachzahlung – bitte mindestens ${eur(Math.ceil(need * 0.7))}.`;
      if (a > need * 2) return `Das ist mehr als doppelt so viel wie nötig (${eur(need)}). Bitte prüfen.`;
      return null;
    },
    confirm: "Abschlag ändern",
    run: (v, ctx) => {
      const a = Math.round(Number(v.amount.replace(",", ".")) * 100) / 100;
      return {
        reply: ctx.t(`Erledigt. Dein neuer Abschlag beträgt ${eur(a)} im Monat, ab der nächsten Zahlung.`, `Erledigt. Ihr neuer Abschlag beträgt ${eur(a)} im Monat, ab der nächsten Zahlung.`),
        effects: [{ type: "contract", change: { installment: a }, audit: `Abschlag ${eur(ctx.p.raw.electricity!.installment)} → ${eur(a)}` }],
      };
    },
  },

  rechnung: {
    id: "rechnung",
    unavailable: (ctx) => (ctx.p.raw.electricity ? null : { text: ctx.t("Für Erklärungen zu anderen Rechnungen verbinde ich dich gern mit dem Service-Team.", "Für Erklärungen zu anderen Rechnungen verbinde ich Sie gern mit dem Service-Team."), next: "mitarbeiter" }),
    intro: (ctx) => ctx.t("So setzt sich dein Strom im Jahr zusammen – aus deinen Vertragsdaten berechnet:", "So setzt sich Ihr Strom im Jahr zusammen – aus Ihren Vertragsdaten berechnet:"),
    facts: (ctx) => {
      const e = ctx.p.raw.electricity!;
      const l = invoiceLines(e);
      return [
        [`Arbeitspreis: ${kwh(e.kwh)} × ${e.price.toLocaleString("de-DE", { maximumFractionDigits: 4 })} €`, eur(l.energy)],
        [`Grundpreis: 12 × ${eur(e.base)}`, eur(l.base)],
        ["Kosten im Jahr", eur(l.total)],
        [`Abschläge: 12 × ${eur(e.installment)}`, eur(l.paid)],
        [l.diff >= 0 ? "Voraussichtlich zurück" : "Voraussichtlich nachzuzahlen", eur(Math.abs(l.diff))],
      ];
    },
    fields: () => [],
    confirm: "Verstanden",
    run: (_v, ctx) => ({
      reply: ctx.t("Der Arbeitspreis hängt von deinem Verbrauch ab, der Grundpreis ist fest. Wenn der Abschlag nicht passt, kannst du ihn anpassen.",
        "Der Arbeitspreis hängt von Ihrem Verbrauch ab, der Grundpreis ist fest. Wenn der Abschlag nicht passt, können Sie ihn anpassen."),
      effects: [],
    }),
  },

  umzug: {
    id: "umzug",
    intro: (ctx) => ctx.t("Wohin geht's? Deine Verträge nimmst du einfach mit.", "Wohin ziehen Sie? Ihre Verträge nehmen Sie einfach mit."),
    fields: (ctx) => [
      { id: "date", kind: "date", label: "Einzugsdatum" },
      { id: "street", kind: "text", label: "Neue Straße und Hausnummer" },
      { id: "zip", kind: "text", label: "Postleitzahl" },
      { id: "city", kind: "text", label: "Ort" },
      { id: "meterOut", kind: "text", label: "Zählerstand beim Auszug", optional: true, placeholder: "auch später möglich" },
      { id: "take", kind: "multi", label: "Was kommt mit?", options: moveOptions(ctx) },
    ],
    defaults: (ctx) => ({ take: moveOptions(ctx).map((o) => o.value).join(",") }),
    validate: (v, ctx) => {
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime())) return "Bitte ein Datum angeben.";
      if (d < addDays(ctx.today, -42)) return "Das Datum liegt mehr als sechs Wochen zurück. Bitte ruf uns dafür an.";
      if (d > addDays(ctx.today, 365)) return "Bitte ein Datum innerhalb der nächsten 12 Monate angeben.";
      if (v.street.trim().length < 3) return "Bitte Straße und Hausnummer angeben.";
      if (!/^\d{5}$/.test(v.zip.trim())) return "Die Postleitzahl hat fünf Ziffern.";
      if (v.city.trim().length < 2) return "Bitte den Ort angeben.";
      if (v.meterOut?.trim() && !/^\d{1,6}$/.test(v.meterOut.trim())) return "Zählerstand bitte nur als ganze Zahl, höchstens 6 Stellen.";
      return null;
    },
    confirm: "Umzug melden",
    run: (v, ctx) => {
      const take = (v.take ?? "").split(",").filter(Boolean);
      const labels = moveOptions(ctx).filter((o) => take.includes(o.value)).map((o) => o.label);
      return {
        reply: ctx.t(`Danke! Dein Umzug zum ${date(v.date)} ist gemeldet.`, `Vielen Dank. Ihr Umzug zum ${date(v.date)} ist gemeldet.`),
        facts: [
          ["Neue Adresse", `${v.street.trim()}, ${v.zip.trim()} ${v.city.trim()}`],
          ["Ab", date(v.date)],
          ["Kommt mit", labels.join(", ") || "—"],
          ["Zählerstand beim Auszug", v.meterOut?.trim() ? Number(v.meterOut).toLocaleString("de-DE") : ctx.t("meldest du am Auszugstag", "melden Sie am Auszugstag")],
        ],
        effects: [{ type: "case", kind: "umzug", title: "Umzug gemeldet",
          detail: `Umzug zum ${date(v.date)} nach ${v.zip.trim()} ${v.city.trim()} · mit: ${labels.join(", ") || "—"}${v.meterOut?.trim() ? ` · Auszugsstand ${v.meterOut.trim()}` : ""}` }],
      };
    },
  },

  kontodaten: {
    id: "kontodaten",
    intro: (ctx) => ctx.t("Was möchtest du ändern?", "Was möchten Sie ändern?"),
    fields: () => [
      { id: "what", kind: "choice", label: "Angabe", options: [{ value: "iban", label: "IBAN" }, { value: "email", label: "E-Mail" }, { value: "phone", label: "Telefon" }] },
      { id: "value", kind: "text", label: "Neuer Wert" },
    ],
    defaults: () => ({ what: "iban" }),
    validate: (v) => {
      const x = v.value.trim();
      if (v.what === "iban" && !ibanValid(x)) return "Diese IBAN ist ungültig. Eine deutsche IBAN beginnt mit DE und hat 22 Stellen.";
      if (v.what === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x)) return "Bitte eine gültige E-Mail-Adresse angeben.";
      if (v.what === "phone" && !/^\+?[\d\s/-]{6,20}$/.test(x)) return "Bitte eine gültige Telefonnummer angeben.";
      return null;
    },
    confirm: "Speichern",
    run: (v, ctx) => {
      const x = v.value.replace(/\s+/g, v.what === "iban" ? "" : " ").trim();
      const shown = v.what === "iban" ? `IBAN endet auf ${x.slice(-4)}` : v.what === "email" ? "E-Mail-Adresse" : "Telefonnummer";
      return {
        reply: ctx.t(`Gespeichert: ${shown}. Du bekommst eine Bestätigung.`, `Gespeichert: ${shown}. Sie erhalten eine Bestätigung.`),
        effects: [{ type: "contact", data: { [v.what]: x }, detail: `${shown} geändert` }],
      };
    },
  },

  preisgarantie: {
    id: "preisgarantie",
    unavailable: (ctx) => {
      const ok = ctx.p.recs.some((r) => r.productId === "P-EN-02" && r.policy === "eligible") && !!ctx.p.raw.electricity;
      return ok ? null : { text: ctx.t("Für deinen Vertrag kann ich das gerade nicht direkt abschließen. Ein Rückruf klärt die Möglichkeiten.", "Für Ihren Vertrag kann ich das gerade nicht direkt abschließen. Ein Rückruf klärt die Möglichkeiten."), next: "rueckruf" };
    },
    intro: (ctx) => ctx.t("Du kannst dir wieder 24 Monate Preisgarantie sichern.", "Sie können sich erneut 24 Monate Preisgarantie sichern."),
    facts: (ctx) => {
      const e = ctx.p.raw.electricity!;
      return [["Aktueller Tarif", e.tariff], ["Preisgarantie bis", e.pgUntil ? date(e.pgUntil) : "—"], ["Neuer Tarif", "StromGarant, 24 Monate"]];
    },
    fields: () => [],
    confirm: "Preisgarantie verlängern",
    run: (_v, ctx) => {
      const e = ctx.p.raw.electricity!;
      const start = e.pgUntil && new Date(e.pgUntil) > ctx.today ? new Date(e.pgUntil) : ctx.today;
      const until = new Date(start); until.setMonth(until.getMonth() + 24);
      return {
        reply: ctx.t(`Erledigt. Deine Preisgarantie gilt jetzt bis ${date(until)}. Die Konditionen bekommst du schriftlich vor Beginn.`,
          `Erledigt. Ihre Preisgarantie gilt jetzt bis ${date(until)}. Die Konditionen erhalten Sie schriftlich vor Beginn.`),
        effects: [{ type: "contract", change: { pgUntil: iso(until), tariff: "StromGarant" }, audit: `Preisgarantie verlängert bis ${date(until)} (StromGarant)` }],
      };
    },
  },

  stoerung: {
    id: "stoerung",
    intro: (ctx) => ctx.t("Das tut mir leid. Was funktioniert nicht?", "Das tut mir leid. Was funktioniert nicht?"),
    fields: (ctx) => [
      { id: "type", kind: "choice", label: "Bereich", options: [
        ...(ctx.p.raw.autostrom || ctx.p.raw.charging ? [{ value: "laden", label: "Laden" }] : []),
        { value: "strom", label: "Strom" },
        ...(ctx.p.raw.hems ? [{ value: "hems", label: "Smart Living" }] : []),
        { value: "anderes", label: "Anderes" },
      ] },
      { id: "text", kind: "text", label: "Was ist passiert?", multiline: true, placeholder: "z. B. Ladekarte an der Säule abgelehnt" },
    ],
    defaults: (ctx) => ({ type: ctx.p.raw.autostrom || ctx.p.raw.charging ? "laden" : "strom" }),
    validate: (v) => (v.text.trim().length < 8 ? "Beschreib das Problem bitte in ein paar Worten." : null),
    confirm: "Störung melden",
    run: (v, ctx) => ({
      reply: ctx.t("Ich habe die Störung an unser Service-Team gegeben. Wir melden uns – du musst nichts weiter tun.",
        "Ich habe die Störung an unser Service-Team gegeben. Wir melden uns – Sie müssen nichts weiter tun."),
      effects: [{ type: "case", kind: "stoerung", title: v.type === "laden" ? "Ladeproblem" : v.type === "hems" ? "Smart Living gestört" : "Störung gemeldet", detail: v.text.trim() }],
    }),
  },

  einwilligungen: {
    id: "einwilligungen",
    intro: (ctx) => ctx.t("Wie sollen wir uns melden?", "Wie sollen wir uns bei Ihnen melden?"),
    fields: () => [{ id: "choice", kind: "choice", label: "Einstellung", options: [
      { value: "keine_werbung", label: "Keine Werbung mehr" },
      { value: "nur_newsletter_aus", label: "Nur Newsletter abbestellen" },
      { value: "low", label: "Seltener melden" },
      { value: "normal", label: "Normal melden" },
    ] }],
    defaults: () => ({ choice: "keine_werbung" }),
    confirm: "Übernehmen",
    run: (v, ctx) => {
      if (v.choice === "keine_werbung") return {
        reply: ctx.t("Erledigt. Du bekommst keine Werbung mehr. Nachrichten zu deinen Verträgen erhältst du weiterhin.", "Erledigt. Sie erhalten keine Werbung mehr. Nachrichten zu Ihren Verträgen erhalten Sie weiterhin."),
        effects: [{ type: "consents", consents: { newsletter_email: "withdrawn", marketing_email: "withdrawn", marketing_sms: "withdrawn", marketing_phone: "withdrawn", portal_app_personalisation: "withdrawn" }, detail: "Alle Werbe-Einwilligungen widerrufen (per Chat)" }],
      };
      if (v.choice === "nur_newsletter_aus") return {
        reply: ctx.t("Erledigt. Der Newsletter ist abbestellt.", "Erledigt. Der Newsletter ist abbestellt."),
        effects: [{ type: "consents", consents: { newsletter_email: "withdrawn" }, detail: "Newsletter abbestellt (per Chat)" }],
      };
      return {
        reply: ctx.t("Erledigt. Wir halten uns daran.", "Erledigt. Wir halten uns daran."),
        effects: [{ type: "frequency", value: v.choice }],
      };
    },
  },

  rueckruf: {
    id: "rueckruf",
    intro: (ctx) => ctx.t("Wann passt es dir?", "Wann passt es Ihnen?"),
    fields: () => [
      { id: "slot", kind: "choice", label: "Zeitfenster", options: [
        ...nextFreeCallSlots(3).map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
        { value: "nach Absprache", label: "Keiner dieser Termine passt – nach Absprache" },
      ] },
      { id: "topic", kind: "text", label: "Worum geht es?", optional: true },
    ],
    defaults: () => ({ slot: nextFreeCallSlots(1)[0] ?? "nach Absprache" }),
    confirm: "Rückruf anfragen",
    run: (v, ctx) => ({
      reply: ctx.t(`Alles klar, wir rufen dich ${v.slot} an.`, `Alles klar, wir rufen Sie ${v.slot} an.`),
      effects: [{ type: "callback", slot: v.slot }, { type: "case", kind: "rueckruf", title: "Rückruf gewünscht", detail: [v.slot, v.topic?.trim()].filter(Boolean).join(" · ") }],
    }),
  },

  mitarbeiter: {
    id: "mitarbeiter",
    intro: (ctx) => ctx.t("Ich gebe dich an unser Service-Team weiter. Magst du kurz sagen, worum es geht?", "Ich gebe Sie an unser Service-Team weiter. Möchten Sie kurz sagen, worum es geht?"),
    fields: () => [{ id: "text", kind: "text", label: "Anliegen", optional: true, multiline: true }],
    confirm: "An Service übergeben",
    run: (v, ctx) => ({
      reply: ctx.t("Erledigt. Das Service-Team sieht unseren Chat und meldet sich bei dir.", "Erledigt. Das Service-Team sieht unseren Chat und meldet sich bei Ihnen."),
      effects: [{ type: "case", kind: "mitarbeiter", title: "Übergabe von Funki", detail: v.text?.trim() || "Kunde möchte mit einem Menschen sprechen" }],
    }),
  },

  // § 312k BGB: sofort aufnehmen und bestätigen – nie blockieren oder verzögern. Grund-Frage danach, freiwillig.
  kuendigung: {
    id: "kuendigung",
    unavailable: (ctx) => (contractOptions(ctx.p).length ? null : { text: ctx.t("Ich finde keinen laufenden Vertrag, den du kündigen kannst.", "Ich finde keinen laufenden Vertrag, den Sie kündigen können.") }),
    intro: (ctx) => ctx.t("Welchen Vertrag möchtest du kündigen?", "Welchen Vertrag möchten Sie kündigen?"),
    fields: (ctx) => [{ id: "contract", kind: "choice", label: "Vertrag", options: contractOptions(ctx.p) }],
    defaults: (ctx) => ({ contract: contractOptions(ctx.p)[0]?.value ?? "" }),
    confirm: "Kündigung absenden",
    run: (v, ctx) => {
      const c = ctx.p.raw;
      const weeks = (v.contract === "electricity" ? c.electricity?.noticeWeeks : v.contract === "gas" ? c.gas?.noticeWeeks : null) ?? SELF_SERVICE_TEXT.defaultNoticeWeeks;
      const end = addDays(ctx.today, weeks * 7);
      const label = CONTRACT_LABEL[v.contract] ?? v.contract;
      return {
        reply: ctx.t(`Deine Kündigung für ${label} ist eingegangen.`, `Ihre Kündigung für ${label} ist eingegangen.`),
        facts: [["Eingegangen am", date(ctx.today)], ["Kündigungsfrist", `${weeks} Wochen`], ["Vertrag endet am", date(end)]],
        effects: [{ type: "case", kind: "kuendigung", title: `Kündigung ${label}`, detail: `Kündigung ${label} zum ${date(end)}`, contract: v.contract as "electricity", endDate: iso(end) }],
      };
    },
    followUp: {
      question: (ctx) => ctx.t("Magst du uns verraten, warum? Das ist freiwillig – die Kündigung gilt so oder so.", "Möchten Sie uns sagen, warum? Das ist freiwillig – die Kündigung gilt so oder so."),
      options: CANCEL_REASONS,
    },
  },
};
