// Service cases and contract changes from self-service, applied to the replayed record BEFORE the engine
// recomputes. The engine itself is unchanged: a reported fault reads as an open complaint, a cancellation as
// a cancellation in progress – both block selling (CARE FIRST).
import { CATALOG, type RawCustomer } from "@/lib/engine";

export type CaseKind = "stoerung" | "kuendigung" | "umzug" | "rueckruf" | "mitarbeiter" | "beschwerde";
export type CaseSource = "funki" | "portal" | "uebergabe";
export type ServiceCase = {
  id: string; customerId: string; kind: CaseKind; title: string; detail: string;
  source: CaseSource; status: "open" | "solved"; createdAt: string; solvedAt?: string;
  /** cancellation only */
  contract?: "electricity" | "gas" | "mobile" | "autostrom" | "hems";
  endDate?: string; reason?: string;
  /** chat lines handed over to service */
  transcript?: string[];
};

export type ContractChange = { installment?: number; pgUntil?: string; tariff?: string; lastMeterReadingAt?: string };

/** Ticket category the existing views understand. */
const CATEGORY: Record<CaseKind, string> = {
  stoerung: "complaint", kuendigung: "cancellation", umzug: "moving", rueckruf: "callback", mitarbeiter: "handover", beschwerde: "complaint",
};
/** Kinds that block every sale while open. */
const BLOCKING: CaseKind[] = ["stoerung", "beschwerde", "kuendigung"];

/** Resolution keys set in the service cockpit ("Fall lösen"). */
export type ResolutionKey = `ticket:${string}` | `case:${string}` | "complaint" | "charging" | "hems" | "dunning";

export function applyLive(c0: RawCustomer, cases: ServiceCase[], change?: ContractChange, resolved: string[] = []): RawCustomer {
  const mine = cases.filter((k) => k.customerId === c0.id);
  if (!mine.length && !change && !resolved.length) return c0;
  const c: RawCustomer = { ...c0, tickets: [...c0.tickets] };

  // service resolutions on records from the dataset
  for (const key of resolved) {
    if (key.startsWith("ticket:")) {
      const id = key.slice(7);
      const t = c.tickets.find((x) => x.id === id && x.status === "open");
      if (t) {
        c.tickets = c.tickets.map((x) => (x === t ? { ...x, status: "closed" } : x));
        c.openTickets = Math.max(0, c.openTickets - 1);
        if (t.category === "complaint" && !c.tickets.some((x) => x.status === "open" && x.category === "complaint")) c.openComplaint = false;
      }
    }
    if (key === "complaint") {
      const n = c.tickets.filter((x) => x.status === "open" && x.category === "complaint").length;
      c.tickets = c.tickets.map((x) => (x.status === "open" && x.category === "complaint" ? { ...x, status: "closed" } : x));
      c.openTickets = Math.max(0, c.openTickets - n);
      c.openComplaint = false;
    }
    if (key === "charging" && c.charging) c.charging = { ...c.charging, failed30d: 0 };
    if (key === "hems" && c.hems) c.hems = { ...c.hems, offline: false };
    if (key === "dunning") {
      if (c.electricity) c.electricity = { ...c.electricity, dunning: 0 };
      if (c.gas) c.gas = { ...c.gas, dunning: 0 };
    }
  }

  if (change && c.electricity) {
    c.electricity = { ...c.electricity, ...change };
  }
  for (const k of mine) {
    c.tickets.push({ id: k.id, at: k.createdAt.slice(0, 10), channel: k.source === "funki" ? "chat" : "portal_form", category: CATEGORY[k.kind],
      status: k.status === "open" ? "open" : "closed", text: k.detail, csat: null });
    // a confirmed (solved) cancellation stays a cancellation – only the ticket closes
    if (k.kind === "kuendigung") applyCancellation(c, k);
    if (k.status !== "open") continue;
    c.openTickets += 1;
    c.tickets12m += 1;
    if (k.kind === "stoerung" || k.kind === "beschwerde") c.openComplaint = true;
  }
  return c;
}

function applyCancellation(c: RawCustomer, k: ServiceCase) {
  if (k.contract === "electricity" && c.electricity) c.electricity = { ...c.electricity, cancelled: true, status: "cancellation_pending" };
  else if (k.contract === "gas" && c.gas) c.gas = { ...c.gas, cancelled: true };
  else c.rejected = [...new Set([...(c.rejected ?? []), ...CATALOG.map((p) => p.product_id)])]; // no field for this contract: rule out every offer
}

export const isBlocking = (k: ServiceCase) => k.status === "open" && BLOCKING.includes(k.kind);
