// Executes self-service effects on the shared state. Every effect writes an audit line (in the store actions).
import { DECISION_TIME, type Profile } from "@/lib/engine";
import { actions } from "@/lib/store";
import type { StyleProfile } from "@/lib/data-types";
import type { Effect, FlowCtx } from "@/config/selfService";

export function flowCtx(p: Profile, s: StyleProfile, lastReading?: FlowCtx["lastReading"]): FlowCtx {
  return { p, s, today: DECISION_TIME, t: (du, sie) => (s.anrede === "du" ? du : sie), lastReading };
}

/** Returns the id of a service case if one was opened. */
export function applyEffects(customerId: string, effects: Effect[], transcript?: string[]): string | undefined {
  let caseId: string | undefined;
  for (const e of effects) {
    switch (e.type) {
      case "meter": actions.meterReading(customerId, { contract: e.contract, value: e.value, date: e.date }); break;
      case "contract": actions.changeContract(customerId, e.change, e.audit); break;
      case "callback": actions.callback(customerId, e.slot); break;
      case "consents": actions.setConsents(customerId, e.consents, e.detail); break;
      case "frequency": actions.setPrefs(customerId, { frequency: e.value, personalized: true }); break;
      case "contact": actions.contact(customerId, e.data, e.detail); break;
      case "case":
        caseId = actions.openCase({
          customerId, kind: e.kind, title: e.title, detail: e.detail, contract: e.contract, endDate: e.endDate,
          source: e.kind === "mitarbeiter" ? "uebergabe" : "funki", transcript,
        }, `Self-Service: ${e.title}`);
        break;
    }
  }
  return caseId;
}
