// Funki-Tipps, wenn der Kunde nichts fragt (Master-Prompt §5). Max. ein Tipp pro Besuch, nach 8 s,
// nie bei offenem Problem. Produkt-Tipps nur bei freigegebener Empfehlung + Einwilligung. Keine Euro-Versprechen.
import type { Profile } from "@/lib/engine";
import type { SelfServiceId } from "@/config/selfService";

export type TipCtx = { p: Profile; month: number; daysToPgEnd: number | null; daysSinceReading: number | null; recommendationVisible: boolean };
export type Tip = {
  id: string; category: "Spartipp" | "Service" | "Produkt";
  when: (c: TipCtx) => boolean; du: string; sie: string; action?: SelfServiceId;
};

export const TIP_DELAY_MS = 8000;

export const TIPS: Tip[] = [
  { id: "pg-ende", category: "Service", when: (c) => c.daysToPgEnd !== null && c.daysToPgEnd >= 0 && c.daysToPgEnd < 60,
    du: "Deine Preisgarantie endet bald. Willst du sehen, wie es weitergeht?", sie: "Ihre Preisgarantie endet bald. Möchten Sie sehen, wie es weitergeht?", action: "preisgarantie" },
  { id: "zaehler-alt", category: "Service", when: (c) => c.daysSinceReading !== null && c.daysSinceReading > 300,
    du: "Dein letzter Zählerstand ist schon eine Weile her. Melden dauert nur eine Minute.", sie: "Ihr letzter Zählerstand liegt schon eine Weile zurück. Das Melden dauert nur eine Minute.", action: "zaehlerstand" },
  { id: "waermepumpe-heizsaison", category: "Spartipp", when: (c) => (c.p.raw.hems?.heatPumpDaily ?? 0) > 0 && (c.month >= 10 || c.month <= 3),
    du: "Heizsaison: Eine um 1 °C niedrigere Vorlauftemperatur entlastet die Wärmepumpe spürbar.", sie: "Heizsaison: Eine um 1 °C niedrigere Vorlauftemperatur entlastet die Wärmepumpe spürbar." },
  { id: "eauto-mittag", category: "Spartipp", when: (c) => !!c.p.raw.hems && (c.p.raw.hems.pvDaily ?? 0) > 0 && !!(c.p.raw.autostrom || c.p.raw.charging),
    du: "Sonnige Mittagsstunden sind die beste Zeit, dein E-Auto mit eigenem Solarstrom zu laden.", sie: "Sonnige Mittagsstunden sind die beste Zeit, Ihr E-Auto mit eigenem Solarstrom zu laden." },
  { id: "smart-meter", category: "Spartipp", when: (c) => c.p.raw.electricity?.meter === "smart_meter_imsys",
    du: "Mit deinem Smart Meter siehst du, wann du am meisten Strom brauchst – ein Blick lohnt sich.", sie: "Mit Ihrem Smart Meter sehen Sie, wann Sie am meisten Strom brauchen – ein Blick lohnt sich." },
  { id: "hoher-verbrauch", category: "Spartipp", when: (c) => (c.p.raw.electricity?.kwh ?? 0) > 4500,
    du: "Dein Verbrauch ist eher hoch. Geräte im Stand-by sind oft die heimlichen Stromfresser.", sie: "Ihr Verbrauch ist eher hoch. Geräte im Stand-by sind oft die heimlichen Stromfresser." },
  { id: "empfehlung", category: "Produkt", when: (c) => c.recommendationVisible,
    du: "Ich habe auf deiner Startseite einen Hinweis, der zu dir passen könnte.", sie: "Auf Ihrer Startseite gibt es einen Hinweis, der zu Ihnen passen könnte." },
  { id: "herbst", category: "Spartipp", when: (c) => c.month >= 10 || c.month <= 2,
    du: "Kurz und kräftig lüften statt Fenster kippen hält die Wärme im Raum.", sie: "Kurz und kräftig lüften statt Fenster kippen hält die Wärme im Raum." },
];
