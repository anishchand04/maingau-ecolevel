// Funki chat + self-service (Master-Prompt §5, §9): deterministic flows, cancellation in ≤ 3 clicks,
// AI context without internal scores, offline fallback, tips only when appropriate.
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, recompute, applyOverrides, salesBlockers } from "@/lib/engine";
import { applyLive, type ServiceCase } from "@/lib/cases";
import { buildChatContext, fallbackAnswer, parseActionTag, pickTip } from "@/lib/chat";
import { flowCtx } from "@/lib/selfServiceRun";
import { hasOpenProblem, helpReasons } from "@/lib/portal";
import { styleOf } from "@/lib/style";
import { FLOWS, ibanValid, contractOptions, type Values } from "@/config/selfService";
import { TIPS } from "@/config/tips";

const ctxOf = (id: string) => { const p = profileById(id)!; return flowCtx(p, styleOf(p.raw)); };
const kase = (customerId: string, kind: ServiceCase["kind"], contract?: ServiceCase["contract"]): ServiceCase => ({
  id: `FK-T-${kind}`, customerId, kind, title: kind, detail: kind, source: "funki", status: "open", createdAt: "2026-10-01T10:00:00Z", contract,
});
const withCase = (id: string, k: ServiceCase) => { const p = profileById(id)!; return recompute(applyLive(p.raw, [k]), p); };

describe("cancellation (§ 312k BGB)", () => {
  it("can be completed in at most 3 clicks for every customer with a contract, reason optional", () => {
    let checked = 0;
    for (const p of PROFILES) {
      if (!contractOptions(p).length) continue;
      const ctx = flowCtx(p, styleOf(p.raw));
      const flow = FLOWS.kuendigung;
      expect(flow.unavailable?.(ctx)).toBeNull();
      const values: Values = { ...flow.defaults?.(ctx) };
      // every field is preselected → click 1: open the action, click 2: "Kündigung absenden"
      for (const f of flow.fields(ctx)) expect(values[f.id]).toBeTruthy();
      expect(flow.validate?.(values, ctx) ?? null).toBeNull();
      const r = flow.run(values, ctx);
      const k = r.effects.find((e) => e.type === "case");
      expect(k && k.type === "case" && k.kind).toBe("kuendigung");
      expect(k && k.type === "case" && k.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.facts?.map(([l]) => l)).toEqual(["Eingegangen am", "Kündigungsfrist", "Vertrag endet am"]);
      checked++;
    }
    expect(checked).toBeGreaterThan(700);
  });

  it("switches the engine to CARE and blocks every sale – energy and other contracts", () => {
    const energy = withCase("MG-100010", kase("MG-100010", "kuendigung", "electricity"));
    expect(energy.nba.action).toBe("CARE");
    expect(helpReasons(energy)).toContain("cancel");
    const other = withCase("MG-100332", kase("MG-100332", "kuendigung", "autostrom"));
    expect(other.nba.action).not.toBe("SELL");
    expect(hasOpenProblem(other)).toBe(true);
  });
});

describe("self-service effects reach the engine", () => {
  it("a reported fault blocks selling (CARE)", () => {
    const sells = PROFILES.filter((p) => p.nba.action === "SELL").slice(0, 25);
    for (const p of sells) {
      const after = withCase(p.id, kase(p.id, "stoerung"));
      expect(after.nba.action).toBe("CARE");
      expect(salesBlockers(after.raw).length).toBeGreaterThan(0);
    }
  });
  it("a solved case lifts the block again", () => {
    const p = profileById("MG-100332")!;
    const solved = recompute(applyLive(p.raw, [{ ...kase(p.id, "stoerung"), status: "solved" }]), p);
    expect(solved.nba.action).toBe(p.nba.action);
  });
  it("'Werbung abbestellt per Chat' removes every SELL", () => {
    const ctx = ctxOf("MG-100010");
    const r = FLOWS.einwilligungen.run({ choice: "keine_werbung" }, ctx);
    const e = r.effects[0];
    expect(e.type).toBe("consents");
    const p = profileById("MG-100010")!;
    const after = recompute(applyOverrides(p.raw, { consent: e.type === "consents" ? e.consents : {} }), p);
    expect(after.nba.action).not.toBe("SELL");
  });
});

describe("flow validation", () => {
  it("meter reading: integers only, no future date", () => {
    const ctx = ctxOf("MG-100010");
    const v = FLOWS.zaehlerstand.validate!;
    expect(v({ contract: "electricity", value: "12,5", date: "2026-10-01" }, ctx)).toBeTruthy();
    expect(v({ contract: "electricity", value: "45678", date: "2027-01-01" }, ctx)).toBeTruthy();
    expect(v({ contract: "electricity", value: "45678", date: "2026-10-01" }, ctx)).toBeNull();
  });
  it("installment: rejects amounts far below what the consumption needs", () => {
    const ctx = ctxOf("MG-100010");
    expect(FLOWS.abschlag.validate!({ amount: "10" }, ctx)).toBeTruthy();
    expect(FLOWS.abschlag.validate!(FLOWS.abschlag.defaults!(ctx), ctx)).toBeNull();
  });
  it("IBAN checksum", () => {
    expect(ibanValid("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanValid("DE89370400440532013001")).toBe(false);
  });
  it("price-guarantee extension only when the engine allows the candidate", () => {
    for (const p of PROFILES.slice(0, 200)) {
      const ok = FLOWS.preisgarantie.unavailable!(flowCtx(p, styleOf(p.raw))) === null;
      expect(ok).toBe(p.recs.some((r) => r.productId === "P-EN-02" && r.policy === "eligible") && !!p.raw.electricity);
    }
  });
});

describe("AI context and answers", () => {
  it("chat context never contains CLV, churn, cluster, scores or risk values", () => {
    for (const p of PROFILES) {
      const ctx = buildChatContext(p, styleOf(p.raw), { recommendation: null, cases: [] }).toLowerCase();
      for (const w of ["clv", "churn", "cluster", "score", "risk", "risiko", "potential", "twin"]) expect(ctx).not.toContain(w);
      // independence: changing internal values must not change a single character of the context
      const shifted = { ...p, raw: { ...p.raw, clv: p.raw.clv + 12345, churn: 0.99, margin: 1, cts: 1 }, cluster: "X", coverage: 0.01 };
      expect(buildChatContext(shifted, styleOf(p.raw), { recommendation: null, cases: [] }).toLowerCase()).toBe(ctx);
    }
  });
  it("action tags are whitelisted and stripped", () => {
    expect(parseActionTag("Gern. [[aktion:kuendigung]]")).toEqual({ text: "Gern.", action: "kuendigung" });
    expect(parseActionTag("Okay [[aktion:geld_ueberweisen]]")).toEqual({ text: "Okay", action: undefined });
  });
  it("offline fallback finds intents and admits what it does not know", () => {
    const p = profileById("MG-100010")!, s = styleOf(p.raw);
    expect(fallbackAnswer("Ich will kündigen", p, s, []).action).toBe("kuendigung");
    expect(fallbackAnswer("Wann endet meine Preisgarantie?", p, s, []).text).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    const none = fallbackAnswer("Wie wird das Wetter morgen?", p, s, []);
    expect(none.text).toContain("weiß ich nicht sicher");
    expect(none.action).toBe("rueckruf");
  });
});

describe("Funki tips", () => {
  it("no tip while a problem is open, none when switched off", () => {
    for (const p of PROFILES.filter(hasOpenProblem)) expect(pickTip(p, { recommendationVisible: true, tipsOff: false })).toBeNull();
    expect(pickTip(profileById("MG-100332")!, { recommendationVisible: true, tipsOff: true })).toBeNull();
  });
  it("product tips only with a visible (approved + consented) recommendation, no euro promises", () => {
    for (const p of PROFILES) {
      const t = pickTip(p, { recommendationVisible: false, tipsOff: false });
      if (t) expect(t.category).not.toBe("Produkt");
    }
    for (const t of TIPS) expect(`${t.du} ${t.sie}`).not.toMatch(/€|euro/i);
  });
});
