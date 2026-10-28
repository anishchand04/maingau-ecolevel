// Kommunikationsstil: Anzeige-Texte und Standardwerte (Master-Prompt §6).
import type { StyleProfile } from "@/lib/data-types";

/** Ohne Profiling-Einwilligung: "Sie", neutral, keine Analyse. */
export const STANDARD_STYLE: StyleProfile = {
  anrede: "sie",
  laenge: "kurz",
  ton: "sachlich",
  fachwissen: "einfach",
  stimmung: "neutral",
  belege: [],
  quelle: "Keine Analyse – keine Einwilligung zur Profilbildung",
  status: "standard",
};

/** Kurzform für "So sprechen wir dich an: kurz · locker · per Du". */
export const STYLE_LABELS = {
  laenge: { kurz: "kurz", ausführlich: "ausführlich" },
  ton: { sachlich: "sachlich", herzlich: "locker" },
  anrede: { du: "per Du", sie: "per Sie" },
  fachwissen: { einfach: "einfach erklärt", fachlich: "fachlich" },
  stimmung: { zufrieden: "zufrieden", neutral: "neutral", verärgert: "verärgert" },
  status: { abgeleitet: "abgeleitet", standard: "Standard", "vom Kunden geändert": "vom Kunden geändert" },
} as const;
