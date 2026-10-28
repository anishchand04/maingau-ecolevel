// Shared state for both dashboards (approvals, audit log, consent, feedback).
// Prototype: persisted in the browser (localStorage). Swap for a database to share across users.
import { useSyncExternalStore } from "react";
import type { StyleOverride } from "@/lib/style";
import type { ContractChange, ServiceCase } from "@/lib/cases";
import { unlockedByDeclared } from "@/lib/engine";
import { TUNING_DEFAULT, clampTuning, type Tuning } from "@/config/tuning";
import { nextVersionId, proposeRates, activeRates, simulateResult, versionLabel, holdoutGroup, contradicted, repeatsRolledBack, historyPoint, type HistoryPoint, type LearnVersion, type Outcome } from "@/lib/learning";
import { LEARNING } from "@/config/thresholds";

export type ChatLine = { from: "kunde" | "funki"; text: string; at: string };

export type Decision = "approved" | "rejected" | "review" | "scheduled" | "held_out";
export type Pick = { productId: string; channel?: string; reason: string; from: string };
export type AuditEntry = { at: string; actor: string; action: string; customerId?: string; detail: string };
/** Structured feedback record for the engine: one entry per NBA that marketing forwarded to a customer. */
export type EngineLogEntry = {
  at: string; type: "nba_forwarded"; customerId: string; productId: string; channel?: string; dClv: number; pAccept: number; reason: string;
};
type State = {
  engineLog: EngineLogEntry[];
  decisions: Record<string, { status: Decision; at: string; note?: string }>; // key = customerId:productId
  /** manual change of the engine's NBA by marketing: customerId → chosen product/channel with reason */
  picks: Record<string, Pick>;
  audit: AuditEntry[];
  consent: Record<string, Record<string, string>>; // overrides per customer
  feedback: Record<string, "not_interested" | "already_have" | "learn_more">; // customerId:productId
  prefs: Record<string, { frequency: string; personalized: boolean }>;
  callbacks: Record<string, string>;
  /** customerId:productId → booked consultation slot */
  appointments: Record<string, string>;
  campaigns: { id: string; name: string; at: string; size: number; product: string; channel: string; status: string }[];
  portalCustomer: string;
  /** voluntary portal answers (only used with profiling consent) */
  declared: Record<string, { heating?: "heat_pump" | "gas" | "other"; ev?: boolean; moving?: boolean }>;
  /** customers who skipped the voluntary question */
  skipped: Record<string, boolean>;
  /** Funki chat request from portal (search, quick action); rendered by the chat panel */
  chat: { open: boolean; customerId?: string; draft?: string; actionId?: string; nonce?: number };
  /** "So sprechen wir dich an" – customer's own choice */
  styleOverride: Record<string, StyleOverride>;
  /** Funki tips switched off per customer */
  tipsOff: Record<string, boolean>;
  /** notification ids the customer has seen (push preview shown) / opened */
  seenNotes: Record<string, string[]>;
  readNotes: Record<string, string[]>;
  /** self-service results */
  cases: ServiceCase[];
  contractChanges: Record<string, ContractChange>;
  meterReadings: Record<string, { contract: string; value: number; date: string }[]>;
  contactData: Record<string, { iban?: string; email?: string; phone?: string }>;
  chats: Record<string, ChatLine[]>;
  /** mood from new chat messages (only "stimmung" is updated live) */
  mood: Record<string, "zufrieden" | "neutral" | "verärgert">;
  aiEnabled: boolean;
  /** marketing knobs – only ever tighten the rules */
  tuning: Tuning;
  /** service resolutions per customer: "ticket:<id>", "complaint", "charging", "hems", "dunning" */
  resolved: Record<string, string[]>;
  /** cached case summaries (AI or template) by inbox key */
  summaries: Record<string, { text: string; ai: boolean }>;
  /** Mein Eco-Zuhause: self statements, best score ever shown (never sinks), switched off */
  ecoSelf: Record<string, string[]>;
  ecoBest: Record<string, number>;
  ecoOff: Record<string, boolean>;
  /** learning loop: random holdout, outcomes of approved/held-back offers, versioned rates */
  learning: { holdoutPct: number; outcomes: Outcome[]; versions: LearnVersion[]; activeId: string | null; /** automatic learning: live run, new versions without a click, auto-rollback */ auto: boolean; history: HistoryPoint[] };
};
const KEY = "maingau-ecolevel-v2";
const initial: State = { engineLog: [], decisions: {}, picks: {}, audit: [], consent: {}, feedback: {}, prefs: {}, callbacks: {}, appointments: {}, campaigns: [], portalCustomer: "MG-100332", declared: {}, skipped: {},
  chat: { open: false }, styleOverride: {}, tipsOff: {}, seenNotes: {}, readNotes: {},
  cases: [], contractChanges: {}, meterReadings: {}, contactData: {}, chats: {}, mood: {}, aiEnabled: false,
  tuning: TUNING_DEFAULT, resolved: {}, summaries: {}, ecoSelf: {}, ecoBest: {}, ecoOff: {},
  learning: { holdoutPct: 0, outcomes: [], versions: [], activeId: null, auto: true, history: [] } };
let state: State = initial;
let loaded = false;
const subs = new Set<() => void>();
function parse(raw: string | null): State {
  if (!raw) return initial;
  const next = { ...initial, ...JSON.parse(raw) } as State;
  next.tuning = clampTuning(next.tuning ?? {});
  next.learning = { ...initial.learning, ...(next.learning ?? {}) };
  return next;
}
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { state = parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  // a fresh page starts with Funki closed; open requests from other tabs still arrive via the storage event
  state = { ...state, chat: { open: false } };
  // Another tab or iframe (e.g. /demo split screen) changed the shared state → take it over and re-render.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY && e.key !== null) return;
    try { state = parse(e.key === null ? null : e.newValue); } catch { return; }
    subs.forEach((f) => f());
  });
}
/** Current state snapshot (tests, non-React callers). */
export function getState(): State { load(); return state; }
function set(fn: (s: State) => State) {
  load(); state = fn(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => { load(); subs.add(cb); cb(); return () => subs.delete(cb); },
    () => { load(); return sel(state); },
    () => sel(initial),
  );
}
const logTo = (list: AuditEntry[], e: Omit<AuditEntry, "at">): AuditEntry[] => [{ ...e, at: new Date().toISOString() }, ...list].slice(0, 1000);
const log = (s: State, e: Omit<AuditEntry, "at">): AuditEntry[] => logTo(s.audit, e);

export const actions = {
  decide(customerId: string, productId: string, status: Decision, detail: string, note?: string) {
    set((s) => ({ ...s, decisions: { ...s.decisions, [`${customerId}:${productId}`]: { status, at: new Date().toISOString(), ...(note ? { note } : {}) } },
      audit: log(s, { actor: "Marketing (Demo)", action: `Empfehlung: ${({ approved: "freigegeben", rejected: "abgelehnt", review: "zurückgestellt", scheduled: "geplant", held_out: "Kontrollgruppe (zurückgehalten)" } as const)[status]}`, customerId, detail: note ? `${detail} · Grund: ${note}` : detail }) }));
  },
  /** Marketing replaces the engine's NBA for one customer (other eligible product and/or consented channel). Always with a reason. */
  pickNba(customerId: string, pick: Pick, detail: string) {
    set((s) => ({ ...s, picks: { ...s.picks, [customerId]: pick },
      audit: log(s, { actor: "Marketing (Demo)", action: "Empfehlung geändert", customerId, detail: `${detail} · Grund: ${pick.reason}` }) }));
  },
  /** Back to the engine's own choice. */
  clearPick(customerId: string) {
    set((s) => { const { [customerId]: old, ...rest } = s.picks; return { ...s, picks: rest,
      audit: log(s, { actor: "Marketing (Demo)", action: "Änderung der Empfehlung zurückgenommen", customerId, detail: old ? `${old.productId} → Engine-Vorschlag ${old.from}` : "—" }) }; });
  },
  /** Forwards the customer's NBA to the portal (= approved) and writes the engine log entry in one step. */
  forwardNba(e: Omit<EngineLogEntry, "at" | "type">, detail: string) {
    const at = new Date().toISOString();
    set((s) => ({ ...s,
      decisions: { ...s.decisions, [`${e.customerId}:${e.productId}`]: { status: "approved", at } },
      engineLog: [{ ...e, at, type: "nba_forwarded" as const }, ...s.engineLog].slice(0, 2000),
      audit: log(s, { actor: "Marketing (Demo)", action: "NBA an Kunden weitergeleitet", customerId: e.customerId, detail }) }));
  },
  setConsent(customerId: string, type: string, status: string) {
    set((s) => ({ ...s, consent: { ...s.consent, [customerId]: { ...s.consent[customerId], [type]: status } },
      audit: log(s, { actor: "Kunde", action: "Einwilligung geändert", customerId, detail: `${type} → ${status}` }) }));
  },
  feedback(customerId: string, productId: string, f: State["feedback"][string]) {
    set((s) => ({ ...s, feedback: { ...s.feedback, [`${customerId}:${productId}`]: f },
      learning: { ...s.learning, outcomes: s.learning.outcomes.map((o) => (o.customerId === customerId && o.offer === productId && o.group === "treated" && o.converted === null
        ? { ...o, response: f === "learn_more" ? "clicked" as const : "dismissed" as const, ...(f === "learn_more" ? {} : { converted: false, simulated: false }) } : o)) },
      audit: log(s, { actor: "Kunde", action: "Rückmeldung zur Empfehlung", customerId, detail: `${productId}: ${f}` }) }));
  },
  setPrefs(customerId: string, p: State["prefs"][string]) {
    set((s) => ({ ...s, prefs: { ...s.prefs, [customerId]: p }, audit: log(s, { actor: "Kunde", action: "Kontakthäufigkeit geändert", customerId, detail: `Häufigkeit: ${p.frequency}` }) }));
  },
  callback(customerId: string, slot: string) {
    set((s) => ({ ...s, callbacks: { ...s.callbacks, [customerId]: slot }, audit: log(s, { actor: "Kunde", action: "Rückruf angefragt", customerId, detail: slot }) }));
  },
  appointment(customerId: string, productId: string, slot: string) {
    set((s) => ({ ...s, appointments: { ...s.appointments, [`${customerId}:${productId}`]: slot }, audit: log(s, { actor: "Kunde", action: "Beratungstermin gebucht", customerId, detail: `${productId} · ${slot}` }) }));
  },
  addCampaign(c: State["campaigns"][number]) {
    set((s) => ({ ...s, campaigns: [c, ...s.campaigns], audit: log(s, { actor: "Marketing (Demo)", action: "Kampagne freigegeben (simuliert)", detail: `${c.name} · ${c.size} customers` }) }));
  },
  logSim(customerId: string, detail: string) { set((s) => ({ ...s, audit: log(s, { actor: "Marketing (Demo)", action: "Simulation", customerId, detail }) })); },
  setPortalCustomer(id: string) { set((s) => ({ ...s, portalCustomer: id })); },
  declare(customerId: string, d: State["declared"][string]) {
    set((s) => ({ ...s, declared: { ...s.declared, [customerId]: { ...s.declared[customerId], ...d } },
      // New data can re-open "Habe ich schon" blocks; a later click blocks again.
      feedback: Object.fromEntries(Object.entries(s.feedback).filter(([k, f]) => {
        if (f !== "already_have" || !k.startsWith(`${customerId}:`)) return true;
        const u = unlockedByDeclared(s.declared[customerId], d);
        return u !== "all" && !u.includes(k.split(":")[1]);
      })) as State["feedback"],
      audit: log(s, { actor: "Kunde", action: "Freiwillige Angabe", customerId, detail: JSON.stringify(d) }) }));
  },
  skip(customerId: string) {
    set((s) => ({ ...s, skipped: { ...s.skipped, [customerId]: true }, audit: log(s, { actor: "Kunde", action: "Freiwillige Frage übersprungen", customerId, detail: "—" }) }));
  },
  openChat(req: { customerId: string; draft?: string; actionId?: string }) {
    set((s) => ({ ...s, chat: { open: true, ...req, nonce: Date.now() } }));
  },
  closeChat() { set((s) => ({ ...s, chat: { open: false } })); },
  setStyle(customerId: string, o: StyleOverride) {
    set((s) => ({ ...s, styleOverride: { ...s.styleOverride, [customerId]: { ...s.styleOverride[customerId], ...o } },
      audit: log(s, { actor: "Kunde", action: "Kommunikationsstil geändert", customerId, detail: JSON.stringify(o) }) }));
  },
  setTips(customerId: string, on: boolean) {
    set((s) => ({ ...s, tipsOff: { ...s.tipsOff, [customerId]: !on },
      audit: log(s, { actor: "Kunde", action: "Tipps-Einstellung", customerId, detail: on ? "an" : "aus" }) }));
  },
  /** "seenNotes" = push preview shown, "readNotes" = list opened */
  markNotes(kind: "seenNotes" | "readNotes", customerId: string, ids: string[]) {
    set((s) => {
      const have = new Set(s[kind][customerId] ?? []);
      if (ids.every((i) => have.has(i))) return s;
      ids.forEach((i) => have.add(i));
      return { ...s, [kind]: { ...s[kind], [customerId]: [...have] } };
    });
  },
  openCase(k: Omit<ServiceCase, "id" | "createdAt" | "status">, audit: string) {
    const id = `FK-${Date.now().toString(36).toUpperCase()}`;
    set((s) => ({ ...s, cases: [{ ...k, id, status: "open", createdAt: new Date().toISOString() }, ...s.cases],
      audit: log(s, { actor: k.source === "funki" ? "Kunde über Funki" : "Kunde", action: audit, customerId: k.customerId, detail: `${id}: ${k.title}` }) }));
    return id;
  },
  updateCase(id: string, patch: Partial<ServiceCase>, audit: { actor: string; action: string; detail: string }) {
    set((s) => {
      const k = s.cases.find((x) => x.id === id);
      if (!k) return s;
      return { ...s, cases: s.cases.map((x) => (x.id === id ? { ...x, ...patch } : x)), audit: log(s, { ...audit, customerId: k.customerId }) };
    });
  },
  changeContract(customerId: string, change: ContractChange, audit: string) {
    set((s) => ({ ...s, contractChanges: { ...s.contractChanges, [customerId]: { ...s.contractChanges[customerId], ...change } },
      audit: log(s, { actor: "Kunde über Funki", action: "Vertrag geändert", customerId, detail: audit }) }));
  },
  meterReading(customerId: string, r: { contract: string; value: number; date: string }) {
    set((s) => ({ ...s, meterReadings: { ...s.meterReadings, [customerId]: [...(s.meterReadings[customerId] ?? []), r] },
      contractChanges: r.contract === "electricity" ? { ...s.contractChanges, [customerId]: { ...s.contractChanges[customerId], lastMeterReadingAt: r.date } } : s.contractChanges,
      audit: log(s, { actor: "Kunde über Funki", action: "Zählerstand gemeldet", customerId, detail: `${r.contract}: ${r.value} (${r.date})` }) }));
  },
  contact(customerId: string, d: { iban?: string; email?: string; phone?: string }, detail: string) {
    set((s) => ({ ...s, contactData: { ...s.contactData, [customerId]: { ...s.contactData[customerId], ...d } },
      audit: log(s, { actor: "Kunde über Funki", action: "Kontaktdaten geändert", customerId, detail }) }));
  },
  chatLine(customerId: string, line: Omit<ChatLine, "at">) {
    set((s) => ({ ...s, chats: { ...s.chats, [customerId]: [...(s.chats[customerId] ?? []), { ...line, at: new Date().toISOString() }].slice(-40) } }));
  },
  setMood(customerId: string, m: State["mood"][string]) {
    set((s) => (s.mood[customerId] === m ? s : { ...s, mood: { ...s.mood, [customerId]: m } }));
  },
  setAi(on: boolean) { set((s) => ({ ...s, aiEnabled: on })); },
  /** consents in one go (one audit line) */
  setConsents(customerId: string, c: Record<string, string>, detail: string) {
    set((s) => ({ ...s, consent: { ...s.consent, [customerId]: { ...s.consent[customerId], ...c } },
      audit: log(s, { actor: "Kunde über Funki", action: "Einwilligung geändert", customerId, detail }) }));
  },
  setTuning(t: Partial<Tuning>) {
    set((s) => {
      const next = clampTuning({ ...s.tuning, ...t });
      const changed = (Object.keys(t) as (keyof Tuning)[]).map((k) => `${k}: ${JSON.stringify(s.tuning[k])} → ${JSON.stringify(next[k])}`).join(", ");
      return { ...s, tuning: next, audit: log(s, { actor: "Marketing (Demo)", action: "Stellschraube geändert", detail: changed }) };
    });
  },
  resolve(customerId: string, keys: string[], detail: string) {
    set((s) => ({ ...s, resolved: { ...s.resolved, [customerId]: [...new Set([...(s.resolved[customerId] ?? []), ...keys])] },
      cases: s.cases.map((k) => (k.customerId === customerId && keys.includes(`case:${k.id}`) ? { ...k, status: "solved" as const, solvedAt: new Date().toISOString() } : k)),
      audit: log(s, { actor: "Service (Demo)", action: "Fall gelöst", customerId, detail }) }));
  },
  serviceNote(customerId: string, action: string, detail: string) {
    set((s) => ({ ...s, audit: log(s, { actor: "Service (Demo)", action, customerId, detail }) }));
  },
  setSummary(key: string, v: { text: string; ai: boolean }) { set((s) => ({ ...s, summaries: { ...s.summaries, [key]: v } })); },
  toggleEcoSelf(customerId: string, key: string, on: boolean) {
    set((s) => {
      const cur = new Set(s.ecoSelf[customerId] ?? []);
      if (on) cur.add(key); else cur.delete(key);
      return { ...s, ecoSelf: { ...s.ecoSelf, [customerId]: [...cur] },
        audit: log(s, { actor: "Kunde", action: "Eco-Zuhause-Angabe", customerId, detail: `${key}: ${on ? "ja" : "nein"}` }) };
    });
  },
  /** only ever raises the stored score */
  raiseEcoBest(customerId: string, score: number) {
    set((s) => ((s.ecoBest[customerId] ?? 0) >= score ? s : { ...s, ecoBest: { ...s.ecoBest, [customerId]: score } }));
  },
  setEcoOff(customerId: string, off: boolean) {
    set((s) => ({ ...s, ecoOff: { ...s.ecoOff, [customerId]: off },
      audit: log(s, { actor: "Kunde", action: "Eco-Zuhause-Einstellung", customerId, detail: off ? "aus" : "an" }) }));
  },
  /** Marketing sets the random holdout share. 0 = off. */
  setHoldout(pct: number) {
    set((s) => ({ ...s, learning: { ...s.learning, holdoutPct: pct },
      audit: log(s, { actor: "Marketing (Demo)", action: "Holdout geändert", detail: `${s.learning.holdoutPct} % → ${pct} %` }) }));
  },
  /** An approved offer (treated) or a withheld one (control) becomes an open outcome. One outcome per customer, offer and engine version. */
  recordOutcome(o: { customerId: string; offer: string; channel: string; group: Outcome["group"] }) {
    set((s) => {
      const version = versionLabel(s.learning.activeId);
      const id = `${o.customerId}:${o.offer}:${version}`;
      if (s.learning.outcomes.some((x) => x.id === id)) return s;
      const row: Outcome = { id, ...o, version, at: new Date().toISOString(), converted: null, response: o.group === "control" ? "held_out" : "sent" };
      return { ...s, learning: { ...s.learning, outcomes: [...s.learning.outcomes, row] },
        audit: log(s, { actor: "Marketing (Demo)", action: o.group === "control" ? "Empfehlung zurückgehalten (Kontrollgruppe)" : "Empfehlung freigegeben (Behandlungsgruppe)", customerId: o.customerId,
          detail: `${o.offer} · ${o.channel} · Engine ${version} · ${o.group === "control" ? "hätte das Angebot bekommen, bleibt bewusst ohne Ansprache" : "Angebot freigegeben"}` }) };
    });
  },
  /** Demo: close all open outcomes with a simulated result (flagged `simulated`). */
  simulateOutcomes() {
    set((s) => {
      const open = s.learning.outcomes.filter((o) => o.converted === null);
      if (!open.length) return s;
      const outcomes = s.learning.outcomes.map((o) => {
        if (o.converted !== null) return o;
        const converted = simulateResult(o);
        return { ...o, converted, simulated: true, response: converted ? "converted" as const : o.group === "control" ? "held_out" as const : "ignored" as const };
      });
      return { ...s, learning: { ...s.learning, outcomes }, audit: log(s, { actor: "Marketing (Demo)", action: "Ergebnisse simuliert", detail: `${open.length} offene Ergebnisse (simuliert aus Basisquote)` }) };
    });
  },
  /** New proposal from live treated outcomes. Nothing changes until it is approved. Returns the version id or null. */
  proposeVersion(): string | null {
    let id: string | null = null;
    set((s) => {
      const { rates, changes } = proposeRates(s.learning.outcomes, activeRates(s.learning.versions, s.learning.activeId));
      if (!changes.length) return s;
      id = nextVersionId(s.learning.versions);
      const v: LearnVersion = { id, at: new Date().toISOString(), parent: s.learning.activeId, status: "proposed", rates, changes, note: `${changes.length} Raten angepasst` };
      return { ...s, learning: { ...s.learning, versions: [...s.learning.versions, v] },
        audit: log(s, { actor: "Engine", action: "Lernvorschlag erstellt", detail: `${id}: ${changes.map((c) => `${c.offer}/${c.channel} ${(c.from * 100).toFixed(1)} % → ${(c.to * 100).toFixed(1)} %`).join(", ")}` }) };
    });
    return id;
  },
  /** Approve = make active. The previously active version is archived and stays available for rollback. */
  activateVersion(id: string) {
    set((s) => {
      const v = s.learning.versions.find((x) => x.id === id);
      if (!v || v.status !== "proposed") return s;
      return { ...s, learning: { ...s.learning, activeId: id, versions: s.learning.versions.map((x) => (x.id === id ? { ...x, status: "active" as const } : x.id === s.learning.activeId ? { ...x, status: "archived" as const } : x)) },
        audit: log(s, { actor: "Marketing (Demo)", action: "Lernversion freigegeben", detail: `${id} (vorher ${s.learning.activeId ?? "Basis"}): ${v.changes.length} Raten` }) };
    });
  },
  rejectVersion(id: string) {
    set((s) => ({ ...s, learning: { ...s.learning, versions: s.learning.versions.map((x) => (x.id === id && x.status === "proposed" ? { ...x, status: "rejected" as const } : x)) },
      audit: log(s, { actor: "Marketing (Demo)", action: "Lernvorschlag verworfen", detail: id }) }));
  },
  /** Back to the parent of the active version (or the base engine). */
  rollbackVersion() {
    set((s) => {
      const cur = s.learning.versions.find((x) => x.id === s.learning.activeId);
      if (!cur) return s;
      return { ...s, learning: { ...s.learning, activeId: cur.parent, versions: s.learning.versions.map((x) => (x.id === cur.id ? { ...x, status: "rolled_back" as const } : x.id === cur.parent ? { ...x, status: "active" as const } : x)) },
        audit: log(s, { actor: "Marketing (Demo)", action: "Lernversion zurückgerollt", detail: `${cur.id} → ${cur.parent ?? "Basis"}` }) };
    });
  },
  setAuto(on: boolean) {
    set((s) => ({ ...s, learning: { ...s.learning, auto: on }, audit: log(s, { actor: "Marketing (Demo)", action: on ? "Automatisches Lernen eingeschaltet" : "Automatisches Lernen ausgeschaltet", detail: on ? "Neue Versionen werden ohne Klick aktiviert, mit Auto-Rollback." : "Jede neue Version braucht eine Freigabe." }) }));
  },
  /** Back to the base engine: results, versions and the curve are cleared. Holdout and auto mode stay. */
  resetLearning() {
    set((s) => ({ ...s, learning: { ...s.learning, outcomes: [], versions: [], activeId: null, history: [] }, audit: log(s, { actor: "Marketing (Demo)", action: "Lernstand zurückgesetzt", detail: "Zurück auf die Basis-Engine." }) }));
  },
  /**
   * One step of the live learning run (demo): contact a batch of customers (random holdout decides who is held back),
   * close the results with simulated behaviour, then – in auto mode – roll back a version that the data contradicts, or
   * activate a new one once enough new results exist. Nothing is sent; no per-customer audit lines (one line per version).
   */
  learnTick(batch: { customerId: string; offer: string; channel: string }[], auto: boolean) {
    set((s) => {
      const L = s.learning;
      const version = versionLabel(L.activeId), now = new Date().toISOString();
      const pct = Math.max(L.holdoutPct, LEARNING.autoHoldoutPct);
      const have = new Set(L.outcomes.map((o) => `${o.customerId}:${o.offer}`));
      const fresh: Outcome[] = batch.filter((b) => !have.has(`${b.customerId}:${b.offer}`)).map((b) => {
        const group = holdoutGroup(b.customerId, pct);
        return { id: `${b.customerId}:${b.offer}:${version}`, ...b, version, group, at: now, converted: null, response: group === "control" ? "held_out" as const : "sent" as const };
      });
      const outcomes = [...L.outcomes, ...fresh].map((o) => {
        if (o.converted !== null) return o;
        const converted = simulateResult(o);
        return { ...o, converted, simulated: true, response: converted ? "converted" as const : o.group === "control" ? "held_out" as const : "ignored" as const };
      });
      let { versions, activeId } = L, audit = s.audit, changed = false;
      if (auto) {
        const active = versions.find((v) => v.id === activeId);
        const bad = contradicted(outcomes, active);
        const treated = outcomes.filter((o) => o.group === "treated").length;
        const newSince = treated - Math.max(0, ...versions.map((v) => v.closedTreated ?? 0));
        if (active && bad) {
          versions = versions.map((v) => (v.id === active.id ? { ...v, status: "rolled_back" as const } : v.id === active.parent ? { ...v, status: "active" as const } : v));
          activeId = active.parent; changed = true;
          audit = logTo(audit, { actor: "Engine", action: "Auto-Rollback", detail: `${active.id} → ${active.parent ?? "Basis"}: Ergebnisse widersprechen der Änderung bei ${bad.offer}/${bad.channel}` });
        } else if (newSince >= LEARNING.autoMinNew) {
          const { rates, changes } = proposeRates(outcomes, activeRates(versions, activeId));
          if (changes.length && !repeatsRolledBack(changes, versions)) {
            const id = nextVersionId(versions);
            versions = [...versions.map((v) => (v.id === activeId ? { ...v, status: "archived" as const } : v)),
              { id, at: now, parent: activeId, status: "active" as const, rates, changes, note: `${changes.length} Raten angepasst (automatisch)`, auto: true, closedTreated: treated }];
            audit = logTo(audit, { actor: "Engine", action: "Lernversion automatisch aktiviert", detail: `${id} (vorher ${activeId ?? "Basis"}): ${changes.map((c) => `${c.offer}/${c.channel} ${(c.from * 100).toFixed(1)} % → ${(c.to * 100).toFixed(1)} %`).join(", ")}` });
            activeId = id; changed = true;
          }
        }
      }
      if (!fresh.length && !changed) return s;
      const step = (L.history.at(-1)?.step ?? 0) + 1;
      const history = [...L.history, historyPoint(step, outcomes, activeRates(versions, activeId), activeId)].slice(-400);
      return { ...s, audit, learning: { ...L, outcomes, versions, activeId, history } };
    });
  },
  /** Engine decisions that changed (old → new, with the reason). One line each, summarised when many change at once. */
  logDecisionChanges(changes: { customerId: string; detail: string }[]) {
    if (!changes.length) return;
    set((s) => {
      const lines = changes.length > 5
        ? [{ customerId: undefined, detail: `${changes.length} Kunden: Entscheidung geändert (z. B. durch Stellschraube, Lernversion oder Portal-Änderung)` }]
        : changes;
      return { ...s, audit: lines.reduceRight((a, c) => [{ at: new Date().toISOString(), actor: "Engine", action: "Entscheidung geändert", customerId: c.customerId, detail: c.detail }, ...a], s.audit).slice(0, 1000) };
    });
  },
  reset() { set(() => initial); },
};
