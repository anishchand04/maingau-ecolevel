// Detailansichten der Verträge (Master-Prompt §4 "Detailansichten"): Texte, Tipps, Status-Übersetzungen.
import type { DuSie } from "@/config/portal";

export const DETAIL = {
  energy: {
    prices: "Tarif und Preise", workPrice: "Arbeitspreis", basePrice: "Grundpreis", ctKwh: "{v} ct/kWh", perMonth: "{v} € im Monat",
    guarantee: "Preisgarantie", guaranteeLeft: "noch {n} Tage", guaranteeEnded: "abgelaufen", guaranteeNone: "Keine Preisgarantie in diesem Tarif",
    meter: "Zähler", lastReading: "Letzter Zählerstand", meterAction: "Zählerstand melden",
    usage: "Verbrauch", usageYear: "{v} kWh im Jahr laut Vertrag",
    invoices: "Rechnungen", action: "Abschlag anpassen",
  },
  charging: {
    title: "Mein Laden",
    car: "Mein Auto", battery: "{v} kWh Akku", wallbox: "Wallbox zu Hause", wallboxYes: "Vorhanden – du lädst zu Hause.", wallboxYesSie: "Vorhanden – Sie laden zu Hause.",
    wallboxNo: { du: "Noch keine Wallbox erfasst. Zu Hause laden geht am bequemsten mit einer eigenen Wallbox.", sie: "Noch keine Wallbox erfasst. Zu Hause laden geht am bequemsten mit einer eigenen Wallbox." } as DuSie,
    monthly: "Ladevorgänge pro Monat", monthlyUnit: "Ladevorgänge", costs: "Ladekosten", costRow: "{month}: {eur} für {kwh} kWh",
    mix: "Wie du lädst", mixSie: "Wie Sie laden", ac: "AC (normal)", dc: "DC (schnell)",
    daytime: "Wann du lädst", daytimeSie: "Wann Sie laden",
    daytimes: { morgens: "Morgens", mittags: "Mittags", abends: "Abends", nachts: "Nachts" } as Record<string, string>,
    failed: "Nicht erfolgreiche Ladevorgänge", allGood: { du: "Alle Ladevorgänge der letzten Monate waren erfolgreich.", sie: "Alle Ladevorgänge der letzten Monate waren erfolgreich." } as DuSie,
    status: { failed: "fehlgeschlagen", aborted: "abgebrochen" } as Record<string, string>,
    reasons: { vehicle_communication: "Auto und Säule haben sich nicht verstanden", auth_rejected: "Ladekarte nicht angenommen", connector_error: "Fehler am Stecker", station_offline: "Säule war offline" } as Record<string, string>,
    tipTitle: "Tipp: günstig laden",
    tip: { du: "Mittags scheint die Sonne, nachts ist das Netz entspannt – zu diesen Zeiten zu laden schont Netz und Klima. Mit Wallbox und HEMS geht das automatisch.", sie: "Mittags scheint die Sonne, nachts ist das Netz entspannt – zu diesen Zeiten zu laden schont Netz und Klima. Mit Wallbox und HEMS geht das automatisch." } as DuSie,
    report: "Ladeproblem melden",
    noData: { title: "Noch keine Ladevorgänge", text: "Sobald du mit der Ladekarte lädst, siehst du hier deine Übersicht." },
  },
  mobile: {
    plan: "Tarif", fee: "Monatlich", minTerm: "Mindestlaufzeit bis", sims: "SIM-Karten", roaming: "Tage im Ausland (3 Monate)",
    simBlock: "SIM-Karten und Haushalt", simText: "{sims} SIM für {household} Personen im Haushalt",
    volume: "Datenvolumen", volumeText: "Ø {used} von {gb} GB genutzt",
    limitHit: { du: "Dein Datenvolumen war in {n} der letzten 3 Monate aufgebraucht.", sie: "Ihr Datenvolumen war in {n} der letzten 3 Monate aufgebraucht." } as DuSie,
    limitOk: { du: "Dein Volumen hat in den letzten 3 Monaten immer gereicht.", sie: "Ihr Volumen hat in den letzten 3 Monaten immer gereicht." } as DuSie,
    upgrade: "Mehr Datenvolumen ansehen", upgradeDone: "Wir melden uns mit den Details.",
  },
  hems: {
    devices: "Meine Geräte", online: "online", offline: "offline", lastSeen: "zuletzt {at}",
    pv: "Solarstrom", pvDaily: "Ø {v} kWh Solarstrom am Tag (September)", self: "Eigenverbrauch", selfText: "{p} % des Solarstroms selbst genutzt",
    noPv: "Keine Solardaten vorhanden.",
    offlineHelp: { du: "Ein Gerät ist offline. Meist hilft es, das Gateway kurz vom Strom zu trennen. Klappt das nicht, kümmern wir uns.", sie: "Ein Gerät ist offline. Meist hilft es, das Gateway kurz vom Strom zu trennen. Klappt das nicht, kümmern wir uns." } as DuSie,
    report: "Störung melden",
    connection: "Verbindung",
    types: { hems_gateway: "HEMS-Gateway", pv_inverter: "Wechselrichter (PV)", home_battery: "Heimspeicher", wallbox: "Wallbox", heat_pump: "Wärmepumpe", smart_meter: "Smart Meter" } as Record<string, string>,
  },
  shop: {
    orders: "Meine Bestellungen", status: { delivered: "geliefert", returned: "zurückgeschickt", cancelled: "storniert" } as Record<string, string>,
    tipTitle: "So holst du mehr raus", tipTitleSie: "So holen Sie mehr raus",
    accessories: "Passt dazu", help: "Hilfe zum Produkt",
    helpText: { du: "Fragen zur Einrichtung oder ein Defekt? Funki hilft sofort oder gibt an das Service-Team weiter.", sie: "Fragen zur Einrichtung oder ein Defekt? Funki hilft sofort oder gibt an das Service-Team weiter." } as DuSie, helpDraft: "Ich habe eine Frage zu meinem Produkt: {product}",
    empty: { title: "Noch keine Bestellungen", text: "Im MAINGAU-Shop gibt es Geräte, die beim Energiesparen helfen." },
    categoryIcon: { solar: "sun", e_mobility: "car", smart_home: "home", energy_saving: "gauge", accessories: "shop" } as Record<string, string>,
  },
  blocksEmpty: "Dazu liegen noch keine Daten vor.",
  usageEmpty: { du: "Mit einem Smart Meter oder dem Lesekopf siehst du deinen Verlauf hier.", sie: "Mit einem Smart Meter oder dem Lesekopf sehen Sie Ihren Verlauf hier." } as DuSie,
  allOnline: { du: "Alle Geräte sind verbunden.", sie: "Alle Geräte sind verbunden." } as DuSie,
  nothingMore: { du: "Gerade passt nichts Weiteres – wir zeigen dir nur, was wirklich zu dir passt.", sie: "Gerade passt nichts Weiteres – wir zeigen Ihnen nur, was wirklich zu Ihnen passt." } as DuSie,
  orders: { one: "Bestellung", many: "Bestellungen", last: "Zuletzt" },
};

/** "So holst du mehr raus" – ein Tipp je Shop-Produkt. Keine Euro-Versprechen. */
export const PRODUCT_TIPS: Record<string, DuSie> = {
  "Balkonkraftwerk 800 W": { du: "Richte die Module möglichst nach Süden aus und nutze Geräte wie Waschmaschine tagsüber.", sie: "Richten Sie die Module möglichst nach Süden aus und nutzen Sie Geräte wie die Waschmaschine tagsüber." },
  "LED-Set 10 Stk": { du: "Tausche zuerst die Lampen, die am längsten brennen – Flur, Küche, Wohnzimmer.", sie: "Tauschen Sie zuerst die Lampen, die am längsten brennen – Flur, Küche, Wohnzimmer." },
  "Ladekabel Typ 2": { du: "Rolle das Kabel locker auf und lagere es trocken – das schont Stecker und Isolierung.", sie: "Rollen Sie das Kabel locker auf und lagern Sie es trocken – das schont Stecker und Isolierung." },
  "Powerbank Solar": { du: "Lade sie am Fenster in der Sonne – dann ist sie unterwegs voll.", sie: "Laden Sie sie am Fenster in der Sonne – dann ist sie unterwegs voll." },
  "Smart Plug 4er-Set": { du: "Steck die Plugs an Fernseher und Router – die App zeigt dir, was im Stand-by zieht.", sie: "Stecken Sie die Plugs an Fernseher und Router – die App zeigt, was im Stand-by zieht." },
  "Smarte Thermostate 3er": { du: "Stell Zeitpläne für Schlaf- und Arbeitszeiten ein – dann heizt du nur, wenn jemand da ist.", sie: "Stellen Sie Zeitpläne für Schlaf- und Arbeitszeiten ein – dann heizen Sie nur, wenn jemand da ist." },
  "Stromzähler-Lesekopf": { du: "Verbinde den Lesekopf mit der App – so siehst du deinen Verbrauch fast live.", sie: "Verbinden Sie den Lesekopf mit der App – so sehen Sie Ihren Verbrauch fast live." },
  "Wallbox 11 kW": { du: "Plane das Laden für mittags oder nachts – mit HEMS und Solaranlage sogar mit eigenem Strom.", sie: "Planen Sie das Laden für mittags oder nachts – mit HEMS und Solaranlage sogar mit eigenem Strom." },
};

export const INVOICE_TEXT = {
  title: "Meine Rechnungen",
  download: "PDF herunterladen",
  preparing: "PDF wird erstellt …",
  error: "Das PDF konnte nicht erstellt werden. Bitte noch einmal versuchen.",
  empty: { title: "Noch keine Rechnungen", text: "Rechnungen erscheinen hier, sobald ein Vertrag abgerechnet wurde." },
  demo: "Demo-Rechnung – keine echte Rechnung",
  /** Annahme: Fälligkeit 14 Tage nach Rechnungsdatum */
  dueDays: 14,
  annual: "Jahresabrechnung {contract}",
  monthly: "{contract} {month}",
  period: "Zeitraum", due: "Fällig am", amount: "Betrag", refund: "Guthaben", tariff: "Tarif", guarantee: "Preisgarantie bis",
  customer: "Kundennummer", items: "Posten", total: "Summe", usage: "Verbrauch",
  lines: {
    energy: "Verbrauch {kwh} kWh × {price} ct", base: "Grundpreis 12 × {base} €", paid: "Bereits gezahlte Abschläge 12 × {inst} €",
    charge: "{n} Ladevorgänge, {kwh} kWh", mobile: "Tarif {plan}, {sims} SIM",
  },
  bars: { used: "Verbraucht", covered: "Durch Abschläge gedeckt" },
};
