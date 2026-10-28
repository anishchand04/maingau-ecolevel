# MAINGAU EcoLevel

Hackathon-Demo: bedarfsorientierte Next Best Actions für MAINGAU. Eine gemeinsame Entscheidungs-Engine (SELL / CARE / WAIT), zwei Oberflächen:

- **Kundenportal** (`/portal`): MAINGAU-Markendesign, Verträge, Vorteile, EcoJourney, Hilfe & Service.
- **Intern**: ruhiges Arbeitswerkzeug, 6 Ansichten.
  - Marketing (`/marketing`): Übersicht · Kunden · Empfehlungen (inkl. Stellschrauben und Wirkung) · Simulation & Analyse (inkl. Guardrail-Tests und Audit-Log)
  - Service (`/service`): Eingang (inkl. „Proaktiv“) · Fallansicht

> Entstanden im Team beim FUTURY × MAINGAU Hackathon in Frankfurt.

Alle Daten sind synthetisch (750 Kunden, Snapshot 30.09.2026, Event-Stream 01.10.2026). Es wird nichts echt versendet; Änderungen bleiben im Browser (localStorage).

## Start

```bash
npm install
npm run dev     # Adresse steht in der Konsole
npm test        # Engine- und Guardrail-Tests
```

Daten neu erzeugen (optional, braucht pandas + openpyxl):

```bash
python3 -m venv .venv && .venv/bin/pip install pandas openpyxl
.venv/bin/python scripts/prepare_data.py   # liest data/raw/, schreibt src/data/maingau.json
```

Wetter je Wohnort (einmalig, braucht Internet; die App selbst lädt nie Wetterdaten):

```bash
.venv/bin/python scripts/fetch_weather.py   # Open-Meteo → src/data/weather.json (Globalstrahlung, Heizgradtage G20/15)
```

Das Skript `prepare_data.py` berechnet auch das Kommunikationsstil-Profil je Kunde (regelbasiert, nur mit Einwilligung zur Profilbildung) und `serviceStats` (Ø Bearbeitungskosten, Erstlösungsquote je Kategorie).

### Funki mit KI (optional)

Funki funktioniert ohne KI vollständig (feste Antworten aus `src/config/faq.ts`, Self-Service-Abläufe aus `src/config/selfService.ts`).
Für KI-Antworten den Schlüssel nur serverseitig setzen und in der Demo-Leiste „KI-Antworten“ einschalten:

```bash
ANTHROPIC_API_KEY=… npm run dev
```

Modell `claude-haiku-5-5`, max. 400 Token, letzte 6 Nachrichten. Der Kontext enthält nie CLV, Churn, Cluster oder Scores (Test in `src/test/chat.test.ts`).

## Demo-Ablauf (3 Minuten)

`npm run dev`, dann **`/demo`** öffnen: links das Kundenportal, rechts dieselbe Person intern (Marketing-Kundenakte oder Service-Fall). Beide Seiten teilen einen Zustand und synchronisieren sich sofort. Vorher einmal **„Alles zurücksetzen“**.

| Zeit | Szenario (Leiste oben) | Was zeigen | Kernaussage |
| --- | --- | --- | --- |
| 0:00 | **Autostrom ohne Hausstrom** | Links: Begrüßung, Verträge, gestrichelter Hinweis „sichtbar erst nach Freigabe“. Rechts: NBA *SELL Hausstrom* mit Begründung. Im Tab rechts *Empfehlungen* → **Freigeben**. Links erscheinen Push-Vorschau und Empfehlungskarte. | Mensch gibt frei, Kunde sieht genau eine Empfehlung. |
| 0:40 | **Preisgarantie läuft aus** | Links: „Ihre Preisgarantie endet in … Tagen“. Funki öffnen → „Preisgarantie verlängern“ → bestätigen. Rechts verschwindet die Rückhalte-Empfehlung, die Engine schlägt das nächste passende Angebot vor. | Auslaufende Garantie + hoher Wert erkennt die Engine selbst; Self-Service ohne Wartezeit. |
| 1:20 | **Ladeproblem blockiert Angebot** | Links: Hilfe-Karte statt Angebot, Funki gedimmt. Rechts: Service-Fall *CARE – CHARGING_FAILURES*, Zeitleiste mit Gesprächsprotokoll, Antwortentwurf im Kundenstil. **Fall lösen** für beide offenen Fälle (Ticket und Ladeabbrüche) → Sperre fällt, links verschwindet die Hilfe-Karte. | Erst helfen, dann verkaufen – technisch erzwungen. |
| 2:00 | **Kündigung per Chat** → **Abspielen** | Links: Funki nimmt die Kündigung auf, zwei Klicks bis zur Bestätigung mit Frist und Enddatum, Grund freiwillig danach. Rechts wechselt der Service-Fall live zur Kündigung. | § 312k BGB: nie blockiert, sofort bestätigt. |
| 2:30 | **Werbung abbestellt per Chat** → **Abspielen** → *Übernehmen* | Rechts springt die NBA von SELL auf WAIT. | Einwilligung schlägt jede Verkaufschance. |
| 2:50 | *Simulation & Analyse → Guardrail-Tests* | 9 von 9 erfüllt, live über 750 Kunden; Audit-Log als JSONL. | Nachvollziehbar und prüfbar. |

Weitere Szenarien: **Gaszähler abgemeldet** (heutiges Ereignis → Wärmepumpen-Tarif), **Personalisierung widerrufen** (nur Vertragsdaten, Anrede „Sie“).

## Was nie passieren darf – und wo es getestet wird

| Guardrail | Test |
| --- | --- |
| Kein SELL bei Beschwerde, Kündigung, Mahnung, Störung, fehlender Einwilligung, über Kontaktlimit | `guardrails.test.ts` (G1–G9 über alle 750 Kunden), `guardrails.v3.test.ts` (mit Live-Fällen und Stellschrauben) |
| Kein CLV/Churn/Score im Portal oder im Chat-Kontext | `portal.test.ts`, `chat.test.ts` (inkl. Unabhängigkeitstest) |
| Max. eine prominente Empfehlung; keine Empfehlung/Tipps bei offenem Problem | `portal.test.ts`, `chat.test.ts` |
| Kündigung in ≤ 3 Klicks, unabhängig von der Grund-Frage | `chat.test.ts` (alle Kunden mit Vertrag) |
| Stilprofil ändert die Empfehlung nicht; ohne Profiling-Einwilligung kein „Du“ | `data.test.ts` |
| Keine erfundenen Euro-Ersparnisse; jede Schätzung trägt einen Status | `guardrails.v3.test.ts`, Status-Badges *berechnet / geschätzt / simuliert / Annahme* |
| Stellschrauben können Guardrails nicht aufweichen | `internal.test.ts`, `guardrails.v3.test.ts` |
| „Passt zu dir“ max. 3 Karten mit Begründung; Mein Eco-Zuhause sinkt nie, Besitz nur Bonus | `context.test.ts`, `portal3.test.ts` |
| Region/Wetter verschlechtert nie Angebote oder Service-Priorität; keine Wetter-API zur Laufzeit | `context.test.ts` (Fairness-Test) |
| Kein Kontrollgruppen-Vergleich ohne „beobachtet – kein kausaler Nachweis“ | `guardrails.v3.test.ts` (Render-Test) |

## Architektur

| Bereich | Ort |
| --- | --- |
| Entscheidungslogik, Need Vectors, Cluster, Twins, Gatekeeper, ΔCLV | `src/lib/engine.ts` |
| Gemeinsamer State (localStorage) | `src/lib/store.ts`, `src/lib/live.ts` |
| Schwellen, Annahmen, Texte | `src/config/` |
| Design-Tokens Portal / Intern | `src/styles/portal.css` (`.theme-portal`), `src/styles/internal.css` (`.theme-internal`) |
| Basis-Komponenten | `src/components/base/` |
| Maskottchen Funki, Chat | `src/components/funki/`, `src/lib/chat.ts`, Serverfunktion `src/lib/funkiAi.ts` |
| Region & Wetter, „Passt zu dir“, Mobilfunk-Hinweise | `src/engine/context.ts` (2 markierte Haken in `engine.ts`), `src/config/region.ts`, `src/config/shopRules.ts` |
| Detailansichten, Rechnungs-PDFs (`@react-pdf/renderer`, nachgeladen) | `src/components/portal/ContractDetail.tsx`, `InvoicePdf.tsx`, `src/lib/invoices.ts`, `src/config/details.ts` |
| Mein Eco-Zuhause (sinkt nie, Besitz nur Bonus) | `src/lib/ecoHome.ts`, `src/config/ecoHome.ts`, `src/components/portal/eco-home.tsx` |
| Stellschrauben (nur verschärfen) | `src/lib/tuning.ts`, `src/config/tuning.ts` |
| Service-Eingang, Fallzusammenfassung | `src/lib/inbox.ts`, `src/lib/caseSummary.ts`, `src/config/service.ts` |
| Self-Service-Fälle → Engine | `src/lib/cases.ts` (vor der Neuberechnung angewendet), `src/lib/selfServiceRun.ts` |
| Demo-Split-Screen, Szenarien | `src/routes/demo.tsx`, `src/config/demo.ts`; Tab-/iframe-Sync per `storage`-Event in `src/lib/store.ts` |
| Seiten (dateibasiertes Routing) | `src/routes/` |
| Tests | `src/test/` |

Stack: React 19, TypeScript, TanStack Start, Tailwind v4, shadcn/ui, Recharts, lucide-react.

## Learn: wie die Engine über die Zeit besser wird

Die Engine reagiert sofort auf neue Kundendaten (Einwilligung, Beschwerde, Ereignis), das ist reine Neuberechnung. **Lernen** heißt etwas anderes: Sie ändert ihre Schätzungen, weil sie Ergebnisse gesehen hat. Umgesetzt als Prototyp im Browser unter *Empfehlungen → Wirkung → Lernen* (`src/lib/learning.ts`, `src/components/internal/Learning.tsx`).

Die Schleife:

1. **Entscheiden und loggen.** Die Engine wählt die Aktion. Änderungen einer Entscheidung stehen im Audit-Log (alt → neu, mit Begründung).
2. **Holdout.** Marketing wählt einen Anteil (5/10/20 %, Standard aus). Von den ohnehin berechtigten SELL-Empfehlungen erhält dieser Anteil per festem Zufallscode je Kunde die Aktion bewusst nicht. CARE, WAIT, gesperrte Kunden und Kunden ohne Einwilligung sind nie betroffen.
3. **Ergebnis erfassen.** Freigaben (Behandlung) und Zurückgehaltene (Kontrolle) werden als offene Ergebnisse gespeichert, mit Engine-Version. Kundenrückmeldungen schließen sie. In der Demo werden Abschlüsse simuliert (aus der Basisquote, als *simuliert* markiert).
4. **Uplift.** Quote Behandelte minus Quote Kontrolle je Angebot, mit 95-%-Intervall. Unter 100 Kontrollkunden oder 10 Abschlüssen gibt es keine Wirkungsaussage. Nur dieser randomisierte Vergleich darf Wirkung belegen; der historische Vergleich bleibt „beobachtet – kein kausaler Nachweis“.
5. **Neue Raten als Vorschlag.** Annahmequoten je Angebot und Kanal werden mit Shrinkage zum bisherigen Wert geschätzt (wenig Daten → kleine Änderung), höchstens ±30 % je Schritt, nur aus Live-Ergebnissen (die historischen Quoten stecken schon im Ausgangswert).
6. **Freigabe, Version, Rollback.** Ein Vorschlag ändert nichts, bis Marketing ihn freigibt. Jede Version trägt eine ID (`ecolevel-nba-v2.0+L1`), alles steht im Audit-Log, ein Klick rollt zurück.

**Automatisch (Standard, Schalter „Automatisch lernen“):** Solange der Lernen-Bereich offen ist, verarbeitet die Demo alle paar Sekunden die nächsten Kunden mit Empfehlung (mit mindestens 10 % Zufalls-Holdout), schließt die Ergebnisse mit simuliertem Verhalten und aktiviert nach je 30 neuen Ergebnissen selbst eine neue Version. Widersprechen die Ergebnisse unter einer Version ihrer Änderung (95-%-Intervall), rollt die Engine selbst zurück und schlägt dieselbe Änderung nicht noch einmal vor. Zwei Live-Diagramme zeigen den Verlauf: der mittlere Abstand der Annahmen von den tatsächlichen Quoten (fällt, wenn die Engine lernt) und eine einzelne Annahmequote im Detail. In der Demo kennt nur die Simulation die „tatsächliche“ Quote (Basisquote mal ein fester Faktor); die Engine nähert sich ihr nur über Ergebnisse an. Ausgeschaltet gilt wieder: jede Version braucht eine Freigabe.

Was Lernen **nicht** darf: Regeln, Einwilligungen, Kontaktlimits oder Guardrails ändern. Lernen verändert nur `p(accept)`. Ein Test prüft G1–G9 mit Extremwerten (`src/test/learning.test.ts`).

Grenzen: Die vorhandene Kontrollgruppe ist klein (248 Kunden, 5 Abschlüsse), deshalb zeigt die Auswertung bei vielen Angeboten „zu wenig Daten“. Echte Abschlüsse, mehrere Nutzer und ein manipulationssicheres Log brauchen die Datenbank aus der Roadmap. Der Uplift wird noch nicht selbst als `p(accept)` verwendet, die Entscheidung läuft weiter über die Annahmequote.

## Phase 2 / weitere Datenquellen

Nicht im Datensatz und daher bewusst nicht angezeigt: Neukunden pro Akquisekanal, CAC und CAC/CLV, Win-back-Quote, geplante Preisanpassungen, Vorjahresvergleich.
