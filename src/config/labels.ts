// UI-Texte für Status-Badges und Leerzustände (Master-Prompt §1: Texte nie hartcodiert im JSX).

/** Herkunft einer Zahl: jede Schätzung trägt einen Status. */
export const DATA_STATUS = {
  berechnet: { label: "berechnet", hint: "Direkt aus den Daten berechnet." },
  geschaetzt: { label: "geschätzt", hint: "Modellschätzung, nicht kalibriert." },
  simuliert: { label: "simuliert", hint: "Szenario unter den hinterlegten Annahmen." },
  annahme: { label: "Annahme", hint: "Festgelegter Wert aus der Konfiguration." },
} as const;
export type DataStatus = keyof typeof DATA_STATUS;

/** Engine-Entscheidung – nur im internen Bereich anzeigen. */
export const DECISION_STATUS = {
  SELL: { label: "SELL", hint: "Angebot zulässig" },
  CARE: { label: "CARE", hint: "Hilfe zuerst, kein Verkauf" },
  WAIT: { label: "WAIT", hint: "Gerade keine Ansprache" },
} as const;
export type DecisionStatus = keyof typeof DECISION_STATUS;

/** Ohne Du/Sie formuliert – Anrede kommt später aus dem Stilprofil. */
export const EMPTY_STATES = {
  anliegen: { title: "Keine offenen Anliegen", text: "Alles läuft rund. Bei Fragen sind wir da." },
  verlauf: { title: "Noch keine Verlaufsdaten", text: "Sobald Werte vorliegen, erscheint hier der Verlauf." },
  faelle: { title: "Keine offenen Fälle", text: "Der Eingang ist leer." },
  suche: { title: "Nichts gefunden", text: "Anderen Suchbegriff versuchen oder Funki fragen." },
} as const;
