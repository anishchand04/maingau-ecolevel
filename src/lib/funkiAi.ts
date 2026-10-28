// Funki AI answers as a TanStack server function (handler runs on the server only). Key: ANTHROPIC_API_KEY, never in the client.
// The client sends only the compact, whitelisted context from buildChatContext in src/lib/chat.ts – never CLV, churn or scores.
import Anthropic from "@anthropic-ai/sdk";
import { createServerFn } from "@tanstack/react-start";
import { CHAT_HISTORY, CHAT_MAX_TOKENS, CHAT_MODEL, CHAT_SYSTEM_PROMPT } from "@/config/chatSystemPrompt";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatRequest = { context: string; messages: ChatTurn[] };
export type ChatResponse = { ok: true; text: string } | { ok: false; reason: "no_key" | "refused" | "error" };

function validate(input: unknown): ChatRequest {
  const d = input as ChatRequest;
  if (!d || typeof d.context !== "string" || !Array.isArray(d.messages)) throw new Error("invalid chat request");
  const messages = d.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-CHAT_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  // the API needs the conversation to start with a user turn
  while (messages.length && messages[0].role !== "user") messages.shift();
  return { context: d.context.slice(0, 12000), messages };
}

export const askFunki = createServerFn({ method: "POST" })
  .validator(validate)
  .handler(async ({ data }): Promise<ChatResponse> => {
    if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "no_key" };
    if (!data.messages.length) return { ok: false, reason: "error" };
    const client = new Anthropic();
    try {
      const res = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        // short service answers: no thinking, low effort – the whole token budget goes to the reply
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: [
          { type: "text", text: CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Kontext zum Kunden:\n${data.context}` },
        ],
        messages: data.messages,
      });
      if (res.stop_reason === "refusal") return { ok: false, reason: "refused" };
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return text ? { ok: true, text } : { ok: false, reason: "error" };
    } catch (err) {
      if (err instanceof Anthropic.APIError) console.error(`Funki AI error ${err.status}: ${err.message}`);
      else console.error("Funki AI error", err);
      return { ok: false, reason: "error" };
    }
  });

const SUMMARY_PROMPT = `Du fasst einen Servicefall für einen MAINGAU-Servicemitarbeiter zusammen.
Höchstens drei kurze Sätze auf Deutsch: Was ist das Anliegen, wie ist der Stand, was ist der sinnvolle nächste Schritt.
Nur Fakten aus den Falldaten. Keine Verkaufsideen, keine Vermutungen über den Kundenwert.`;

/** One summary per case, cached by the caller. */
export const summarizeCase = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const d = input as { facts: string };
    if (!d || typeof d.facts !== "string") throw new Error("invalid summary request");
    return { facts: d.facts.slice(0, 6000) };
  })
  .handler(async ({ data }): Promise<ChatResponse> => {
    if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "no_key" };
    const client = new Anthropic();
    try {
      const res = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: SUMMARY_PROMPT,
        messages: [{ role: "user", content: data.facts }],
      });
      if (res.stop_reason === "refusal") return { ok: false, reason: "refused" };
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return text ? { ok: true, text } : { ok: false, reason: "error" };
    } catch (err) {
      if (err instanceof Anthropic.APIError) console.error(`Funki summary error ${err.status}: ${err.message}`);
      else console.error("Funki summary error", err);
      return { ok: false, reason: "error" };
    }
  });
