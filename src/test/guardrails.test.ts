// Spec V2 §12 – guardrail, ranking and live-scenario tests over ALL customers.
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, guardrails, applyOverrides, recompute, salesBlockers, CLUSTER_STATS, canProfile } from "@/lib/engine";

describe("guardrails (all 750 customers)", () => {
  for (const g of guardrails(PROFILES)) {
    it(`${g.id}: ${g.label}`, () => expect(g.violations).toEqual([]));
  }
  it("every customer gets a need vector, cluster, EcoLevel and a reasoned SELL/CARE/WAIT", () => {
    expect(PROFILES).toHaveLength(750);
    for (const p of PROFILES) {
      expect(p.vector).toHaveLength(10);
      expect(p.cluster).toBeTruthy();
      expect([1, 2, 3, 4]).toContain(p.ecoLevel);
      expect(["SELL", "CARE", "WAIT"]).toContain(p.nba.action);
      expect(p.nba.explanation.length).toBeGreaterThan(10);
    }
  });
  it("clustering is reproducible and only uses customers with profiling consent", () => {
    expect(CLUSTER_STATS.k).toBeGreaterThanOrEqual(3);
    for (const p of PROFILES.filter((x) => !canProfile(x.raw))) expect(p.twins).toEqual([]);
  });
  it("never recommends a product the customer already holds", () => {
    for (const p of PROFILES) {
      if (p.nba.productId === "P-AS-01") expect(p.raw.autostrom).toBeFalsy();
      if (p.nba.productId === "P-MO-01") expect(p.raw.mobile).toBeFalsy();
      if (p.nba.productId === "P-EN-01") expect(p.raw.electricity).toBeFalsy();
    }
  });
});

describe("today's event stream is respected", () => {
  it("MG-100003 withdrew profiling consent today → no personalised SELL", () => {
    const p = profileById("MG-100003")!;
    expect(p.raw.consent.profiling_analytics).toBe("withdrawn");
    expect(p.nba.action).not.toBe("SELL");
  });
  it("MG-100510 cancelled today → no SELL", () => {
    expect(profileById("MG-100510")!.nba.action).not.toBe("SELL");
  });
  it("MG-100125 deregistered the gas meter today → heat-pump electricity", () => {
    expect(profileById("MG-100125")!.nba.productId).toBe("P-EN-03");
  });
});

describe("three live scenarios (Spec V2 §12)", () => {
  it("A: Autostrom without household electricity → StromAktiv", () => {
    const p = profileById("MG-100332")!;
    expect(p.raw.autostrom).toBeTruthy();
    expect(p.raw.electricity).toBeNull();
    expect(p.nba.productId).toBe("P-EN-01");
  });
  it("B: price guarantee ends → StromGarant retention", () => {
    expect(profileById("MG-100010")!.nba.productId).toBe("P-EN-02");
  });
  it("C: open charging problem blocks SELL → CARE", () => {
    const p = profileById("MG-100009")!;
    expect(salesBlockers(p.raw).length).toBeGreaterThan(0);
    expect(p.nba.action).toBe("CARE");
  });
});

describe("portal changes take effect immediately", () => {
  it("withdrawing profiling in the portal removes the personalised SELL", () => {
    const base = profileById("MG-100332")!;
    const after = recompute(applyOverrides(base.raw, { consent: { profiling_analytics: "withdrawn" } }), base);
    expect(after.nba.action).not.toBe("SELL");
  });
  it("'not interested' removes that offer", () => {
    const base = profileById("MG-100332")!;
    const after = recompute(applyOverrides(base.raw, { feedback: { [base.nba.productId]: "not_interested" } }), base);
    expect(after.nba.productId).not.toBe(base.nba.productId);
  });
  it("withdrawing all channel consents → no SELL", () => {
    const base = profileById("MG-100010")!;
    const off = Object.fromEntries(Object.keys(base.raw.consent).map((k) => [k, "withdrawn"]));
    expect(recompute(applyOverrides(base.raw, { consent: off }), base).nba.action).not.toBe("SELL");
  });
});

describe("unlockedByDeclared", () => {
  it("a move re-opens everything, a new EV only EV products, unchanged data nothing", async () => {
    const { unlockedByDeclared } = await import("@/lib/engine");
    expect(unlockedByDeclared(undefined, { moving: true })).toBe("all");
    expect(unlockedByDeclared(undefined, { ev: true })).toContain("P-SH-02");
    expect(unlockedByDeclared(undefined, { ev: true })).not.toContain("P-EN-03");
    expect(unlockedByDeclared({ ev: true }, { ev: true })).toEqual([]);
    expect(unlockedByDeclared(undefined, { heating: "heat_pump" })).toContain("P-EN-03");
  });
});
