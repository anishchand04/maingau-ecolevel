// Terminvorschläge mit Verfügbarkeits-Struktur. Gebuchte Zeiten werden nicht mehr vorgeschlagen, stattdessen die nächsten freien.
// Die Belegung kommt aus dem Store (andere Termine/Rückrufe) plus `demoBookings` als Platzhalter für einen echten Kalender.

export type SlotKind = "call" | "consult";

/** Wie viele Kunden dasselbe Zeitfenster belegen dürfen. */
export const SLOT_CAPACITY: Record<SlotKind, number> = { call: 3, consult: 1 };

const TIMES: Record<SlotKind, { label: string; hour: number }[]> = {
  call: [{ label: "9–12 Uhr", hour: 9 }, { label: "14–17 Uhr", hour: 14 }, { label: "16–18 Uhr", hour: 16 }],
  consult: [{ label: "10:00 Uhr", hour: 10 }, { label: "15:00 Uhr", hour: 15 }],
};

/** Demo: Positionen in der Zeitreihe, die „von anderen Kunden“ bereits voll belegt sind. */
const DEMO_FULL: Record<SlotKind, number[]> = { call: [0, 1], consult: [0, 1, 3] };

const dayLabel = (d: Date, now: Date) => {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5);
  if (isNear(diff)) return diff === 0 ? "heute" : "morgen";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
};
const isNear = (diff: number) => diff === 0 || diff === 1;

/** Alle denkbaren Zeitfenster der nächsten Werktage, ohne Rücksicht auf Belegung. Das Label ist zugleich der Schlüssel. */
export function slotSequence(kind: SlotKind, now = new Date(), horizonDays = 28): string[] {
  const out: string[] = [];
  for (let i = 0; i <= horizonDays; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    for (const t of TIMES[kind]) {
      if (i === 0 && (kind === "consult" || now.getHours() >= t.hour)) continue; // Beratung frühestens morgen, Rückruf nur vor Fensterbeginn
      out.push(kind === "consult" ? `${dayLabel(d, now)}, ${t.label}` : `${dayLabel(d, now)} ${t.label}`);
    }
  }
  return out;
}

/** Platzhalter für den Kalender des Teams: Zeitfenster, die bereits voll sind. Später durch echte Daten ersetzen. */
export function demoBookings(kind: SlotKind, now = new Date()): Record<string, number> {
  const seq = slotSequence(kind, now);
  return Object.fromEntries(DEMO_FULL[kind].filter((i) => seq[i]).map((i) => [seq[i], SLOT_CAPACITY[kind]]));
}

/** Zählt gebuchte Zeitfenster aus Freitextwerten wie „morgen 9–12 Uhr“. Werte wie „nach Absprache“ treffen kein Fenster und zählen nicht. */
export function countBookings(values: (string | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) if (v) out[v] = (out[v] ?? 0) + 1;
  return out;
}

export const mergeBookings = (...parts: Record<string, number>[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of parts) for (const [k, n] of Object.entries(p)) out[k] = (out[k] ?? 0) + n;
  return out;
}

/** Die nächsten freien Zeitfenster; volle werden übersprungen. */
export function freeSlots(kind: SlotKind, booked: Record<string, number>, opts: { limit?: number; now?: Date } = {}): string[] {
  const cap = SLOT_CAPACITY[kind];
  return slotSequence(kind, opts.now).filter((s) => (booked[s] ?? 0) < cap).slice(0, opts.limit ?? 30);
}

export const isSlotFree = (kind: SlotKind, booked: Record<string, number>, slot: string, now?: Date) => freeSlots(kind, booked, { now, limit: 1000 }).includes(slot);

/** Für Texte außerhalb von React (Chat-Flow): nächste freie Rückruf-Fenster ohne Store-Belegung. */
export const nextFreeCallSlots = (n: number, extraBooked: Record<string, number> = {}) =>
  freeSlots("call", mergeBookings(demoBookings("call"), extraBooked), { limit: n });
