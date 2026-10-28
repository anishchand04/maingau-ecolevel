// V3 data extension (prepare_data.py) + Kommunikationsstil guardrails (Master-Prompt §2, §6, §9).
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, applyOverrides, recompute, canProfile } from "@/lib/engine";
import { styleOf, styleSummary } from "@/lib/style";
import { SERVICE_STATS } from "@/lib/data";
import type { StyleProfile } from "@/lib/data-types";

const STYLE_KEYS = ["anrede", "laenge", "ton", "fachwissen", "stimmung", "belege", "quelle", "status"].sort();

describe("data extension", () => {
  it("every customer has transcripts, portal pages and a well-formed style profile", () => {
    for (const p of PROFILES) {
      const c = p.raw;
      expect(Array.isArray(c.transcripts)).toBe(true);
      expect(Array.isArray(c.portalPages)).toBe(true);
      expect(Object.keys(c.style).sort()).toEqual(STYLE_KEYS);
      expect(["du", "sie"]).toContain(c.style.anrede);
      expect(["kurz", "ausführlich"]).toContain(c.style.laenge);
      expect(["sachlich", "herzlich"]).toContain(c.style.ton);
      expect(["einfach", "fachlich"]).toContain(c.style.fachwissen);
      expect(["zufrieden", "neutral", "verärgert"]).toContain(c.style.stimmung);
      expect(c.style.belege.length).toBeLessThanOrEqual(2);
    }
  });

  it("energy contracts carry notice period, payment method and last meter reading", () => {
    const withElec = PROFILES.filter((p) => p.raw.electricity);
    expect(withElec.length).toBeGreaterThan(0);
    for (const p of withElec) {
      expect(p.raw.electricity).toHaveProperty("noticeWeeks");
      expect(p.raw.electricity).toHaveProperty("paymentMethod");
      expect(p.raw.electricity).toHaveProperty("lastMeterReadingAt");
    }
  });

  it("transcripts from today's stream are included (MG-100009)", () => {
    const c = profileById("MG-100009")!.raw;
    expect(c.transcripts.some((t) => t.ticketId === "TK-201002")).toBe(true);
    expect(c.style.stimmung).toBe("verärgert");
  });

  it("serviceStats come from the dataset and add up", () => {
    const cats = Object.values(SERVICE_STATS.byCategory);
    expect(cats.reduce((s, c) => s + c.tickets, 0)).toBe(SERVICE_STATS.tickets);
    for (const c of [SERVICE_STATS, ...cats]) {
      expect(c.avgHandlingCostEur).toBeGreaterThan(0);
      expect(c.firstContactResolutionRate).toBeGreaterThanOrEqual(0);
      expect(c.firstContactResolutionRate).toBeLessThanOrEqual(1);
    }
  });
});

describe("Kommunikationsstil guardrails", () => {
  it("no profiling consent (incl. today's withdrawal) → no derived profile, no portal pages, no 'Du'", () => {
    const none = PROFILES.filter((p) => !canProfile(p.raw));
    expect(none.length).toBeGreaterThan(0);
    for (const p of none) {
      expect(p.raw.style.status).toBe("standard");
      expect(p.raw.style.belege).toEqual([]);
      expect(p.raw.portalPages).toEqual([]);
      expect(styleOf(p.raw).anrede).toBe("sie");
    }
    expect(profileById("MG-100003")!.raw.style.status).toBe("standard");
  });

  it("withdrawing profiling in the portal drops the derived style at once", () => {
    const base = profileById("MG-100332")!;
    expect(styleOf(base.raw).anrede).toBe("du");
    const after = applyOverrides(base.raw, { consent: { profiling_analytics: "withdrawn" } });
    expect(styleOf(after)).toMatchObject({ anrede: "sie", status: "standard", belege: [] });
  });

  it("the recommendation is identical whatever the style profile says", () => {
    const flip = (s: StyleProfile): StyleProfile => ({
      ...s,
      anrede: s.anrede === "du" ? "sie" : "du",
      laenge: s.laenge === "kurz" ? "ausführlich" : "kurz",
      ton: s.ton === "herzlich" ? "sachlich" : "herzlich",
      fachwissen: s.fachwissen === "fachlich" ? "einfach" : "fachlich",
      stimmung: s.stimmung === "verärgert" ? "zufrieden" : "verärgert",
    });
    // Same code path on both sides, only the style differs.
    const pick = (x: ReturnType<typeof recompute>) => [x.nba.action, x.nba.productId, x.nba.channel, x.nba.tone];
    for (const p of PROFILES) {
      const same = recompute({ ...p.raw }, p);
      const flipped = recompute({ ...p.raw, style: flip(p.raw.style) }, p);
      expect(pick(flipped)).toEqual(pick(same));
    }
  });

  it("the customer's own choice overrides the derived style and is labelled", () => {
    const s = styleOf(profileById("MG-100010")!.raw, { anrede: "du", ton: "herzlich" });
    expect(s.status).toBe("vom Kunden geändert");
    expect(styleSummary(s)).toContain("per Du");
  });

  it("the style profile holds no internal scores", () => {
    const blob = JSON.stringify(PROFILES.map((p) => p.raw.style)).toLowerCase();
    for (const w of ["clv", "churn", "score", "cluster", "risk"]) expect(blob).not.toContain(w);
  });
});
