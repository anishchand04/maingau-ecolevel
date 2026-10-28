// Kommunikationsstil zur Laufzeit: vorberechnetes Profil (prepare_data.py) + Live-Einwilligung + Kundenwahl.
// The style never feeds the engine – it only changes how a text is phrased.
import { canProfile, type RawCustomer } from "@/lib/engine";
import type { StyleProfile } from "@/lib/data-types";
import { STANDARD_STYLE, STYLE_LABELS } from "@/config/style";

/** What the customer set under "So sprechen wir dich an" – overrides any derived value. */
export type StyleOverride = Partial<Pick<StyleProfile, "anrede" | "laenge" | "ton" | "fachwissen">>;

export function styleOf(c: RawCustomer, override?: StyleOverride): StyleProfile {
  // Consent is checked live: a withdrawal in the portal drops the derived profile at once.
  const base = canProfile(c) && c.style ? c.style : STANDARD_STYLE;
  if (!override || Object.keys(override).length === 0) return base;
  return { ...base, ...override, status: "vom Kunden geändert" };
}

/** "kurz · locker · per Du" */
export function styleSummary(s: StyleProfile): string {
  return [STYLE_LABELS.laenge[s.laenge], STYLE_LABELS.ton[s.ton], STYLE_LABELS.anrede[s.anrede]].join(" · ");
}

/** Du/Sie switch driven by the style profile. */
export const say = (s: StyleProfile, du: string, sie: string) => (s.anrede === "du" ? du : sie);
