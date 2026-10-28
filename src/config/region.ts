// Region & Wetter (Master-Prompt §2, §6b). Werte aus src/data/weather.json (einmalig per scripts/fetch_weather.py
// geladen, Open-Meteo, 01.10.2025–30.09.2026). Die App ruft zur Laufzeit nie eine Wetter-API auf.
// Region ist zusätzliche Evidenz: sie darf Relevanz nur erhöhen – nie Angebote, Service-Priorität oder
// Konditionen verschlechtern oder Kunden ausschließen.

export type Level = "hoch" | "mittel" | "niedrig";

/** Annahme: Klassengrenzen für Globalstrahlung (kWh/m² im Jahr). Basis für die Sonnenklasse. */
export const SUN_THRESHOLDS = { hoch: 1350, mittel: 1250 };
/** Annahme: Klassengrenzen für Heizgradtage (Gradtagzahl G20/15). */
export const HEAT_THRESHOLDS = { hoch: 3300, mittel: 3000 };

export const classify = (v: number, t: { hoch: number; mittel: number }): Level => (v >= t.hoch ? "hoch" : v >= t.mittel ? "mittel" : "niedrig");

/** Bonus auf einen Bedarf – nur, wenn der Bedarf schon andere Evidenz hat (Region ist nie alleiniger Grund). */
export const REGION_BONUS = {
  sun: { need: "N06", points: 10, level: "hoch" as Level },
  heat: { need: "N01", points: 8, level: "hoch" as Level },
};

/** Gewicht der Region in der Twin-Ähnlichkeit (one-hot Sonne + Heizbedarf). Clustering bleibt unberührt. */
export const TWIN_REGION_WEIGHT = 0.25;

export const REGION_TEXT = {
  note: "Durchschnitt der Stadt – sagt nichts über das eigene Dach",
  sunEvidence: "Region mit viel Sonne (Durchschnitt {city})",
  heatEvidence: "Region mit hohem Heizbedarf (Durchschnitt {city})",
  sun: { hoch: "viel Sonne", mittel: "mittlere Sonne", niedrig: "wenig Sonne" } as Record<Level, string>,
  heat: { hoch: "hoher Heizbedarf", mittel: "mittlerer Heizbedarf", niedrig: "niedriger Heizbedarf" } as Record<Level, string>,
  radiation: "Globalstrahlung {v} kWh/m² im Jahr",
  hdd: "{v} Heizgradtage",
};
