// "Passt zu dir": persönliche Begründung je Produkt (Master-Prompt §4, §6b). Regeln entscheiden NICHT über
// Zulässigkeit – die prüft die Engine hart (Voraussetzungen, "bereits vorhanden", Einwilligung, Benefit-Gate).
// Eine Karte erscheint nur, wenn eine Regel greift: lieber 1 gut begründete Karte als 3 schwache.
import type { RawCustomer } from "@/lib/engine";
import type { Level } from "@/config/region";

export type RuleCtx = {
  c: RawCustomer; month: number; sun: Level | null; heat: Level | null;
  ev: boolean; wallbox: boolean; heatPump: boolean; pv: boolean; sustainable: boolean;
};
export type ShopRule = {
  id: string; productId: string; profile: "nachhaltig" | "smart" | "emobil" | "heizen" | "mobil" | "energie";
  when: (x: RuleCtx) => boolean;
  /** {placeholders} are filled from the customer's data */
  du: (x: RuleCtx) => string; sie: (x: RuleCtx) => string;
};

export const MAX_CARDS = 3;
export const HEATING_MONTHS = [10, 11, 12, 1, 2, 3];
const eveningShare = (c: RawCustomer) => {
  const d = c.charging?.byDaytime;
  const total = d ? d.morgens + d.mittags + d.abends + d.nachts : 0;
  return total ? (d!.abends + d!.nachts) / total : 0;
};
const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

export const SHOP_RULES: ShopRule[] = [
  { id: "wallbox-abends", productId: "P-SH-02", profile: "emobil",
    when: (x) => x.ev && !x.wallbox && eveningShare(x.c) >= 0.4,
    du: (x) => `Du lädst oft abends oder nachts (${Math.round(eveningShare(x.c) * 100)} % deiner Ladevorgänge) – mit einer eigenen Wallbox geht das zu Hause schneller.`,
    sie: (x) => `Sie laden oft abends oder nachts (${Math.round(eveningShare(x.c) * 100)} % Ihrer Ladevorgänge) – mit einer eigenen Wallbox geht das zu Hause schneller.` },
  { id: "wallbox", productId: "P-SH-02", profile: "emobil",
    when: (x) => x.ev && !x.wallbox,
    du: () => "Du fährst elektrisch – mit einer eigenen Wallbox lädst du bequem zu Hause.",
    sie: () => "Sie fahren elektrisch – mit einer eigenen Wallbox laden Sie bequem zu Hause." },
  { id: "autostrom", productId: "P-AS-01", profile: "emobil",
    when: (x) => x.ev && !x.c.autostrom,
    du: () => "Du fährst elektrisch – mit Autostrom lädst du unterwegs mit einer Karte an über 927.000 Ladepunkten.",
    sie: () => "Sie fahren elektrisch – mit Autostrom laden Sie unterwegs mit einer Karte an über 927.000 Ladepunkten." },
  { id: "balkon-sonne", productId: "P-SH-01", profile: "nachhaltig",
    when: (x) => x.sustainable && x.sun === "hoch",
    du: (x) => `Dir ist eigene Energie wichtig, und in ${x.c.region?.city} scheint die Sonne überdurchschnittlich – ein Balkonkraftwerk liefert Sonnenstrom auch ohne eigenes Dach.`,
    sie: (x) => `Ihnen ist eigene Energie wichtig, und in ${x.c.region?.city} scheint die Sonne überdurchschnittlich – ein Balkonkraftwerk liefert Sonnenstrom auch ohne eigenes Dach.` },
  { id: "balkon", productId: "P-SH-01", profile: "nachhaltig",
    when: (x) => x.sustainable,
    du: () => "Dir ist eigene Energie wichtig – ein Balkonkraftwerk liefert Sonnenstrom auch ohne eigenes Dach.",
    sie: () => "Ihnen ist eigene Energie wichtig – ein Balkonkraftwerk liefert Sonnenstrom auch ohne eigenes Dach." },
  { id: "thermostat-saison", productId: "P-SH-03", profile: "heizen",
    when: (x) => HEATING_MONTHS.includes(x.month) && !!x.c.gas && x.c.gas.status === "active",
    du: (x) => `Die Heizsaison läuft${x.heat === "hoch" ? " und in deiner Region wird viel geheizt" : ""} – smarte Thermostate heizen nur, wenn jemand da ist.`,
    sie: (x) => `Die Heizsaison läuft${x.heat === "hoch" ? " und in Ihrer Region wird viel geheizt" : ""} – smarte Thermostate heizen nur, wenn jemand da ist.` },
  { id: "plugs-verbrauch", productId: "P-SH-04", profile: "nachhaltig",
    when: (x) => (x.c.electricity?.kwh ?? 0) > 4000,
    du: (x) => `Dein Verbrauch liegt bei ${fmt(x.c.electricity!.kwh)} kWh im Jahr – Smart Plugs zeigen, welche Geräte am meisten ziehen.`,
    sie: (x) => `Ihr Verbrauch liegt bei ${fmt(x.c.electricity!.kwh)} kWh im Jahr – Smart Plugs zeigen, welche Geräte am meisten ziehen.` },
  { id: "hems-start", productId: "P-SL-01", profile: "smart",
    when: (x) => (x.pv || x.heatPump || x.ev) && !x.c.hems?.devices.includes("hems_gateway"),
    du: (x) => `${[x.pv && "Solaranlage", x.heatPump && "Wärmepumpe", x.ev && "E-Auto"].filter(Boolean).join(", ")} – mit dem HEMS arbeiten sie zusammen und du nutzt mehr eigenen Strom.`,
    sie: (x) => `${[x.pv && "Solaranlage", x.heatPump && "Wärmepumpe", x.ev && "E-Auto"].filter(Boolean).join(", ")} – mit dem HEMS arbeiten sie zusammen und Sie nutzen mehr eigenen Strom.` },
  { id: "hems-speicher", productId: "P-SL-02", profile: "smart",
    when: (x) => !!x.c.hems?.devices.includes("home_battery"),
    du: (x) => `Dein HEMS steuert schon ${x.c.hems!.devices.length} Geräte – mit der Speicher-Optimierung lädt dein Speicher zum besten Zeitpunkt.`,
    sie: (x) => `Ihr HEMS steuert bereits ${x.c.hems!.devices.length} Geräte – mit der Speicher-Optimierung lädt Ihr Speicher zum besten Zeitpunkt.` },
  { id: "hems-wallbox", productId: "P-SL-03", profile: "smart",
    when: (x) => x.wallbox,
    du: () => "Deine Wallbox hängt am HEMS – so lädst du dein Auto mit eigenem Solarstrom.",
    sie: () => "Ihre Wallbox hängt am HEMS – so laden Sie Ihr Auto mit eigenem Solarstrom." },
  { id: "dynamisch", productId: "P-EN-05", profile: "energie",
    when: (x) => x.c.electricity?.meter === "smart_meter_imsys" && (x.ev || x.heatPump),
    du: (x) => `Dein Smart Meter ist schon da und ${x.ev ? "dein E-Auto" : "deine Wärmepumpe"} kann warten – mit dem dynamischen Tarif nutzt du Strom, wenn er günstig ist.`,
    sie: (x) => `Ihr Smart Meter ist bereits da und ${x.ev ? "Ihr E-Auto" : "Ihre Wärmepumpe"} kann warten – mit dem dynamischen Tarif nutzen Sie Strom, wenn er günstig ist.` },
  { id: "mobil-upgrade", productId: "P-MO-02", profile: "mobil",
    when: (x) => (x.c.mobile?.limitHits ?? 0) >= 2,
    du: (x) => `Dein Datenvolumen war in ${x.c.mobile!.limitHits} der letzten 3 Monate aufgebraucht – mit dem nächsten Tarif surfst du ohne Drosselung.`,
    sie: (x) => `Ihr Datenvolumen war in ${x.c.mobile!.limitHits} der letzten 3 Monate aufgebraucht – mit dem nächsten Tarif surfen Sie ohne Drosselung.` },
  { id: "zusatz-sim", productId: "P-MO-03", profile: "mobil",
    when: (x) => !!x.c.mobile && x.c.household > x.c.mobile.sims,
    du: (x) => `In deinem Haushalt leben ${x.c.household} Personen, du hast ${x.c.mobile!.sims} SIM – eine Zusatz-SIM teilt dein Datenvolumen.`,
    sie: (x) => `In Ihrem Haushalt leben ${x.c.household} Personen, Sie haben ${x.c.mobile!.sims} SIM – eine Zusatz-SIM teilt Ihr Datenvolumen.` },
];

/** Mobilfunk-Hinweise ohne Verkauf (z. B. EU-Roaming ist inklusive). */
export const MOBILE_NOTES = {
  roamingMinDays: 3,
  roaming: {
    du: "Du warst zuletzt {n} Tage im Ausland – in der EU telefonierst und surfst du ohne Aufpreis wie zu Hause.",
    sie: "Sie waren zuletzt {n} Tage im Ausland – in der EU telefonieren und surfen Sie ohne Aufpreis wie zu Hause.",
  },
};
