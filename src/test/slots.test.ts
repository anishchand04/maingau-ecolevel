import { describe, expect, it } from "vitest";
import { SLOT_CAPACITY, countBookings, demoBookings, freeSlots, mergeBookings, slotSequence } from "@/lib/slots";

const NOW = new Date(2026, 9, 27, 8, 0); // Dienstag

describe("Terminvorschläge", () => {
  it("überspringt belegte Beratungstermine und schlägt die nächsten vor", () => {
    const seq = slotSequence("consult", NOW);
    const free = freeSlots("consult", {}, { now: NOW, limit: 3 });
    expect(free).toEqual(seq.slice(0, 3));
    const taken = freeSlots("consult", { [seq[0]]: SLOT_CAPACITY.consult }, { now: NOW, limit: 3 });
    expect(taken).not.toContain(seq[0]);
    expect(taken).toEqual(seq.slice(1, 4));
  });
  it("Rückruf-Fenster haben Kapazität > 1", () => {
    const seq = slotSequence("call", NOW);
    expect(freeSlots("call", { [seq[0]]: 1 }, { now: NOW, limit: 1 })).toEqual([seq[0]]);
    expect(freeSlots("call", { [seq[0]]: SLOT_CAPACITY.call }, { now: NOW, limit: 1 })).toEqual([seq[1]]);
  });
  it("Buchungen anderer Kunden und Demo-Belegung werden zusammengezählt", () => {
    const seq = slotSequence("consult", NOW);
    const booked = mergeBookings(demoBookings("consult", NOW), countBookings([seq[2], "nach Absprache", undefined]));
    const free = freeSlots("consult", booked, { now: NOW, limit: 50 });
    expect(free).not.toContain(seq[0]);
    expect(free).not.toContain(seq[2]);
  });
});
