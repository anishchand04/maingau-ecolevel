// V3 guardrails (Master-Prompt §9) that span several modules + live sync (§8).
import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { PROFILES, CATALOG, guardrails, recompute, salesBlockers } from "@/lib/engine";
import { applyLive, type ServiceCase } from "@/lib/cases";
import { applyTuning } from "@/lib/tuning";
import { recommendationState } from "@/lib/portal";
import { actions, getState } from "@/lib/store";
import { NBA_STATS } from "@/lib/data";
import { PORTAL } from "@/config/portal";
import { TIPS } from "@/config/tips";
import { FAQ, FALLBACK } from "@/config/faq";
import { CHAT_UI } from "@/config/chat";
import { OFFER_TEXT } from "@/config/offers";
import { OBSERVED_NOTE } from "@/config/internal";
import { ControlGroup } from "@/components/internal/ControlGroup";

const KEY = "maingau-ecolevel-v2";
const kase = (customerId: string, kind: ServiceCase["kind"], contract?: ServiceCase["contract"]): ServiceCase => ({
  id: `FK-${kind}-${customerId}`, customerId, kind, title: kind, detail: kind, source: "funki", status: "open", createdAt: "2026-10-01T10:00:00Z", contract,
});

describe("no SELL under any live state", () => {
  it("faults, cancellations and extreme knobs together still give 0 inadmissible SELL", () => {
    const sells = PROFILES.filter((p) => p.nba.action === "SELL");
    const cases = [
      ...sells.slice(0, 40).map((p) => kase(p.id, "stoerung")),
      ...sells.slice(40, 80).map((p) => kase(p.id, "kuendigung", p.raw.electricity ? "electricity" : "autostrom")),
    ];
    const live = PROFILES.map((p) => (cases.some((k) => k.customerId === p.id) ? recompute(applyLive(p.raw, cases), p) : p));
    for (const t of [{}, { minEv: 150, maxContacts30d: 0, paused: CATALOG.map((c) => c.product_id).slice(0, 5) }]) {
      const tuned = applyTuning(live, t);
      for (const g of guardrails(tuned)) expect(g.violations, g.id).toEqual([]);
      for (const k of cases) {
        const p = tuned.find((x) => x.id === k.customerId)!;
        expect(p.nba.action).not.toBe("SELL");
        expect(recommendationState(p, () => "approved")).toBe("none");
      }
    }
    expect(live.filter((p) => cases.some((k) => k.customerId === p.id && k.kind === "stoerung")).every((p) => salesBlockers(p.raw).length > 0)).toBe(true);
  });
});

describe("no invented euro savings in customer texts", () => {
  it("portal, tips, FAQ and chat texts promise no euro amounts", () => {
    const blob = JSON.stringify([PORTAL, TIPS.map((t) => [t.du, t.sie]), FAQ, FALLBACK, CHAT_UI]);
    // the only € in portal config is the "{v} € im Monat" format for the customer's own installment
    expect(blob.replace("{v} € im Monat", "")).not.toMatch(/€|\beuro\b|sparen sie \d|sparst du \d/i);
  });
  it("prices in offer texts come from the product catalog", () => {
    for (const [pid, t] of Object.entries(OFFER_TEXT)) {
      const amounts = `${t.du} ${t.sie}`.match(/\d+,\d{2} €/g) ?? [];
      const price = String(CATALOG.find((c) => c.product_id === pid)?.price_indicative_eur ?? "");
      for (const a of amounts) expect(price.replace(".", ",")).toContain(a.replace(" €", ""));
    }
  });
});

describe("control group comparison", () => {
  it("always carries the 'observed – no causal proof' note and warns for small groups", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => createRoot(el).render(createElement(ControlGroup, { treated: NBA_STATS.treated, control: NBA_STATS.control })));
    expect(el.textContent).toContain(OBSERVED_NOTE);
    expect(el.querySelector('[role="note"]')?.textContent).toContain("Kleine Gruppe");
  });
});

describe("live sync between tabs and iframes", () => {
  it("a storage event from another document replaces the shared state", () => {
    actions.reset();
    expect(getState().portalCustomer).toBe("MG-100332");
    const next = { ...getState(), portalCustomer: "MG-100009", tuning: { minEv: -5, maxContacts30d: 99, paused: [], batchMax: 10 } };
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(next) }));
    expect(getState().portalCustomer).toBe("MG-100009");
    // values from storage are clamped again – another tab can't loosen the knobs either
    expect(getState().tuning.minEv).toBe(0);
    expect(getState().tuning.maxContacts30d).toBeLessThanOrEqual(4);
    window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    expect(getState().portalCustomer).toBe("MG-100332");
  });
});
