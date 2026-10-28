// Manual change of the NBA by marketing. Only eligible SELL candidates and consented channels can be chosen,
// so a manual pick can never break a guardrail. If the pick is no longer allowed (consent withdrawn, tuning), the engine's choice stands.
import { allowedChannels, type Profile, type Recommendation } from "@/lib/engine";
import type { Pick } from "@/lib/store";

/** Products and channels marketing may switch to for this customer. */
export function pickOptions(p: Profile): { recs: Recommendation[]; channels: string[] } {
  return {
    recs: p.recs.filter((r) => r.action === "SELL" && r.policy === "eligible" && r.dClv > 0),
    channels: allowedChannels(p.raw),
  };
}

export function applyPicks(profiles: Profile[], picks: Record<string, Pick>): Profile[] {
  if (!Object.keys(picks).length) return profiles;
  return profiles.map((p) => {
    const k = picks[p.id];
    if (!k || p.nba.action !== "SELL") return p;
    const { recs, channels } = pickOptions(p);
    const rec = recs.find((r) => r.productId === k.productId);
    if (!rec) return p;
    const channel = k.channel && channels.includes(k.channel) ? k.channel : rec.channel;
    if (rec.productId === p.nba.productId && channel === p.nba.channel) return p;
    return { ...p, nba: { ...rec, channel, manual: { reason: k.reason, from: k.from } } };
  });
}
