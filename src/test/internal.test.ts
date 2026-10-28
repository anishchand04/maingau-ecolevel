// Internal views (Master-Prompt §7, §9): knobs can't loosen guardrails, service inbox by urgency without values,
// "Fall lösen" lifts the sales block, a confirmed cancellation does not.
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, recompute, guardrails, salesBlockers } from "@/lib/engine";
import { applyTuning } from "@/lib/tuning";
import { applyLive, type ServiceCase } from "@/lib/cases";
import { buildInbox } from "@/lib/inbox";
import { caseFacts } from "@/lib/caseSummary";
import { hasOpenProblem } from "@/lib/portal";
import { pgEnding, segments } from "@/lib/marketing";
import { CONTACT_MAX, clampTuning } from "@/config/tuning";

describe("Stellschrauben", () => {
  it("are clamped – no contact limit above the config maximum, no negative EV threshold", () => {
    const t = clampTuning({ maxContacts30d: 99, minEv: -50, batchMax: 10_000 });
    expect(t.maxContacts30d).toBe(CONTACT_MAX);
    expect(t.minEv).toBe(0);
    expect(t.batchMax).toBeLessThanOrEqual(200);
  });

  it("extreme values still produce 0 inadmissible SELL and only ever remove SELLs", () => {
    const base = new Set(PROFILES.filter((p) => p.nba.action === "SELL").map((p) => `${p.id}:${p.nba.productId}`));
    const extremes = [
      { minEv: 0, maxContacts30d: 99, paused: [] },
      { minEv: 200, maxContacts30d: 0, paused: ["P-EN-01", "P-EN-02"] },
      { minEv: -1000, maxContacts30d: -5, paused: [] },
    ];
    for (const t of extremes) {
      const tuned = applyTuning(PROFILES, t);
      for (const g of guardrails(tuned)) expect(g.violations, g.id).toEqual([]);
      const sells = tuned.filter((p) => p.nba.action === "SELL");
      for (const p of sells) {
        const orig = profileById(p.id)!;
        // a tuned SELL must have been an eligible candidate before – knobs never create offers
        expect(orig.recs.some((r) => r.productId === p.nba.productId && r.policy === "eligible")).toBe(true);
      }
      expect(sells.filter((p) => !base.has(`${p.id}:${p.nba.productId}`)).every((p) => profileById(p.id)!.nba.action === "SELL")).toBe(true);
    }
  });

  it("pausing an offer removes it everywhere", () => {
    const tuned = applyTuning(PROFILES, { paused: ["P-EN-01"] });
    expect(tuned.some((p) => p.nba.action === "SELL" && p.nba.productId === "P-EN-01")).toBe(false);
  });
});

describe("Service-Eingang", () => {
  const inbox = buildInbox(PROFILES, []);

  it("is sorted by urgency from the CARE rules, never by customer value", () => {
    for (let i = 1; i < inbox.length; i++) expect(inbox[i].priority).toBeGreaterThanOrEqual(inbox[i - 1].priority);
    const keys = new Set(inbox.flatMap((i) => Object.keys(i)));
    for (const k of ["clv", "churn", "dClv", "margin", "score"]) expect(keys.has(k)).toBe(false);
  });

  it("shows names, not bare ids, and proactive items only for customers without another case", () => {
    for (const i of inbox) expect(i.name).toMatch(/^\p{L}+ \p{Lu}\.$/u);
    const withCase = new Set(inbox.filter((i) => i.filter !== "proaktiv").map((i) => i.customerId));
    for (const i of inbox.filter((x) => x.filter === "proaktiv")) {
      expect(withCase.has(i.customerId)).toBe(false);
      expect(i.trigger).toBeTruthy();
      expect(i.suggestion).toBeTruthy();
    }
  });

  it("case facts for the summary contain no internal values", () => {
    for (const i of inbox.slice(0, 80)) {
      const facts = caseFacts(profileById(i.customerId)!, i).toLowerCase();
      for (const w of ["clv", "churn", "score", "cluster", "risk"]) expect(facts).not.toContain(w);
    }
  });

  it("'Fall lösen' lifts the sales block (MG-100009 charging complaint)", () => {
    const p = profileById("MG-100009")!;
    expect(p.nba.action).toBe("CARE");
    const keys = inbox.filter((i) => i.customerId === p.id).flatMap((i) => i.resolveKeys);
    const after = recompute(applyLive(p.raw, [], undefined, keys), p);
    expect(salesBlockers(after.raw)).toEqual([]);
    expect(hasOpenProblem(after)).toBe(false);
    expect(buildInbox([after], []).filter((i) => i.filter !== "proaktiv")).toEqual([]);
  });

  it("a confirmed cancellation keeps blocking sales", () => {
    const p = profileById("MG-100010")!;
    const k: ServiceCase = { id: "FK-X", customerId: p.id, kind: "kuendigung", title: "Kündigung Strom", detail: "", source: "funki", status: "solved", createdAt: "2026-10-01T09:00:00Z", contract: "electricity" };
    expect(recompute(applyLive(p.raw, [k]), p).nba.action).not.toBe("SELL");
  });

  it("a Funki handover lands in the inbox as 'Funki-Übergabe'", () => {
    const p = profileById("MG-100332")!;
    const k: ServiceCase = { id: "FK-H", customerId: p.id, kind: "mitarbeiter", title: "Übergabe von Funki", detail: "x", source: "uebergabe", status: "open", createdAt: "2026-10-01T09:00:00Z" };
    const item = buildInbox([recompute(applyLive(p.raw, [k]), p)], [k]).find((i) => i.caseId === "FK-H");
    expect(item?.filter).toBe("uebergabe");
    expect(item?.source).toBe("uebergabe");
  });
});

describe("Marketing-Übersicht", () => {
  it("price-guarantee buckets add up and segments cover every customer", () => {
    const pg = pgEnding(PROFILES);
    expect(pg.d30 + pg.d60 + pg.d90).toBe(pg.total);
    expect(segments(PROFILES).reduce((s, r) => s + r.size, 0)).toBe(PROFILES.length);
  });
});
