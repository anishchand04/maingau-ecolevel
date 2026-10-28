// Service-Cockpit: Prioritäten aus den CARE-Regeln (nicht nach Kundenwert), proaktive Auslöser, Texte.
export type InboxFilter = "alle" | "kuendigung" | "beschwerde" | "zahlung" | "technik" | "uebergabe" | "proaktiv";

export const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "alle", label: "Alle" }, { id: "kuendigung", label: "Kündigungen" }, { id: "beschwerde", label: "Beschwerden" },
  { id: "zahlung", label: "Zahlung" }, { id: "technik", label: "Technik" }, { id: "uebergabe", label: "Funki-Übergaben" },
  { id: "proaktiv", label: "Proaktiv" },
];

/** 1 = kritisch … 4 = kann warten. Reihenfolge der CARE-Regeln, unabhängig vom Kundenwert. */
export const PRIORITY = { kuendigung: 1, beschwerde: 1, technik: 2, zahlung: 2, uebergabe: 2, anliegen: 3, rueckruf: 3, proaktiv: 4 } as const;
export const PRIORITY_LABEL: Record<number, string> = { 1: "Kritisch", 2: "Hoch", 3: "Normal", 4: "Proaktiv" };

export const SOURCE_DE = { funki: "Funki", uebergabe: "Funki-Übergabe", ticket: "Ticket", anruf: "Anruf", kuendigung: "Kündigung", proaktiv: "Proaktiv", portal: "Portal" } as const;

/** Proaktive Auslöser (ersetzt die alte Retention-Seite). */
export const PROACTIVE = {
  pgDays: 60,
  failedCharges30d: 2,
  csatMax: 2,
  meterOverdueDays: 365,
  text: {
    pg: { trigger: "Preisgarantie endet in {n} Tagen", suggestion: "Kunde anrufen und Preisgarantie-Optionen erklären." },
    pgEnded: { trigger: "Preisgarantie ist abgelaufen", suggestion: "Kunde anrufen und die aktuellen Konditionen erklären." },
    charging: { trigger: "{n} fehlgeschlagene Ladevorgänge in 30 Tagen", suggestion: "Ladekarte und Säulen prüfen, Kunde vorab informieren." },
    hems: { trigger: "Smart-Living-Gerät offline", suggestion: "Fernwartung anstoßen, sonst Kunde mit Anleitung zum Neustart kontaktieren." },
    csat: { trigger: "Letzte Bewertung {n}/5", suggestion: "Nachfassen: Was lief schief, ist alles geklärt?" },
    meter: { trigger: "Zählerstand seit über einem Jahr nicht gemeldet", suggestion: "Erinnerung mit Link zum Zählerstand im Portal schicken." },
  },
};

/** Annahme für die Entlastungs-Schätzung, falls eine Kategorie keine Kostendaten hat. */
export const MINUTES_PER_CASE = 6;
/** Self-Service-Aktion → Ticketkategorie für die Ø Bearbeitungskosten aus serviceStats. */
export const SELF_SERVICE_CATEGORY: Record<string, string> = {
  "Zählerstand gemeldet": "meter", "Vertrag geändert": "billing", "Einwilligung geändert": "tariff", "Kontaktdaten geändert": "billing",
};

export const SERVICE_TEXT = {
  title: "Eingang",
  sub: "Sortiert nach Dringlichkeit aus den CARE-Regeln – nicht nach Kundenwert.",
  stats: { open: "Offene Fälle", critical: "davon kritisch", funki: "von Funki gelöst", handover: "übergeben" },
  cols: { priority: "Priorität", customer: "Kunde", matter: "Anliegen", source: "Quelle", mood: "Stimmung", waiting: "wartet seit" },
  empty: "Keine Fälle in dieser Ansicht.",
  relief: "Routineanliegen automatisiert – mehr Zeit für schwierige Fälle",
  reliefDetail: "{n} Anliegen von Funki erledigt × Ø Bearbeitungskosten der Kategorie = ca. {eur}",
  more: "mehr",
  less: "weniger",
  open: "Fall öffnen",
  today: "heute", days: "{n} Tagen", day: "1 Tag",
  mood: { zufrieden: "zufrieden", neutral: "neutral", verärgert: "verärgert" },
  // Fallansicht
  back: "Zurück zum Eingang",
  customer: "Kunde",
  since: "Kunde seit",
  contracts: "Verträge",
  style: "Kommunikationsstil",
  consents: "Einwilligungen",
  summary: "Fallzusammenfassung",
  summaryTemplate: "Vorlage aus den Falldaten",
  summaryAi: "KI-Vorschlag",
  summaryMake: "KI-Zusammenfassung erzeugen",
  timeline: "Zeitleiste",
  nextStep: "Nächster Schritt",
  draft: "Antwortentwurf",
  draftHint: "Im Stil des Kunden. Senden ändert nur den Status, es wird nichts verschickt.",
  send: "Senden",
  sent: "Antwort als gesendet markiert",
  callback: "Rückruf planen",
  solve: "Fall lösen",
  solved: "Fall gelöst – Verkaufssperre aufgehoben, Marketing rechnet neu.",
  goodwill: "Kulanz vorschlagen",
  goodwillNote: "Kulanz vorgeschlagen – braucht Freigabe",
  forward: "Weiterleiten",
  forwarded: "An Fachabteilung weitergeleitet",
  confirmCancel: "Kündigung bestätigen",
  cancelConfirmed: "Kündigung bestätigt",
  retention: "Halteangebot anbieten (optional)",
  retentionNote: "Halteangebot nur auf Wunsch des Kunden – die Kündigung wird nicht verzögert.",
  noValues: "Service sieht keine Kundenwerte.",
  otherCases: "Weitere offene Fälle dieses Kunden – die Verkaufssperre fällt erst, wenn alle gelöst sind:",
  notFound: "Diesen Fall gibt es nicht mehr.",
  reason: "Grund",
  endDate: "Vertrag endet",
  quote: "Zitat",
};

export const REPLY_TEMPLATES: Record<string, { du: string; sie: string }> = {
  kuendigung: { du: "Hallo {name}, deine Kündigung ist bestätigt. Dein Vertrag endet am {end}. Wenn du Fragen hast, melde dich gern.", sie: "Guten Tag, Ihre Kündigung ist bestätigt. Ihr Vertrag endet am {end}. Bei Fragen sind wir gern für Sie da." },
  beschwerde: { du: "Hallo {name}, danke, dass du uns Bescheid gibst – das tut uns leid. Wir kümmern uns persönlich darum und melden uns bis morgen.", sie: "Guten Tag, vielen Dank für Ihre Nachricht – das tut uns leid. Wir kümmern uns persönlich darum und melden uns bis morgen bei Ihnen." },
  technik: { du: "Hallo {name}, wir haben die Störung aufgenommen und prüfen sie gerade. Du musst nichts weiter tun – wir melden uns.", sie: "Guten Tag, wir haben die Störung aufgenommen und prüfen sie gerade. Sie müssen nichts weiter tun – wir melden uns." },
  zahlung: { du: "Hallo {name}, wir haben gesehen, dass eine Zahlung offen ist. Lass uns gemeinsam eine Lösung finden, z. B. eine Ratenzahlung.", sie: "Guten Tag, eine Zahlung ist noch offen. Gern finden wir gemeinsam eine Lösung, zum Beispiel eine Ratenzahlung." },
  uebergabe: { du: "Hallo {name}, hier ist das Service-Team. Funki hat uns dein Anliegen übergeben – wir kümmern uns jetzt.", sie: "Guten Tag, hier ist das Service-Team. Funki hat uns Ihr Anliegen übergeben – wir kümmern uns jetzt darum." },
  proaktiv: { du: "Hallo {name}, uns ist aufgefallen: {trigger}. Sollen wir kurz telefonieren?", sie: "Guten Tag, uns ist aufgefallen: {trigger}. Sollen wir kurz telefonieren?" },
  anliegen: { du: "Hallo {name}, danke für deine Nachricht. Wir sind an deinem Anliegen dran und melden uns.", sie: "Guten Tag, vielen Dank für Ihre Nachricht. Wir kümmern uns um Ihr Anliegen und melden uns." },
};
