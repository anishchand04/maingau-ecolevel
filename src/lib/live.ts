// Live profiles: the ONE shared app state that feeds both dashboards (Spec V2 §10/§11).
// A change in the customer portal (consent, feedback, contact frequency, voluntary answer) recomputes that
// customer immediately, so the marketing recommendation changes in the same browser state.
import { useEffect, useMemo } from "react";
import { PROFILES, applyOverrides, recompute, type Profile, type Overrides } from "@/lib/engine";
import { actions, useStore } from "@/lib/store";
import { activeRates } from "@/lib/learning";
import { reasonDe } from "@/lib/explain";
import { applyLive } from "@/lib/cases";
import { applyTuning } from "@/lib/tuning";
import { applyPicks } from "@/lib/picks";

export function useOverrides(): Record<string, Overrides> {
  const consent = useStore((s) => s.consent);
  const feedback = useStore((s) => s.feedback);
  const prefs = useStore((s) => s.prefs);
  const declared = useStore((s) => s.declared);
  return useMemo(() => {
    const o: Record<string, Overrides> = {};
    const get = (id: string) => (o[id] ??= {});
    for (const [id, c] of Object.entries(consent)) get(id).consent = c;
    for (const [key, f] of Object.entries(feedback)) {
      const [id, pid] = key.split(":");
      const x = get(id); x.feedback = { ...x.feedback, [pid]: f };
    }
    for (const [id, p] of Object.entries(prefs)) get(id).frequency = p.frequency;
    for (const [id, d] of Object.entries(declared ?? {})) get(id).declared = d;
    return o;
  }, [consent, feedback, prefs, declared]);
}

/** Last seen decision per customer – used to log every change of an engine decision once (old → new, with reason). */
const lastDecision = new Map<string, string>();
const decisionKey = (p: Profile) => `${p.nba.action}:${p.nba.productId}`;
function logChanges(profiles: Profile[]) {
  const changes: { customerId: string; detail: string }[] = [];
  for (const p of profiles) {
    const prev = lastDecision.get(p.id), now = decisionKey(p);
    if (prev !== undefined && prev !== now) changes.push({ customerId: p.id, detail: `${prev} → ${now}: ${reasonDe(p)}` });
    lastDecision.set(p.id, now);
  }
  if (changes.length) actions.logDecisionChanges(changes);
}

export function useProfiles(): Profile[] {
  const ov = useOverrides();
  const cases = useStore((s) => s.cases);
  const changes = useStore((s) => s.contractChanges);
  const resolved = useStore((s) => s.resolved);
  const tuning = useStore((s) => s.tuning);
  const picks = useStore((s) => s.picks);
  const versions = useStore((s) => s.learning.versions);
  const activeId = useStore((s) => s.learning.activeId);
  const profiles = useMemo(() => {
    const rates = activeId ? activeRates(versions, activeId) : undefined;
    const touched = new Set([...Object.keys(ov), ...cases.map((k) => k.customerId), ...Object.keys(changes), ...Object.keys(resolved)]);
    // an active learning version changes the rates for everyone → recompute all customers once per version
    const base = touched.size || rates ? PROFILES.map((p) => (touched.has(p.id) || rates
      ? recompute(applyOverrides(applyLive(p.raw, cases, changes[p.id], resolved[p.id]), ov[p.id] ?? {}), p, rates)
      : p)) : PROFILES;
    return applyPicks(applyTuning(base, tuning), picks);
  }, [ov, cases, changes, resolved, tuning, versions, activeId, picks]);
  useEffect(() => { logChanges(profiles); }, [profiles]);
  return profiles;
}

export function useProfile(id: string | undefined): Profile | undefined {
  const all = useProfiles();
  return useMemo(() => all.find((p) => p.id === id), [all, id]);
}
