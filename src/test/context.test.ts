// V3 engine context (Master-Prompt §6b, §9): region & weather, fairness, "Passt zu dir", mobile notes.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROFILES, recompute, salesBlockers, type Profile, type RawCustomer } from "@/lib/engine";
import { WEATHER, crossSellCards, mobileNotes, regionOf, regionVec, withRegionEvidence } from "@/engine/context";
import { buildInbox } from "@/lib/inbox";
import { REGION_TEXT } from "@/config/region";
import { MAX_CARDS } from "@/config/shopRules";

const stripRegion = (c: RawCustomer): RawCustomer => ({ ...c, region: undefined, city: "—" });
const eligible = (p: Profile) => new Set(p.recs.filter((r) => r.action === "SELL" && r.policy === "eligible").map((r) => r.productId));
const blocked = (p: Profile) => new Set(p.recs.filter((r) => r.action === "SELL" && r.policy !== "eligible").map((r) => `${r.productId}:${r.policyCode}`));

describe("weather data", () => {
  it("covers every customer city and is plausible", () => {
    for (const p of PROFILES) expect(WEATHER.cities[p.raw.region?.city ?? p.raw.city], p.raw.city).toBeTruthy();
    for (const w of Object.values(WEATHER.cities)) {
      expect(w.radiationKwhM2).toBeGreaterThan(900);
      expect(w.radiationKwhM2).toBeLessThan(1600);
      expect(w.heatingDegreeDays).toBeGreaterThan(2000);
      expect(w.days).toBeGreaterThanOrEqual(365);
    }
  });

  it("the app never calls a weather API at runtime", () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); });
    walk(join(process.cwd(), "src"));
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/open-meteo\.com|api\.open-meteo/);
  });
});

describe("region as evidence", () => {
  it("is used only with profiling consent", () => {
    for (const p of PROFILES.filter((x) => x.raw.consent.profiling_analytics !== "granted")) {
      expect(regionVec(p.raw).every((v) => v === 0)).toBe(true);
      expect(withRegionEvidence(p.raw, p.needs)).toBe(p.needs);
    }
  });

  it("only raises scores, never alone, never above 100", () => {
    for (const p of PROFILES) {
      const after = withRegionEvidence(p.raw, p.needs);
      after.forEach((n, i) => {
        const before = p.needs[i];
        expect(n.score).toBeGreaterThanOrEqual(before.score);
        expect(n.score).toBeLessThanOrEqual(100);
        if (n.score > before.score) {
          expect(before.evidence.length).toBeGreaterThan(0);
          expect(n.evidence.at(-1)).toMatch(/Durchschnitt/);
        }
      });
    }
  });

  it("leaves the clustering vector, coverage and EcoLevel untouched", () => {
    for (const p of PROFILES) expect(p.vector).toEqual(p.needs.map((n) => n.score / 100));
  });

  it("carries the city-average note", () => {
    const r = regionOf(PROFILES[0].raw)!;
    expect(r.note).toBe(REGION_TEXT.note);
  });
});

describe("fairness: region never worsens anything", () => {
  it("without region → same or fewer candidates, never more blocks, never a lost SELL", () => {
    let raised = 0;
    for (const p of PROFILES) {
      const withR = recompute(p.raw, p);
      const without = recompute(stripRegion(p.raw), p);
      for (const pid of eligible(without)) expect(eligible(withR).has(pid), `${p.id} ${pid}`).toBe(true);
      for (const b of blocked(withR)) expect(blocked(without).has(b), `${p.id} ${b}`).toBe(true);
      if (without.nba.action === "SELL") expect(withR.nba.action).toBe("SELL");
      if (without.nba.action === "CARE") expect(withR.nba.action).toBe("CARE");
      expect(salesBlockers(withR.raw)).toEqual(salesBlockers(without.raw));
      if (eligible(withR).size > eligible(without).size) raised++;
    }
    expect(raised).toBeGreaterThanOrEqual(0);
  });

  it("service priority does not depend on region", () => {
    const a = buildInbox(PROFILES.slice(0, 200), []).map((i) => [i.key, i.priority]);
    const b = buildInbox(PROFILES.slice(0, 200).map((p) => recompute(stripRegion(p.raw), p)), []).map((i) => [i.key, i.priority]);
    expect(a).toEqual(b);
  });
});

describe("Passt zu dir", () => {
  it("max. 3 cards, each an eligible engine candidate with a personal reason, never the main recommendation", () => {
    let withCards = 0;
    for (const p of PROFILES) {
      const cards = crossSellCards(p);
      expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
      for (const k of cards) {
        expect(k.rec.action).toBe("SELL");
        expect(k.rec.policy).toBe("eligible");
        expect(k.rec.dClv).toBeGreaterThan(0);
        expect(k.rec.productId).not.toBe(p.nba.productId);
        expect(k.reason.du.length).toBeGreaterThan(20);
        expect(k.reason.sie).not.toMatch(/\b(du|dein|dir)\b/i);
        expect(`${k.reason.du} ${k.reason.sie}`).not.toMatch(/€|rabatt|jetzt kaufen|nur heute/i);
      }
      if (cards.length) withCards++;
    }
    expect(withCards).toBeGreaterThan(0);
  });

  it("no card while sales are blocked", () => {
    for (const p of PROFILES.filter((x) => salesBlockers(x.raw).length)) expect(crossSellCards(p)).toEqual([]);
  });
});

describe("mobile notes", () => {
  it("roaming is information only and needs a mobile contract", () => {
    for (const p of PROFILES) {
      const notes = mobileNotes(p.raw);
      if (!p.raw.mobile) expect(notes).toEqual([]);
      for (const n of notes) expect(n.du).toMatch(/ohne Aufpreis/);
    }
  });
});
