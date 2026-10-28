// Learning loop: holdout, uplift, proposed rates, versions. Learning changes estimates only – never a rule or guardrail.
import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { BASE_RATES, PROFILES, guardrails, recompute, salesBlockers, type Rates } from "@/lib/engine";
import { LEARNING, THRESHOLDS } from "@/config/thresholds";
import { OBSERVED_NOTE } from "@/config/internal";
import { actions, getState } from "@/lib/store";
import { recommendationState } from "@/lib/portal";
import { Learning } from "@/components/internal/Learning";
import { activeRates, baseRate, contradicted, holdoutGroup, isHoldout, proposeRates, repeatsRolledBack, simTruth, upliftOf, upliftByOffer, versionLabel, wilson, type LearnVersion, type Outcome } from "@/lib/learning";

const out = (i: number, group: Outcome["group"], converted: boolean | null, offer = "P-MO-01", channel = "portal_popup"): Outcome =>
  ({ id: `${i}:${offer}:${group}`, customerId: `MG-${i}`, offer, channel, version: "v", group, at: "2026-10-01", converted, response: "sent" });
const many = (n: number, conv: number, group: Outcome["group"], offer?: string, channel?: string) =>
  Array.from({ length: n }, (_, i) => out(i + (group === "control" ? 10000 : 0), group, i < conv, offer, channel));

describe("random holdout", () => {
  it("is deterministic and close to the chosen share", () => {
    const ids = PROFILES.map((p) => p.id);
    const a = ids.map((id) => holdoutGroup(id, 20)), b = ids.map((id) => holdoutGroup(id, 20));
    expect(a).toEqual(b);
    const share = a.filter((g) => g === "control").length / ids.length;
    expect(share).toBeGreaterThan(0.12); expect(share).toBeLessThan(0.28);
    expect(ids.every((id) => holdoutGroup(id, 0) === "treated")).toBe(true);
  });
  it("never touches CARE, WAIT, blocked or non-eligible customers – even at 100 %", () => {
    const held = PROFILES.filter((p) => isHoldout(p, 100));
    expect(held.length).toBeGreaterThan(0);
    for (const p of held) {
      expect(p.nba.action).toBe("SELL");
      expect(p.nba.policy).toBe("eligible");
      expect(salesBlockers(p.raw)).toEqual([]);
    }
    expect(PROFILES.filter((p) => p.nba.action !== "SELL").some((p) => isHoldout(p, 100))).toBe(false);
  });
  it("a held-out customer sees no recommendation in the portal", () => {
    const p = PROFILES.find((x) => recommendationState(x, () => "approved") === "visible")!;
    expect(recommendationState(p, () => "held_out")).toBe("none");
  });
});

describe("uplift", () => {
  it("computes the difference and an interval that contains it", () => {
    const u = upliftOf({ n: 200, conversions: 30, rate: 0.15 }, { n: 100, conversions: 10, rate: 0.1 });
    expect(u.uplift).toBeCloseTo(0.05, 6);
    expect(u.ci[0]).toBeLessThan(0.05); expect(u.ci[1]).toBeGreaterThan(0.05);
    expect(u.enough).toBe(true);
  });
  it("makes no effect statement for a small control group", () => {
    expect(upliftOf({ n: 500, conversions: 60, rate: 0.12 }, { n: 40, conversions: 5, rate: 0.125 }).enough).toBe(false);
    expect(upliftOf({ n: 500, conversions: 60, rate: 0.12 }, { n: 300, conversions: 4, rate: 4 / 300 }).enough).toBe(false);
  });
  it("ignores open results", () => {
    const rows = upliftByOffer([...many(10, 2, "treated"), out(99, "treated", null), ...many(5, 1, "control")]);
    expect(rows[0].treated.n).toBe(10);
  });
  it("wilson stays inside [0, 1]", () => {
    for (const [x, n] of [[0, 5], [5, 5], [3, 50]]) { const [l, u] = wilson(x, n); expect(l).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
  });
});

describe("proposed rates", () => {
  it("leaves cells below the minimum untouched", () => {
    const r = proposeRates(many(LEARNING.minCellN - 1, 0, "treated"), BASE_RATES);
    expect(r.changes).toEqual([]);
    expect(r.rates.acceptance).toEqual(BASE_RATES.acceptance);
  });
  it("moves a rate towards the data, but by at most the allowed share", () => {
    const prior = BASE_RATES.acceptance["P-MO-01"].portal_popup;
    const down = proposeRates(many(200, 0, "treated"), BASE_RATES).changes[0];
    expect(down.to).toBeLessThan(prior);
    expect(down.to).toBeGreaterThanOrEqual(prior * (1 - LEARNING.maxRelChange) - 1e-9);
    const up = proposeRates(many(200, 200, "treated"), BASE_RATES).changes[0];
    expect(up.to).toBeGreaterThan(prior);
    expect(up.to).toBeLessThanOrEqual(Math.min(THRESHOLDS.maxPAccept, prior * (1 + LEARNING.maxRelChange)) + 1e-9);
  });
  it("does not mutate the current rates and ignores control and open rows", () => {
    const before = JSON.stringify(BASE_RATES);
    const r = proposeRates([...many(100, 0, "control"), ...many(50, 0, "treated").map((o) => ({ ...o, converted: null }))], BASE_RATES);
    expect(r.changes).toEqual([]);
    expect(JSON.stringify(BASE_RATES)).toBe(before);
  });
});

describe("guardrails under learned rates", () => {
  it("extreme rates still give 0 violations and never un-block a customer", () => {
    const high: Rates = { offerRate: Object.fromEntries(Object.keys(BASE_RATES.offerRate).map((k) => [k, 0.6])), acceptance: Object.fromEntries(Object.keys(BASE_RATES.acceptance).map((k) => [k, { app_push: 0.6, newsletter_email: 0.6, outbound_call: 0.6, portal_popup: 0.6, sms: 0.6 }])) };
    const learned = PROFILES.map((p) => recompute(p.raw, p, high));
    expect(guardrails(learned).flatMap((g) => g.violations)).toEqual([]);
    for (const p of learned) if (salesBlockers(p.raw).length) expect(p.nba.action).not.toBe("SELL");
  });
});

describe("versions: propose, approve, roll back", () => {
  beforeEach(() => actions.reset());
  it("changes nothing until approved, then rolls back exactly", () => {
    actions.setHoldout(10);
    for (let i = 0; i < 60; i++) actions.recordOutcome({ customerId: `MG-T${i}`, offer: "P-MO-01", channel: "portal_popup", group: "treated" });
    expect(getState().learning.outcomes).toHaveLength(60);
    actions.recordOutcome({ customerId: "MG-T0", offer: "P-MO-01", channel: "portal_popup", group: "treated" }); // same customer/offer/version: no duplicate
    expect(getState().learning.outcomes).toHaveLength(60);

    actions.simulateOutcomes();
    expect(getState().learning.outcomes.every((o) => o.converted !== null && o.simulated)).toBe(true);

    const id = actions.proposeVersion();
    expect(id).toBe("L1");
    const L = getState().learning;
    expect(L.versions[0].status).toBe("proposed");
    expect(L.activeId).toBeNull();
    expect(activeRates(L.versions, L.activeId)).toBe(BASE_RATES); // not active yet

    actions.activateVersion("L1");
    expect(getState().learning.activeId).toBe("L1");
    expect(versionLabel(getState().learning.activeId)).toContain("+L1");
    expect(activeRates(getState().learning.versions, "L1").acceptance["P-MO-01"].portal_popup).not.toBe(BASE_RATES.acceptance["P-MO-01"].portal_popup);

    actions.rollbackVersion();
    expect(getState().learning.activeId).toBeNull();
    const p = PROFILES.find((x) => x.raw.mobile === null && x.nba.action === "SELL") ?? PROFILES[0];
    const again = recompute(p.raw, p, activeRates(getState().learning.versions, getState().learning.activeId));
    expect(again.nba.productId).toBe(p.nba.productId);
    expect(again.nba.dClv).toBeCloseTo(p.nba.dClv, 6);

    const audit = getState().audit.map((a) => a.action);
    for (const a of ["Holdout geändert", "Ergebnisse simuliert", "Lernvorschlag erstellt", "Lernversion freigegeben", "Lernversion zurückgerollt"]) expect(audit).toContain(a);
  });
  it("a customer's own 'not interested' closes the open result as no conversion", () => {
    actions.recordOutcome({ customerId: "MG-X", offer: "P-MO-01", channel: "portal_popup", group: "treated" });
    actions.feedback("MG-X", "P-MO-01", "not_interested");
    expect(getState().learning.outcomes[0]).toMatchObject({ converted: false, response: "dismissed" });
  });
});

const candidates = () => PROFILES.filter((p) => p.nba.action === "SELL" && p.nba.policy === "eligible" && p.nba.dClv > 0 && p.nba.channel)
  .map((p) => ({ customerId: p.id, offer: p.nba.productId, channel: p.nba.channel! }));

describe("automatic learning run", () => {
  beforeEach(() => actions.reset());
  it("learns without any click: versions appear, the curve fills, the engine moves towards the real rates", () => {
    expect(getState().learning.auto).toBe(true);
    const all = candidates();
    expect(all.length).toBeGreaterThan(100);
    for (let i = 0; i < all.length; i += LEARNING.autoBatch) actions.learnTick(all.slice(i, i + LEARNING.autoBatch), true);
    const L = getState().learning;
    expect(L.outcomes.length).toBe(all.length);
    expect(L.outcomes.every((o) => o.converted !== null && o.simulated)).toBe(true);
    expect(L.outcomes.some((o) => o.group === "control")).toBe(true);
    expect(L.history.length).toBeGreaterThan(5);
    expect(L.versions.length).toBeGreaterThan(0);
    expect(L.versions.every((v) => v.auto)).toBe(true);
    expect(L.activeId).not.toBeNull();
    // closer to the (demo) truth than the base rates for every cell that was changed and has data
    const rates = activeRates(L.versions, L.activeId);
    const changed = L.versions.flatMap((v) => v.changes).filter((c) => c.n >= 40);
    expect(changed.length).toBeGreaterThan(0);
    const errNow = changed.reduce((s, c) => s + Math.abs((rates.acceptance[c.offer]?.[c.channel] ?? 0) - simTruth(c.offer, c.channel)), 0);
    const errBase = changed.reduce((s, c) => s + Math.abs(baseRate(c.offer, c.channel) - simTruth(c.offer, c.channel)), 0);
    expect(errNow).toBeLessThan(errBase);
    const audit = getState().audit.map((a) => a.action);
    expect(audit).toContain("Lernversion automatisch aktiviert");
    // many customers must not flood the log with one line each
    expect(getState().audit.length).toBeLessThan(80);
  });
  it("keeps every guardrail at 0 violations with the learned rates", () => {
    const all = candidates();
    for (let i = 0; i < all.length; i += LEARNING.autoBatch) actions.learnTick(all.slice(i, i + LEARNING.autoBatch), true);
    const L = getState().learning;
    const rates = activeRates(L.versions, L.activeId);
    expect(guardrails(PROFILES.map((p) => recompute(p.raw, p, rates))).flatMap((g) => g.violations)).toEqual([]);
  });
  it("does nothing in manual mode except collect results", () => {
    actions.setAuto(false);
    const all = candidates();
    for (let i = 0; i < all.length; i += LEARNING.autoBatch) actions.learnTick(all.slice(i, i + LEARNING.autoBatch), false);
    expect(getState().learning.versions).toEqual([]);
    expect(getState().learning.activeId).toBeNull();
  });
  it("a customer is never contacted twice for the same offer", () => {
    const b = candidates().slice(0, 5);
    actions.learnTick(b, true); actions.learnTick(b, true);
    expect(getState().learning.outcomes).toHaveLength(5);
  });
  it("reset returns to the base engine but keeps the auto setting", () => {
    const all = candidates();
    for (let i = 0; i < all.length; i += LEARNING.autoBatch) actions.learnTick(all.slice(i, i + LEARNING.autoBatch), true);
    actions.resetLearning();
    const L = getState().learning;
    expect([L.outcomes.length, L.versions.length, L.history.length, L.activeId]).toEqual([0, 0, 0, null]);
    expect(L.auto).toBe(true);
  });
});

describe("auto-rollback", () => {
  const version: LearnVersion = { id: "L1", at: "x", parent: null, status: "active", rates: BASE_RATES, note: "", changes: [{ offer: "P-MO-01", channel: "portal_popup", from: 0.1, to: 0.13, n: 40, conversions: 6 }] };
  const under = (conv: number, n: number): Outcome[] => Array.from({ length: n }, (_, i) => ({ ...out(i, "treated", i < conv), version: "ecolevel-nba-v2.0+L1" }));
  it("triggers when the results contradict a rate that went up, and not otherwise", () => {
    expect(contradicted(under(0, 60), version)).toEqual({ offer: "P-MO-01", channel: "portal_popup" });
    expect(contradicted(under(8, 60), version)).toBeNull();
    expect(contradicted(under(0, 5), version)).toBeNull(); // too few results
    expect(contradicted(under(0, 60), undefined)).toBeNull();
  });
  it("a proposal identical to a rolled-back version is not repeated", () => {
    expect(repeatsRolledBack(version.changes, [{ ...version, status: "rolled_back" }])).toBe(true);
    expect(repeatsRolledBack(version.changes, [version])).toBe(false);
  });
});

describe("Lernen view", () => {
  it("labels the historical comparison as observed, and says so when data is missing (manual mode)", () => {
    actions.reset(); actions.setAuto(false);
    const el = document.createElement("div");
    document.body.appendChild(el);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(el);
    act(() => root.render(createElement(Learning)));
    expect(el.textContent).toContain(OBSERVED_NOTE);
    expect(el.textContent).toContain("Noch zu wenig Daten");
    act(() => root.unmount());
  });
  it("runs by itself while open: customers get processed and a version appears", () => {
    vi.useFakeTimers();
    class RO { observe() {} unobserve() {} disconnect() {} }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = RO;
    actions.reset();
    const el = document.createElement("div");
    document.body.appendChild(el);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(el);
    act(() => root.render(createElement(Learning)));
    expect(getState().learning.outcomes.length).toBe(0);
    act(() => { vi.advanceTimersByTime(LEARNING.autoTickMs * 3); });
    expect(getState().learning.outcomes.length).toBe(LEARNING.autoBatch * 3);
    act(() => { vi.advanceTimersByTime(LEARNING.autoTickMs * 80); });
    expect(getState().learning.versions.length).toBeGreaterThan(0);
    expect(el.textContent).toContain("Wie nah liegt die Engine an der Realität?");
    act(() => root.unmount());
    vi.useRealTimers();
  });
});
