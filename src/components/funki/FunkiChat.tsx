// Funki: bubble with tip (bottom right) + chat panel (desktop 400 px right, mobile full screen).
// Self-service runs as deterministic flows; free text goes to the AI (if enabled) or the offline intent matcher.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, X } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { askFunki } from "@/lib/funkiAi";
import { buildChatContext, fallbackAnswer, parseActionTag, pickTip, startChips, actionTitle, type Chip } from "@/lib/chat";
import { applyEffects, flowCtx } from "@/lib/selfServiceRun";
import { hasOpenProblem, recommendationState, tx } from "@/lib/portal";
import { OFFER_TEXT } from "@/config/offers";
import { FALLBACK, ANGER_RE } from "@/config/faq";
import { CHAT_UI } from "@/config/chat";
import { FLOWS, SELF_SERVICE_TEXT, type FlowResult, type SelfServiceId } from "@/config/selfService";
import { TIP_DELAY_MS, type Tip } from "@/config/tips";
import { PillButton } from "@/components/base/PillButton";
import { Funki, type FunkiMood } from "@/components/funki/Funki";
import { usePortal } from "@/components/portal/use-portal";
import { cn } from "@/lib/utils";
import { FlowCard, Facts } from "./FlowCard";

type Msg =
  | { id: number; kind: "text"; from: "kunde" | "funki"; text: string; action?: SelfServiceId; ai?: boolean; note?: string }
  | { id: number; kind: "chips"; chips: Chip[] }
  | { id: number; kind: "flow"; flow: SelfServiceId; state: "open" | "done" | "cancelled" }
  | { id: number; kind: "result"; text: string; facts?: [string, string][]; reason?: { caseId: string; answered?: string } };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

let seq = 0;
const next = () => ++seq;

export function FunkiChat() {
  const { id, p, style, t } = usePortal();
  const req = useStore((s) => s.chat);
  const aiEnabled = useStore((s) => s.aiEnabled);
  const cases = useStore((s) => s.cases);
  const decisions = useStore((s) => s.decisions);
  const tipsOff = useStore((s) => s.tipsOff[id] ?? false);
  const readings = useStore((s) => s.meterReadings[id]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<FunkiMood>("idle");
  const [tip, setTip] = useState<Tip | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handled = useRef<number | undefined>(undefined);
  const open = req.open && (!req.customerId || req.customerId === id);

  const recVisible = p ? recommendationState(p, (cid, pid) => decisions[`${cid}:${pid}`]?.status) === "visible" : false;
  const ctx = useMemo(() => (p ? flowCtx(p, style, readings?.at(-1)) : null), [p, style, readings]);

  // new customer → fresh conversation
  useEffect(() => { setMsgs([]); setTip(null); }, [id]);

  const push = useCallback((m: DistOmit<Msg, "id">) => {
    setMsgs((x) => [...x, { ...m, id: next() } as Msg]);
    if (m.kind === "text") actions.chatLine(id, { from: m.from, text: m.text });
    if (m.kind === "result") actions.chatLine(id, { from: "funki", text: m.text });
  }, [id]);

  const greet = useCallback(() => {
    if (!p) return;
    const problem = hasOpenProblem(p);
    push({ kind: "text", from: "funki", text: tx(style, problem ? FALLBACK.greetingProblem : FALLBACK.greeting) });
    push({ kind: "chips", chips: startChips(p, style) });
    setMood(problem ? "empathetic" : "idle");
  }, [p, style, push]);

  const startFlow = useCallback((flow: SelfServiceId) => {
    if (!ctx) return;
    const blocked = FLOWS[flow].unavailable?.(ctx);
    if (blocked) { push({ kind: "text", from: "funki", text: blocked.text, action: blocked.next }); return; }
    push({ kind: "flow", flow, state: "open" });
  }, [ctx, push]);

  const answer = useCallback(async (text: string) => {
    if (!p) return;
    push({ kind: "text", from: "kunde", text });
    if (ANGER_RE.test(text) && p.profiling) actions.setMood(id, "verärgert");
    const angry = ANGER_RE.test(text);
    setBusy(true); setMood("thinking");
    let reply: { text: string; action?: SelfServiceId; ai?: boolean; note?: string } | null = null;
    if (aiEnabled) {
      const rec = recVisible ? { title: OFFER_TEXT[p.nba.productId].title, text: tx(style, OFFER_TEXT[p.nba.productId]) } : null;
      const turns = msgs.flatMap((m) => (m.kind === "text" ? [{ role: m.from === "kunde" ? "user" as const : "assistant" as const, content: m.text }] : []));
      try {
        const res = await askFunki({ data: { context: buildChatContext(p, style, { recommendation: rec, cases }), messages: [...turns, { role: "user", content: text }] } });
        if (res.ok) reply = { ...parseActionTag(res.text), ai: true };
        else reply = { ...fallbackAnswer(text, p, style, cases), note: FALLBACK.aiOffline };
      } catch {
        reply = { ...fallbackAnswer(text, p, style, cases), note: FALLBACK.aiOffline };
      }
    } else {
      reply = fallbackAnswer(text, p, style, cases);
      if (angry) reply = { ...reply, text: `${tx(style, FALLBACK.empathy)} ${reply.text}` };
    }
    setBusy(false); setMood(angry || hasOpenProblem(p) ? "empathetic" : "idle");
    push({ kind: "text", from: "funki", ...reply });
  }, [p, id, aiEnabled, recVisible, style, cases, msgs, push]);

  // open requests from search, quick actions, service list
  useEffect(() => {
    if (!open || !p || handled.current === req.nonce) return;
    handled.current = req.nonce;
    if (!msgs.length) greet();
    if (req.actionId && FLOWS[req.actionId as SelfServiceId]) startFlow(req.actionId as SelfServiceId);
    else if (req.draft?.trim()) void answer(req.draft.trim());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, p, req.nonce, req.actionId, req.draft, msgs.length, greet, startFlow, answer]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  // one tip per visit, after 8 s, never with an open problem
  useEffect(() => {
    if (!p || open) return;
    const key = `funki-tip-${p.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* no storage */ }
    const chosen = pickTip(p, { recommendationVisible: recVisible, tipsOff });
    if (!chosen) return;
    const timer = setTimeout(() => {
      setTip(chosen);
      try { sessionStorage.setItem(key, chosen.id); } catch { /* no storage */ }
    }, TIP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [p, open, recVisible, tipsOff]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") actions.closeChat(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!p || !ctx) return null;

  const finishFlow = (msgId: number, flow: SelfServiceId, r: FlowResult) => {
    setMsgs((x) => x.map((m) => (m.id === msgId && m.kind === "flow" ? { ...m, state: "done" } : m)));
    const transcript = msgs.flatMap((m) => (m.kind === "text" ? [`${m.from === "kunde" ? "Kunde" : "Funki"}: ${m.text}`] : []));
    const caseId = applyEffects(p.id, r.effects, transcript);
    push({ kind: "result", text: r.reply, facts: r.facts, reason: FLOWS[flow].followUp && caseId ? { caseId } : undefined });
    setMood(flow === "stoerung" || flow === "kuendigung" || flow === "mitarbeiter" ? "empathetic" : "happy");
  };
  const cancelFlow = (msgId: number) => {
    setMsgs((x) => x.map((m) => (m.id === msgId && m.kind === "flow" ? { ...m, state: "cancelled" } : m)));
    push({ kind: "text", from: "funki", text: SELF_SERVICE_TEXT.aborted });
  };
  const giveReason = (msgId: number, caseId: string, value: string, label: string) => {
    setMsgs((x) => x.map((m) => (m.id === msgId && m.kind === "result" && m.reason ? { ...m, reason: { ...m.reason, answered: label } } : m)));
    if (value !== "keine_angabe") actions.updateCase(caseId, { reason: label }, { actor: "Kunde über Funki", action: "Kündigungsgrund", detail: label });
    push({ kind: "text", from: "funki", text: tx(style, CHAT_UI.reasonThanks) });
  };
  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void answer(text);
  };
  const openPanel = () => { setTip(null); actions.openChat({ customerId: id }); };

  return (
    <>
      {!open && (
        <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2 md:right-6 md:bottom-6">
          {tip && (
            <div role="status" className="relative max-w-[280px] rounded-[20px] border border-mg-line bg-white p-4 pr-10 shadow-[0_8px_24px_-12px_rgba(11,42,91,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="type-small font-semibold text-mg-muted">{CHAT_UI.tipLabel}</p>
              <p className="type-small text-mg-navy">{tx(style, tip)}</p>
              {tip.action && (
                <button type="button" onClick={() => { setTip(null); actions.openChat({ customerId: id, actionId: tip.action }); }}
                  className="mt-1 cursor-pointer type-small font-semibold text-mg-blue underline-offset-4 hover:underline">{actionTitle(tip.action)}</button>
              )}
              <button type="button" onClick={() => setTip(null)} aria-label={CHAT_UI.tipClose}
                className="absolute top-2 right-2 grid size-8 cursor-pointer place-items-center rounded-full text-mg-navy hover:bg-mg-surface"><X className="size-4" strokeWidth={1.75} /></button>
            </div>
          )}
          <button type="button" onClick={openPanel} aria-label={CHAT_UI.open}
            className="grid size-16 cursor-pointer place-items-center rounded-full border-2 border-mg-line bg-white shadow-[0_8px_24px_-12px_rgba(11,42,91,0.35)] transition-transform duration-150 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
            <Funki mood={hasOpenProblem(p) ? "empathetic" : "idle"} size={48} decorative />
          </button>
        </div>
      )}

      {open && (
        <section role="dialog" aria-label={t(CHAT_UI.title)}
          className="theme-portal fixed inset-0 z-50 flex flex-col bg-white md:inset-auto md:right-6 md:bottom-6 md:h-[min(720px,calc(100vh-3rem))] md:w-[400px] md:rounded-[24px] md:border md:border-mg-line md:shadow-[0_16px_40px_-16px_rgba(11,42,91,0.4)]">
          <header className="flex items-center gap-3 border-b border-mg-line px-5 py-4">
            <Funki mood={busy ? "thinking" : mood} size={40} decorative />
            <h2 className="min-w-0 flex-1 font-bold leading-tight">{t(CHAT_UI.title)}</h2>
            <button type="button" onClick={() => actions.closeChat()} aria-label={CHAT_UI.close}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-mg-navy text-mg-navy hover:bg-mg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m) => {
              if (m.kind === "chips") return (
                <div key={m.id} className="flex flex-wrap gap-2">
                  {m.chips.map((c) => (
                    <button key={c.label} type="button" onClick={() => (c.action ? startFlow(c.action) : c.prompt && void answer(c.prompt))}
                      className="min-h-11 cursor-pointer rounded-full border-2 border-mg-navy bg-white px-4 text-[15px] font-semibold text-mg-navy hover:bg-mg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
                      {c.label}
                    </button>
                  ))}
                </div>
              );
              if (m.kind === "flow") return m.state === "open"
                ? <FlowCard key={m.id} id={m.flow} ctx={ctx} onDone={(r) => finishFlow(m.id, m.flow, r)} onCancel={() => cancelFlow(m.id)} />
                : <p key={m.id} className="type-small text-mg-muted">{actionTitle(m.flow)} · {m.state === "done" ? CHAT_UI.flowDone : CHAT_UI.flowCancelled}</p>;
              if (m.kind === "result") return (
                <div key={m.id} className="rounded-[20px] bg-mg-surface p-4">
                  <p className="font-semibold">{m.text}</p>
                  {m.facts && <Facts rows={m.facts} />}
                  {m.reason && !m.reason.answered && ctx && FLOWS.kuendigung.followUp && (
                    <div className="mt-3">
                      <p className="type-small">{FLOWS.kuendigung.followUp.question(ctx)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {FLOWS.kuendigung.followUp.options.map((o) => (
                          <PillButton key={o.value} size="sm" variant="outline" onClick={() => giveReason(m.id, m.reason!.caseId, o.value, o.label)}>{o.label}</PillButton>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
              return (
                <div key={m.id} className={cn("flex", m.from === "kunde" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-[20px] px-4 py-3", m.from === "kunde" ? "bg-mg-navy text-white" : "bg-mg-surface text-mg-navy")}>
                    {m.ai && <p className="mb-1 text-sm font-semibold text-mg-muted">{CHAT_UI.aiBadge}</p>}
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.action && <PillButton size="sm" className="mt-3" onClick={() => startFlow(m.action!)}>{actionTitle(m.action)}</PillButton>}
                    {m.note && <p className="mt-2 text-sm text-mg-muted">{m.note}</p>}
                  </div>
                </div>
              );
            })}
            {busy && <p className="type-small text-mg-muted">{CHAT_UI.thinking}</p>}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-mg-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="funki-input" className="sr-only">{t(CHAT_UI.input)}</label>
            <input id="funki-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t(CHAT_UI.input)} autoComplete="off"
              className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-mg-line bg-white px-5 text-[17px] focus:border-mg-blue focus:outline-none" />
            <button type="submit" disabled={!input.trim() || busy} aria-label={CHAT_UI.send}
              className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-mg-blue text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
              <ArrowUp className="size-5" strokeWidth={2} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
