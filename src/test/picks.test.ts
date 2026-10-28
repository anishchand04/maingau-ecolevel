import { describe, expect, it } from "vitest";
import { PROFILES } from "@/lib/engine";
import { applyPicks, pickOptions } from "@/lib/picks";
import { reasonDe, reasonLineDe } from "@/lib/explain";

const withAlt = PROFILES.find((p) => p.nba.action === "SELL" && pickOptions(p).recs.length > 1 && pickOptions(p).channels.length > 0)!;

describe("manuelle Änderung der Empfehlung", () => {
  it("ersetzt Produkt und Kanal, nennt den Grund und bleibt bei erlaubten Optionen", () => {
    const { recs, channels } = pickOptions(withAlt);
    const alt = recs.find((r) => r.productId !== withAlt.nba.productId)!;
    const [out] = applyPicks([withAlt], { [withAlt.id]: { productId: alt.productId, channel: channels[0], reason: "Kampagnenziel", from: withAlt.nba.product } });
    expect(out.nba.productId).toBe(alt.productId);
    expect(out.nba.manual?.reason).toBe("Kampagnenziel");
    expect(channels).toContain(out.nba.channel);
    expect(reasonLineDe(out)).toContain("Kampagnenziel");
    expect(reasonDe(out)).toContain("Manuell");
  });
  it("ignoriert Kanäle ohne Einwilligung und nicht erlaubte Produkte", () => {
    const [out] = applyPicks([withAlt], { [withAlt.id]: { productId: withAlt.nba.productId, channel: "kein_kanal", reason: "x", from: "" } });
    expect(out.nba.channel).toBe(withAlt.nba.channel);
    const [same] = applyPicks([withAlt], { [withAlt.id]: { productId: "gibt-es-nicht", reason: "x", from: "" } });
    expect(same).toBe(withAlt);
  });
  it("die Einzeiler-Begründung gibt es für jede SELL-Empfehlung", () => {
    for (const p of PROFILES.filter((x) => x.nba.action === "SELL").slice(0, 50)) expect(reasonLineDe(p)).toMatch(/\/100 · Annahme/);
  });
});
