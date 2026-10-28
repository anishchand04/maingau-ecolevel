// FAQ für Funki (Fallback ohne KI und Wissensbasis für die KI). Platzhalter werden aus den Vertragsdaten gefüllt:
// {pgUntil} {installment} {tariff} {kwh} {openCases} {noticeWeeks}. Keine Preise oder Ersparnisse erfinden.
import type { SelfServiceId } from "@/config/selfService";

export type FaqEntry = { id: string; keywords: string[]; du: string; sie: string; action?: SelfServiceId; needs?: "electricity" };

export const FAQ: FaqEntry[] = [
  { id: "preisgarantie", keywords: ["preisgarantie", "garantie", "wann endet", "preisbindung"], needs: "electricity", action: "preisgarantie",
    du: "Deine Preisgarantie für {tariff} gilt bis {pgUntil}.", sie: "Ihre Preisgarantie für {tariff} gilt bis {pgUntil}." },
  { id: "abschlag", keywords: ["abschlag", "wie hoch", "monatlich", "rate"], needs: "electricity", action: "abschlag",
    du: "Dein Abschlag beträgt {installment} im Monat.", sie: "Ihr Abschlag beträgt {installment} im Monat." },
  { id: "verbrauch", keywords: ["verbrauch", "kwh", "wie viel strom"], needs: "electricity",
    du: "Laut Vertrag rechnen wir mit {kwh} im Jahr.", sie: "Laut Vertrag rechnen wir mit {kwh} im Jahr." },
  { id: "kuendigungsfrist", keywords: ["kündigungsfrist", "frist", "wie lange gebunden"], needs: "electricity",
    du: "Deine Kündigungsfrist beträgt {noticeWeeks} Wochen.", sie: "Ihre Kündigungsfrist beträgt {noticeWeeks} Wochen." },
  { id: "status", keywords: ["stand", "status", "anliegen", "bearbeitung", "ticket"],
    du: "Offene Anliegen: {openCases}.", sie: "Offene Anliegen: {openCases}." },
  { id: "rechnung", keywords: ["rechnung", "abrechnung", "nachzahlung", "posten"], action: "rechnung",
    du: "Ich erkläre dir gern jeden Posten deiner Rechnung.", sie: "Ich erkläre Ihnen gern jeden Posten Ihrer Rechnung." },
  { id: "zaehler", keywords: ["zähler", "zählerstand", "ablesen"], action: "zaehlerstand",
    du: "Den Zählerstand kannst du direkt hier melden.", sie: "Den Zählerstand können Sie direkt hier melden." },
  { id: "umzug", keywords: ["umzug", "umziehen", "neue adresse"], action: "umzug",
    du: "Bei einem Umzug nimmst du deinen Vertrag einfach mit.", sie: "Bei einem Umzug nehmen Sie Ihren Vertrag einfach mit." },
  { id: "laden", keywords: ["laden", "ladekarte", "säule", "ladeproblem", "abgebrochen"], action: "stoerung",
    du: "Ladeprobleme nehmen wir sofort auf und kümmern uns.", sie: "Ladeprobleme nehmen wir sofort auf und kümmern uns." },
  { id: "werbung", keywords: ["werbung", "newsletter", "abbestellen", "keine mails", "spam"], action: "einwilligungen",
    du: "Werbung kannst du jederzeit abbestellen.", sie: "Werbung können Sie jederzeit abbestellen." },
  { id: "kuendigen", keywords: ["kündigen", "kündigung", "beenden", "vertrag beenden"], action: "kuendigung",
    du: "Das geht direkt hier. Die Kündigung wird sofort aufgenommen und bestätigt.", sie: "Das geht direkt hier. Die Kündigung wird sofort aufgenommen und bestätigt." },
  { id: "mensch", keywords: ["mitarbeiter", "mensch", "berater", "persönlich", "echte person"], action: "mitarbeiter",
    du: "Klar, ich verbinde dich mit dem Service-Team.", sie: "Gern verbinde ich Sie mit dem Service-Team." },
  { id: "rueckruf", keywords: ["rückruf", "anrufen", "zurückrufen", "telefon"], action: "rueckruf",
    du: "Ich kann dir einen Rückruf einplanen.", sie: "Ich kann Ihnen einen Rückruf einplanen." },
  { id: "daten", keywords: ["iban", "bankverbindung", "konto", "e-mail ändern", "email ändern", "telefonnummer"], action: "kontodaten",
    du: "Deine Daten kannst du hier ändern.", sie: "Ihre Daten können Sie hier ändern." },
  { id: "datenschutz", keywords: ["datenschutz", "daten", "personalisierung", "profil"],
    du: "Was wir für Hinweise nutzen, stellst du unter Hilfe & Service → Datenschutz ein. Ohne Einwilligung nutzen wir nur deine Vertragsdaten.",
    sie: "Was wir für Hinweise nutzen, stellen Sie unter Hilfe & Service → Datenschutz ein. Ohne Einwilligung nutzen wir nur Ihre Vertragsdaten." },
];

export const FALLBACK = {
  unknown: { du: "Das weiß ich nicht sicher. Soll ich einen Rückruf für dich einplanen?", sie: "Das weiß ich nicht sicher. Soll ich einen Rückruf für Sie einplanen?" },
  noData: { du: "Dazu habe ich in deinen Vertragsdaten nichts gefunden.", sie: "Dazu habe ich in Ihren Vertragsdaten nichts gefunden." },
  noOpenCases: "keine",
  greeting: { du: "Hallo, ich bin Funki! Wobei kann ich dir helfen?", sie: "Guten Tag, ich bin Funki. Wobei kann ich Ihnen helfen?" },
  greetingProblem: { du: "Hallo, ich bin Funki. Ich sehe, dass bei dir gerade etwas offen ist. Wie kann ich helfen?", sie: "Guten Tag, ich bin Funki. Ich sehe, dass bei Ihnen gerade etwas offen ist. Wie kann ich helfen?" },
  empathy: { du: "Das ist ärgerlich, das verstehe ich.", sie: "Das ist ärgerlich, das verstehe ich gut." },
  aiOffline: "KI gerade nicht erreichbar – Antwort aus der Wissensbasis.",
};

/** Negative wording in a new chat message → mood "verärgert" (only the mood is updated live). */
export const ANGER_RE = /ärger|unverschämt|frech|nervig|unzumutbar|inakzeptabel|enttäuscht|schon wieder|seit wochen|reicht mir|beschwer/i;
