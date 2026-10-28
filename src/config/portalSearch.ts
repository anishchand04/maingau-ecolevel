// Suche "Was möchtest du tun?": Schlagwörter → Ziel. Kein Treffer → "Frag Funki" mit dem Suchtext.
import { SELF_SERVICE } from "@/config/selfService";

export type SearchTarget =
  | { kind: "action"; id: string }
  | { kind: "page"; to: "/portal" | "/portal/benefits" | "/portal/journey" | "/portal/service"; hash?: string }
  | { kind: "contract"; id: "electricity" | "gas" | "mobile" | "autostrom" | "hems" | "shop" };

export type SearchEntry = { group: "action" | "contract" | "faq"; title: string; keywords: string[]; target: SearchTarget };

const ACTION_KEYWORDS: Record<string, string[]> = {
  zaehlerstand: ["zähler", "zählerstand", "ablesen", "stand", "meter"],
  abschlag: ["abschlag", "rate", "monatlich", "zahlung", "betrag"],
  rechnung: ["rechnung", "abrechnung", "jahresabrechnung", "kosten", "posten"],
  umzug: ["umzug", "umziehen", "adresse", "neue wohnung"],
  kontodaten: ["iban", "bank", "konto", "lastschrift", "email", "e-mail", "telefonnummer", "kontaktdaten"],
  preisgarantie: ["preisgarantie", "garantie", "verlängern", "tarif wechseln", "tarifwechsel"],
  stoerung: ["störung", "ladeproblem", "laden", "säule", "ladekarte", "ausfall", "hems", "offline", "defekt"],
  einwilligungen: ["werbung", "newsletter", "einwilligung", "datenschutz", "abbestellen", "personalisierung"],
  rueckruf: ["rückruf", "anrufen", "zurückrufen"],
  mitarbeiter: ["mitarbeiter", "mensch", "berater", "service-team", "beschwerde"],
  kuendigung: ["kündigen", "kündigung", "vertrag beenden", "beenden"],
};

export const PORTAL_SEARCH: SearchEntry[] = [
  ...SELF_SERVICE.map((s): SearchEntry => ({ group: "action", title: s.title, keywords: ACTION_KEYWORDS[s.id] ?? [], target: { kind: "action", id: s.id } })),
  { group: "contract", title: "Stromvertrag", keywords: ["strom", "stromvertrag", "tarif", "kwh", "verbrauch"], target: { kind: "contract", id: "electricity" } },
  { group: "contract", title: "Gasvertrag", keywords: ["gas", "heizung", "gasvertrag"], target: { kind: "contract", id: "gas" } },
  { group: "contract", title: "Mobilfunk", keywords: ["handy", "mobil", "mobilfunk", "datenvolumen", "sim", "gb"], target: { kind: "contract", id: "mobile" } },
  { group: "contract", title: "Autostrom", keywords: ["autostrom", "e-auto", "ladekarte", "laden", "ladevorgang"], target: { kind: "contract", id: "autostrom" } },
  { group: "contract", title: "Smart Living", keywords: ["smart", "hems", "pv", "solar", "wärmepumpe", "speicher"], target: { kind: "contract", id: "hems" } },
  { group: "faq", title: "Meine Vorteile ansehen", keywords: ["vorteil", "sparen", "sparcheck", "bonus"], target: { kind: "page", to: "/portal/benefits" } },
  { group: "faq", title: "EcoLevel und EcoJourney", keywords: ["ecolevel", "eco", "journey", "level", "station"], target: { kind: "page", to: "/portal/journey" } },
  { group: "faq", title: "Anrede und Ton", keywords: ["anrede", "duzen", "siezen", "ansprache", "stil"], target: { kind: "page", to: "/portal/service", hash: "datenschutz" } },
  { group: "faq", title: "Datenschutz und Einwilligungen", keywords: ["datenschutz", "daten", "einwilligung", "privat"], target: { kind: "page", to: "/portal/service", hash: "datenschutz" } },
  { group: "faq", title: "Offene Anliegen", keywords: ["anliegen", "ticket", "status", "bearbeitung"], target: { kind: "page", to: "/portal/service" } },
];

const norm = (s: string) => s.toLowerCase().normalize("NFC").trim();

/** Every query word must hit a keyword or the title (prefix match). Max 6 hits. */
export function searchPortal(query: string): SearchEntry[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  return PORTAL_SEARCH.filter((e) => {
    const hay = [norm(e.title), ...e.keywords.map(norm)];
    return words.every((w) => hay.some((h) => h.includes(w) || (h.length >= 4 && w.includes(h))));
  }).slice(0, 6);
}
