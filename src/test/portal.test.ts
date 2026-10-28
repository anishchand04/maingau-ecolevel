// Kundenportal rules (Master-Prompt §4, §9): help before offers, one approved recommendation, simulated notifications.
import { describe, expect, it } from "vitest";
import { PROFILES, profileById, applyOverrides, recompute, contactLimit } from "@/lib/engine";
import { daytimeGreeting, discoverList, hasOpenProblem, headlineOf, notificationsOf, recommendationState } from "@/lib/portal";
import { styleOf } from "@/lib/style";
import { searchPortal } from "@/config/portalSearch";
import { PORTAL } from "@/config/portal";
import { OFFER_TEXT } from "@/config/offers";

const approvedAll = (): string | undefined => "approved";
const approvedNone = (): string | undefined => undefined;
const noFeedback = () => undefined;

describe("portal recommendation", () => {
  it("never shows a recommendation or discover list while a problem is open", () => {
    const withProblem = PROFILES.filter(hasOpenProblem);
    expect(withProblem.length).toBeGreaterThan(0);
    for (const p of withProblem) {
      expect(recommendationState(p, approvedAll)).toBe("none");
      expect(discoverList(p)).toEqual([]);
    }
  });

  it("is visible only for SELL + marketing approval + portal consent", () => {
    for (const p of PROFILES) {
      const s = recommendationState(p, approvedAll);
      if (s === "visible") {
        expect(p.nba.action).toBe("SELL");
        expect(p.raw.consent.portal_app_personalisation).toBe("granted");
        expect(OFFER_TEXT[p.nba.productId]).toBeTruthy();
      }
      // without approval nothing reaches the customer – at most the demo hint
      expect(recommendationState(p, approvedNone)).not.toBe("visible");
    }
  });

  it("withdrawing portal personalisation removes it immediately", () => {
    const base = profileById("MG-100332")!;
    expect(recommendationState(base, approvedAll)).toBe("visible");
    const after = recompute(applyOverrides(base.raw, { consent: { portal_app_personalisation: "withdrawn" } }), base);
    expect(recommendationState(after, approvedAll)).toBe("none");
  });

  it("'Mehr entdecken' has at most 3 entries and never repeats the main recommendation", () => {
    for (const p of PROFILES) {
      const d = discoverList(p);
      expect(d.length).toBeLessThanOrEqual(3);
      expect(d.map((r) => r.productId)).not.toContain(p.nba.productId);
    }
  });
});

describe("portal notifications (simulated)", () => {
  const notes = (id: string, decision = approvedAll) => {
    const p = profileById(id)!;
    return notificationsOf(p, styleOf(p.raw), { decision, feedback: noFeedback });
  };

  it("offer notifications need approval, portal consent and a free contact slot", () => {
    for (const p of PROFILES) {
      const offer = notificationsOf(p, styleOf(p.raw), { decision: approvedAll, feedback: noFeedback }).find((n) => n.kind === "offer");
      if (!offer) continue;
      expect(p.raw.consent.portal_app_personalisation).toBe("granted");
      expect(p.raw.contacts30d).toBeLessThan(contactLimit(p.raw));
      expect(hasOpenProblem(p)).toBe(false);
    }
    expect(notes("MG-100332", approvedNone).some((n) => n.kind === "offer")).toBe(false);
  });

  it("service notifications need no advertising consent", () => {
    const p = profileById("MG-100009")!;
    const off = Object.fromEntries(Object.keys(p.raw.consent).map((k) => [k, "withdrawn"]));
    const q = recompute(applyOverrides(p.raw, { consent: off }), p);
    const n = notificationsOf(q, styleOf(q.raw), { decision: approvedAll, feedback: noFeedback });
    expect(n.some((x) => x.kind === "service")).toBe(true);
    expect(n.some((x) => x.kind === "offer")).toBe(false);
  });

  it("feedback 'Kein Interesse' removes the offer notification", () => {
    const p = profileById("MG-100332")!;
    const n = notificationsOf(p, styleOf(p.raw), { decision: approvedAll, feedback: () => "not_interested" });
    expect(n.some((x) => x.kind === "offer")).toBe(false);
  });
});

describe("portal headline, greeting and search", () => {
  it("names the most important thing", () => {
    expect(headlineOf(profileById("MG-100009")!).key).toBe("problem");
    expect(["pgEnds", "pgEnded"]).toContain(headlineOf(profileById("MG-100010")!).key);
  });
  it("greets by time of day", () => {
    expect(daytimeGreeting(8)).toBe("Guten Morgen");
    expect(daytimeGreeting(14)).toBe("Guten Tag");
    expect(daytimeGreeting(21)).toBe("Guten Abend");
  });
  it("finds actions by everyday words, nothing for nonsense", () => {
    expect(searchPortal("zähler").some((h) => h.target.kind === "action" && h.target.id === "zaehlerstand")).toBe(true);
    expect(searchPortal("kündigen").some((h) => h.target.kind === "action" && h.target.id === "kuendigung")).toBe(true);
    expect(searchPortal("Umzug").some((h) => h.target.kind === "action" && h.target.id === "umzug")).toBe(true);
    expect(searchPortal("xyzqv")).toEqual([]);
  });
  it("portal texts contain no internal terms", () => {
    const blob = JSON.stringify(PORTAL).toLowerCase();
    for (const w of ["clv", "churn", "score", "cluster", "sell", "care first", "wait"]) expect(blob).not.toContain(w);
  });
});
