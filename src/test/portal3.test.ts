// Portal additions (Master-Prompt §4, §4b, §9): Mein Eco-Zuhause, demo invoices, "Passt zu dir", move flow.
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, recompute, applyOverrides } from "@/lib/engine";
import { computeEcoHome, ownershipBonus, shownScore } from "@/lib/ecoHome";
import { invoicesOf, linesTotal } from "@/lib/invoices";
import { hasOpenProblem, passendCards } from "@/lib/portal";
import { flowCtx } from "@/lib/selfServiceRun";
import { styleOf } from "@/lib/style";
import { ECO_BASE, ECO_MAX, OWNERSHIP_BONUS, SELF_ACTIONS } from "@/config/ecoHome";
import { FLOWS } from "@/config/selfService";
import { INVOICE_TEXT } from "@/config/details";

describe("Mein Eco-Zuhause", () => {
  it("fair base for everyone, never above 100, ownership only a small bonus", () => {
    for (const p of PROFILES) {
      const r = computeEcoHome(p.raw, { self: [], meterReadings: 0, profiling: p.profiling });
      expect(r.score).toBeGreaterThanOrEqual(ECO_BASE);
      expect(r.score).toBeLessThanOrEqual(ECO_MAX);
      expect(ownershipBonus(p.raw)).toBeLessThanOrEqual(OWNERSHIP_BONUS.max);
      // owning things can never outweigh one concrete action
      expect(OWNERSHIP_BONUS.max).toBeLessThan(Math.max(...SELF_ACTIONS.map((a) => a.points)) * 2);
    }
  });

  it("without consent only self statements count", () => {
    const p = PROFILES.find((x) => !x.profiling && (x.raw.app || x.raw.charging))!;
    const r = computeEcoHome(p.raw, { self: [], meterReadings: 5, profiling: false });
    expect(r.score).toBe(ECO_BASE);
    expect(r.items.every((i) => i.source === "selbst")).toBe(true);
    const withSelf = computeEcoHome(p.raw, { self: ["e_rechnung", "waesche_30"], meterReadings: 0, profiling: false });
    expect(withSelf.score).toBe(ECO_BASE + 5 + 3);
  });

  it("never sinks: the shown score keeps the best value", () => {
    expect(shownScore(48, 60)).toBe(60);
    expect(shownScore(70, 60)).toBe(70);
  });

  it("always names the next concrete step below the top level", () => {
    const r = computeEcoHome(PROFILES[0].raw, { self: [], meterReadings: 0, profiling: true });
    expect(r.next?.step).toBeTruthy();
    expect(r.next?.missing).toBeGreaterThan(0);
  });
});

describe("demo invoices", () => {
  it("every amount is the sum of its lines, computed from contract data", () => {
    let n = 0;
    for (const p of PROFILES) for (const inv of invoicesOf(p.raw)) {
      expect(Number.isFinite(inv.amount)).toBe(true);
      expect(linesTotal(inv)).toBeCloseTo(inv.amount, 2);
      expect(inv.customerId).toBe(p.id);
      n++;
    }
    expect(n).toBeGreaterThan(700);
    expect(INVOICE_TEXT.demo).toMatch(/keine echte Rechnung/);
  });

  it("energy: consumption × price + base − installments", () => {
    const p = PROFILES.find((x) => x.raw.electricity)!;
    const e = p.raw.electricity!;
    const inv = invoicesOf(p.raw).find((i) => i.contract === "electricity")!;
    expect(inv.amount).toBeCloseTo(e.kwh * e.price + e.base * 12 - e.installment * 12, 1);
  });
});

describe("Passt zu dir", () => {
  it("nothing with an open problem or without portal consent; never more than 3", () => {
    for (const p of PROFILES) {
      const cards = passendCards(p);
      expect(cards.length).toBeLessThanOrEqual(3);
      if (hasOpenProblem(p) || p.raw.consent.portal_app_personalisation !== "granted") expect(cards).toEqual([]);
    }
  });

  it("'Kein Interesse' hides a card permanently", () => {
    const p = PROFILES.find((x) => passendCards(x).length > 0)!;
    const pid = passendCards(p)[0].rec.productId;
    const after = recompute(applyOverrides(p.raw, { feedback: { [pid]: "not_interested" } }), p);
    expect(passendCards(after).some((k) => k.rec.productId === pid)).toBe(false);
  });
});

describe("Umzug", () => {
  it("asks for meter reading and contracts, confirms with a summary", () => {
    const p = profileById("MG-100010")!;
    const ctx = flowCtx(p, styleOf(p.raw));
    const values = { ...FLOWS.umzug.defaults!(ctx), date: "2026-11-01", street: "Hauptstraße 5", zip: "63065", city: "Offenbach", meterOut: "45678" };
    expect(FLOWS.umzug.fields(ctx).map((f) => f.id)).toEqual(expect.arrayContaining(["meterOut", "take"]));
    expect(FLOWS.umzug.validate!(values, ctx)).toBeNull();
    expect(FLOWS.umzug.validate!({ ...values, meterOut: "12,5" }, ctx)).toBeTruthy();
    const r = FLOWS.umzug.run(values, ctx);
    expect(r.facts?.map(([l]) => l)).toEqual(["Neue Adresse", "Ab", "Kommt mit", "Zählerstand beim Auszug"]);
    expect(r.effects[0]).toMatchObject({ type: "case", kind: "umzug" });
  });
});
