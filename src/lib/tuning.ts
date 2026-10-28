// Marketing knobs applied after the engine: they can only remove SELL candidates, never add one.
// A removed SELL falls back to the next candidate that still passes every rule, otherwise WAIT.
import { contactLimit, type Profile, type Recommendation } from "@/lib/engine";
import { TUNING_DEFAULT, clampTuning, type Tuning } from "@/config/tuning";

function blockedBy(p: Profile, r: Recommendation, t: Tuning): string | null {
  if (r.action !== "SELL") return null;
  if (t.paused.includes(r.productId)) return "TUNING_PAUSED";
  if (r.dClv < t.minEv) return "TUNING_MIN_EV";
  // never above the customer's own limit – min() keeps the stricter of both
  if (p.raw.contacts30d >= Math.min(t.maxContacts30d, contactLimit(p.raw))) return "TUNING_CONTACTS";
  return null;
}

export function tuneProfile(p: Profile, tuning: Tuning): Profile {
  if (p.nba.action !== "SELL") return p;
  const why = blockedBy(p, p.nba, tuning);
  if (!why) return p;
  const recs = p.recs.map((r) => {
    const code = r.policy === "eligible" ? blockedBy(p, r, tuning) : null;
    return code ? { ...r, policy: "blocked_fatigue" as const, policyCode: code, policyNote: code } : r;
  });
  const next = recs.find((r) => r.action === "SELL" && r.policy === "eligible" && r.dClv > 0);
  const nba: Recommendation = next ?? {
    ...p.nba, productId: "-", product: "No action", action: "WAIT", dClv: 0, pAccept: 0, channel: null,
    benefit: "", benefitDe: "", explanation: `Tuning: ${why}`, policy: "eligible", policyNote: why, policyCode: "WAIT",
  };
  return { ...p, recs, nba };
}

export function applyTuning(profiles: Profile[], t: Partial<Tuning> = TUNING_DEFAULT): Profile[] {
  const tuning = clampTuning(t);
  const isDefault = tuning.minEv === TUNING_DEFAULT.minEv && tuning.maxContacts30d === TUNING_DEFAULT.maxContacts30d && !tuning.paused.length;
  return isDefault ? profiles : profiles.map((p) => tuneProfile(p, tuning));
}
