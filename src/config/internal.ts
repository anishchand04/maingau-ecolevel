// Interner Bereich: deutsche Bezeichnungen für Engine-Codes. Fachbegriffe (SELL/CARE/WAIT, ΔCLV) bleiben.
export const INTERNAL_NAV = {
  areas: [
    { to: "/marketing", label: "Marketing" },
    { to: "/service", label: "Service" },
  ],
  marketing: [
    { to: "/marketing", label: "Übersicht", exact: true },
    { to: "/marketing/customers", label: "Kunden" },
    { to: "/marketing/recommendations", label: "Empfehlungen" },
    { to: "/marketing/simulator", label: "Simulation & Analyse" },
  ],
  service: [
    { to: "/service", label: "Eingang", exact: true },
  ],
  role: { marketing: "Angemeldet als Marketing (Demo-Rolle)", service: "Angemeldet als Service (Demo-Rolle)" },
  portalLink: "Zum Kundenportal",
  demoLink: "Demo-Ansicht",
} as const;

/** Policy codes from the engine → German, one short phrase. */
export const POLICY_DE: Record<string, string> = {
  OK: "zulässig",
  CARE_FIRST: "Hilfe zuerst",
  NO_CHANNEL_CONSENT: "keine Werbeeinwilligung",
  NO_PROFILING_CONSENT: "keine Einwilligung zur Profilbildung",
  CONTACT_LIMIT: "Kontaktlimit erreicht",
  NO_CLEAR_BENEFIT: "kein klarer Kundenvorteil",
  CARE: "Service-Fall",
  WAIT: "keine Ansprache",
  TUNING_MIN_EV: "unter Mindest-Erwartungswert",
  TUNING_PAUSED: "Angebot pausiert",
  TUNING_CONTACTS: "über eingestelltem Kontaktlimit",
};

/** Blocked recommendations, grouped by reason – shown as bars in the overview. */
export const BLOCK_REASON_DE: Record<string, string> = {
  NO_CHANNEL_CONSENT: "Keine Werbeeinwilligung",
  NO_PROFILING_CONSENT: "Keine Profiling-Einwilligung",
  CARE_FIRST: "Offenes Problem (Hilfe zuerst)",
  CONTACT_LIMIT: "Kontaktlimit erreicht",
  NO_CLEAR_BENEFIT: "Kein klarer Vorteil",
  TUNING_MIN_EV: "Unter Mindest-EV (Stellschraube)",
  TUNING_PAUSED: "Angebot pausiert (Stellschraube)",
  TUNING_CONTACTS: "Kontaktlimit (Stellschraube)",
};

export const FLAG_DE: Record<string, string> = {
  complaint: "Offene Beschwerde",
  ticket: "Offenes Service-Ticket",
  dunning: "Mahnung (Stufe 2+)",
  dunning1: "Zahlungserinnerung offen",
  charging: "Wiederholte Ladeabbrüche",
  hems: "Smart-Living-Gerät offline",
  cancel: "Kündigung in Bearbeitung",
  csat: "Niedrige Zufriedenheit",
};

export const CHANNEL_DE: Record<string, string> = {
  newsletter_email: "Newsletter", marketing_email: "E-Mail", email: "E-Mail", portal_popup: "Portal", app_push: "App",
  sms: "SMS", outbound_call: "Telefon", marketing_phone: "Telefon", marketing_sms: "SMS", portal_app_personalisation: "Portal/App",
};

export const CONSENT_CHANNELS = [
  { key: "marketing_email", label: "E-Mail" },
  { key: "marketing_phone", label: "Telefon" },
  { key: "marketing_sms", label: "SMS" },
  { key: "portal_app_personalisation", label: "Portal/App" },
  { key: "newsletter_email", label: "Newsletter" },
] as const;

export const NEED_EVIDENCE_DE = { confirmed: "bestätigt", inferred: "abgeleitet", potential: "Hypothese" } as const;

export const DECISION_DE = { approved: "Freigegeben", rejected: "Abgelehnt", review: "Zurückgestellt", scheduled: "Geplant", held_out: "Kontrollgruppe" } as const;

export const ECO_DE = ["Entdecken", "Verbinden", "Optimieren", "EcoChampion"] as const;

export const OBSERVED_NOTE = "beobachtet – kein kausaler Nachweis";
/** Unter dieser Gruppengröße erscheint ein Warnhinweis zur Aussagekraft. */
export const SMALL_GROUP = 300;

/** Engine guardrails G1–G9 in German. */
export const GUARDRAIL_DE: Record<string, string> = {
  G1: "Kein SELL bei Beschwerde, Kündigung, Mahnung oder technischer Störung",
  G2: "Kein SELL über einen Kanal ohne Einwilligung",
  G3: "Kein personalisiertes SELL ohne Profiling-Einwilligung",
  G4: "Kein „Du“ ohne Profiling-Einwilligung",
  G5: "Kein SELL über dem Kontaktlimit des Kunden",
  G6: "Kein Angebot, das der Kunde abgelehnt hat oder schon besitzt",
  G7: "Kein SELL mit negativem Erwartungswert",
  G8: "Jede Entscheidung hat eine Begründung",
  G9: "Kein SELL ohne klaren Kundenvorteil",
};

export const EVENT_DE: Record<string, string> = {
  agent_nba_feedback: "Service-Rückmeldung zur Empfehlung", call_transcript_ready: "Gesprächsprotokoll liegt vor", cart_abandoned: "Warenkorb abgebrochen",
  charge_session_failed: "Ladevorgang fehlgeschlagen", consent_changed: "Einwilligung geändert", contract_cancellation_received: "Kündigung eingegangen",
  dunning_level_changed: "Mahnstufe geändert", gas_meter_deregistration_received: "Gaszähler abgemeldet", hems_device_offline: "Smart-Living-Gerät offline",
  meter_reading_submitted: "Zählerstand gemeldet", mobile_data_threshold: "Datenvolumen fast aufgebraucht", newsletter_clicked: "Newsletter geklickt",
  order_placed: "Bestellung im Shop", ticket_created: "Ticket erstellt", ticket_updated: "Ticket aktualisiert",
};

/** Lernen (Wirkung): Texte der Lernschleife. */
export const LEARN_TEXT = {
  title: "Lernen",
  intro: "Die Engine lernt nur Schätzungen (Annahmequoten), nie Regeln. Jede neue Version braucht eine Freigabe und lässt sich zurückrollen.",
  randomized: "randomisiert – Kontrollgruppe per Zufall, Wirkung belegbar",
  observed: OBSERVED_NOTE,
  notEnough: "zu wenig Daten – keine Wirkungsaussage",
  holdout: "Holdout: Anteil der sonst berechtigten Empfehlungen, die bewusst nicht gesendet werden",
  holdoutHint: "Betrifft nie CARE-Fälle, gesperrte Kunden oder Kunden ohne Einwilligung.",
  simulatedNote: "Ergebnisse sind in der Demo simuliert (aus der Basisquote). Nichts wird gemessen oder verschickt.",
};

/** Reasons marketing picks when it rejects, defers or changes a recommendation (written to the audit log). */
export const REASONS = {
  rejected: ["Passt nicht zum Kunden", "Kunde wurde kürzlich zu oft kontaktiert", "Produkt gerade nicht gewünscht", "Sonstiges"],
  review: ["Fachliche Klärung nötig", "Kampagnenfenster passt nicht", "Daten prüfen", "Sonstiges"],
  change: ["Anderes Produkt passt besser", "Kunde bevorzugt anderen Kanal", "Kampagnenziel", "Sonstiges"],
} as const;
export const REASON_OTHER = "Sonstiges";
