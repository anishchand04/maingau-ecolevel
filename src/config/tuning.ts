// Stellschrauben im Marketing (Master-Prompt §7). Sie dürfen Regeln nur verschärfen, nie Guardrails aufweichen:
// kein Kontaktlimit über dem Config-Maximum, keine Ansprache ohne Einwilligung (das prüft weiterhin die Engine).
import { THRESHOLDS } from "@/config/thresholds";

export type Tuning = {
  /** Mindest-Erwartungswert (ΔCLV in €) für eine Ansprache */
  minEv: number;
  /** max. Marketing-Kontakte pro 30 Tage – wird nie über das Kundenlimit hinaus angewendet */
  maxContacts30d: number;
  /** pausierte Angebote (product ids) */
  paused: string[];
  /** max. Empfänger pro Sammelfreigabe */
  batchMax: number;
};

export const CONTACT_MAX = Math.max(...Object.values(THRESHOLDS.contactLimit30d));

export const TUNING_DEFAULT: Tuning = { minEv: 0, maxContacts30d: CONTACT_MAX, paused: [], batchMax: 50 };

export const TUNING_LIMITS = {
  minEv: { min: 0, max: 200, step: 5 },
  maxContacts30d: { min: 0, max: CONTACT_MAX, step: 1 },
  batchMax: { min: 1, max: 200, step: 1 },
};

/** Clamp to the allowed range – the UI can never loosen a guardrail. */
export function clampTuning(t: Partial<Tuning>): Tuning {
  const c = (v: number | undefined, d: number, l: { min: number; max: number }) => Math.min(l.max, Math.max(l.min, Number.isFinite(v) ? (v as number) : d));
  return {
    minEv: c(t.minEv, TUNING_DEFAULT.minEv, TUNING_LIMITS.minEv),
    maxContacts30d: Math.round(c(t.maxContacts30d, TUNING_DEFAULT.maxContacts30d, TUNING_LIMITS.maxContacts30d)),
    paused: Array.isArray(t.paused) ? [...new Set(t.paused)] : [],
    batchMax: Math.round(c(t.batchMax, TUNING_DEFAULT.batchMax, TUNING_LIMITS.batchMax)),
  };
}

export const TUNING_TEXT = {
  title: "Stellschrauben",
  intro: "Verschärfen die Regeln für alle Kunden sofort. Guardrails bleiben unberührt.",
  minEv: "Mindest-Erwartungswert je Ansprache",
  maxContacts: "Max. Kontakte pro 30 Tage",
  maxContactsHint: "Nie höher als das Limit, das der Kunde gewählt hat.",
  paused: "Angebote pausieren",
  batchMax: "Max. Empfänger pro Sammelfreigabe",
  reset: "Zurücksetzen",
};
