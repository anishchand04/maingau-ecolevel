// Feste Demo-Szenarien (Master-Prompt §8). "play" stößt im Portal den passenden Funki-Ablauf an.
export type DemoScenario = {
  id: string; customer: string; label: string; hint: string;
  right: "marketing" | "service";
  play?: { draft?: string; actionId?: string };
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  { id: "autostrom", customer: "MG-100332", label: "Autostrom ohne Hausstrom", right: "marketing",
    hint: "Engine empfiehlt Hausstrom. Rechts freigeben → links erscheint die Empfehlung samt Push." },
  { id: "preisgarantie", customer: "MG-100010", label: "Preisgarantie läuft aus", right: "marketing",
    hint: "Hoher Wert + auslaufende Garantie = Rückhaltung. Im Portal per Funki verlängern → Marketing rechnet neu." },
  { id: "ladeproblem", customer: "MG-100009", label: "Ladeproblem blockiert Angebot", right: "service",
    hint: "Beschwerde → CARE, links nur Hilfe. Rechts „Fall lösen“ → Verkaufssperre fällt." },
  { id: "gas", customer: "MG-100125", label: "Gaszähler abgemeldet", right: "marketing",
    hint: "Heutiges Ereignis: Gaszähler abgemeldet → Wärmepumpen-Tarif statt Gas." },
  { id: "profiling", customer: "MG-100003", label: "Personalisierung widerrufen", right: "marketing",
    hint: "Kein Profiling: nur Vertragsdaten, kein Cluster, Anrede „Sie“." },
  { id: "kuendigung", customer: "MG-100010", label: "Kündigung per Chat", right: "service",
    hint: "„Abspielen“ öffnet Funki mit der Kündigung. Zwei Klicks bis zur Bestätigung, rechts erscheint der CARE-Fall.",
    play: { draft: "Ich möchte meinen Stromvertrag kündigen." } },
  { id: "werbung", customer: "MG-100332", label: "Werbung abbestellt per Chat", right: "marketing",
    hint: "„Abspielen“ öffnet den Ablauf „Werbung und Kontakt“. Nach dem Abbestellen fällt rechts SELL weg.",
    play: { actionId: "einwilligungen" } },
];

export const DEMO_TEXT = {
  title: "Demo",
  sub: "Links das Kundenportal, rechts dieselbe Person intern. Beide Seiten teilen einen Zustand und reagieren sofort.",
  play: "Abspielen",
  reset: "Alles zurücksetzen",
  resetDone: "Demo zurückgesetzt",
  rightMarketing: "Marketing-Kundenakte",
  rightService: "Service-Fall",
  portal: "Kundenportal",
  open: "In eigenem Tab öffnen",
};
