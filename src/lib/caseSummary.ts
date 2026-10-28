// Case facts for service (pure). No CLV, churn or scores – service does not see customer value.
import { productsOf, type Profile } from "@/lib/engine";
import type { InboxItem } from "@/lib/inbox";
import type { ChatLine } from "@/lib/store";
import { styleOf, styleSummary } from "@/lib/style";
import { careCode } from "@/lib/explain";
import { fmtDate } from "@/lib/portal";
import { FLAG_DE } from "@/config/internal";
import { PORTAL } from "@/config/portal";
import { REPLY_TEMPLATES, SOURCE_DE } from "@/config/service";
import { placeholderFirstName } from "@/config/names";

export function caseFacts(p: Profile, item: InboxItem, chat: ChatLine[] = []): string {
  const c = p.raw;
  const s = styleOf(c);
  const lines = [
    `Anliegen: ${item.title}${item.detail ? ` – ${item.detail}` : ""}`,
    `Quelle: ${SOURCE_DE[item.source]}, seit ${fmtDate(item.since)}`,
    `Verträge: ${productsOf(c).join(", ") || "keine"}`,
    `Kontakte in 12 Monaten: ${c.tickets12m}; letzte Bewertung: ${c.lastCsat ?? "keine"}`,
    `Offene Punkte: ${p.flags.map((f) => FLAG_DE[f.code] ?? f.code).join(", ") || "keine"}`,
    `Stil: ${styleSummary(s)}; Stimmung ${item.mood}`,
  ];
  if (item.reason) lines.push(`Kündigungsgrund: ${item.reason}`);
  if (item.endDate) lines.push(`Vertragsende: ${fmtDate(item.endDate)}`);
  const recent = c.tickets.slice(-3).map((t) => `${t.at} ${PORTAL.categories[t.category] ?? t.category}: ${t.text}`);
  if (recent.length) lines.push(`Letzte Tickets: ${recent.join(" | ")}`);
  if (chat.length) lines.push(`Chat: ${chat.slice(-6).map((l) => `${l.from === "kunde" ? "Kunde" : "Funki"}: ${l.text}`).join(" | ")}`);
  return lines.join("\n");
}

/** Template summary without AI – built only from case data. */
export function templateSummary(p: Profile, item: InboxItem): string {
  const c = p.raw;
  const parts = [
    `${item.title} seit ${fmtDate(item.since)} (${SOURCE_DE[item.source]}).`,
    item.detail ? `Kunde schreibt/meldet: „${item.detail.slice(0, 160)}${item.detail.length > 160 ? "…" : ""}“` : "",
    `${c.tickets12m} Kontakte in 12 Monaten${c.lastCsat !== null ? `, letzte Bewertung ${c.lastCsat}/5` : ""}. Stimmung: ${item.mood}.`,
    item.suggestion ? `Vorschlag: ${item.suggestion}` : p.nba.action === "CARE" ? `Engine: CARE – ${careCode(p)}, kein Verkauf.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function nextStep(p: Profile, item: InboxItem): string {
  if (item.filter === "proaktiv") return `Proaktiv: ${item.suggestion}`;
  if (item.filter === "kuendigung") return "CARE – CANCELLATION: Kündigung bestätigen, kein Verkauf. Halteangebot nur auf Wunsch.";
  if (p.nba.action === "CARE" || p.blockers.length) return `CARE – ${careCode(p)}, kein Verkauf.`;
  return "Anliegen klären. Kein Verkauf im Service-Kontakt.";
}

export function replyDraft(p: Profile, item: InboxItem): string {
  const s = styleOf(p.raw);
  const t = REPLY_TEMPLATES[item.filter] ?? REPLY_TEMPLATES.anliegen;
  return (s.anrede === "du" ? t.du : t.sie)
    .replace("{name}", placeholderFirstName(p.id))
    .replace("{end}", item.endDate ? fmtDate(item.endDate) : "zum nächstmöglichen Termin")
    .replace("{trigger}", item.trigger ?? item.title);
}
