# Änderungen – NBA Engine Spec V2

## Neu
- **Kundenportal** `/portal` (war 404): Mein Zuhause, Meine Vorteile, Meine EcoJourney, Hilfe & Service.
  Keine CLV-/Churn-Werte, max. 1 Empfehlung, bei offenen Problemen Hilfe statt Angebot,
  nur von Marketing freigegebene Inhalte, freiwillige Fragen mit Begründung + Überspringen.
- **Gemeinsamer State** (`src/lib/live.ts`): Änderungen im Portal (Einwilligung, „Kein Interesse“,
  Kontakthäufigkeit, freiwillige Antworten) berechnen den Kunden sofort neu – auch im Marketing.
- **Audit & Tests**: 9 Guardrail-Tests live über alle 750 Kunden, Annahmen-Übersicht, Decision-Log-Download (.jsonl).
- **Konfiguration** `src/config/thresholds.ts` (Schwellen, Annahmen, Kundenbenefits, Statuslabels).
- **Tests** `src/test/guardrails.test.ts` (22 Tests inkl. 3 Live-Szenarien) → `npm test`.

## Korrigiert (Regelverstöße)
- Event-Stream vom 01.10. wird eingespielt (dedupliziert): Consent-Widerruf (MG-100003), Kündigung (MG-100510),
  Gaszähler-Abmeldung → StromWärme (MG-100125), Mahnung, neue Beschwerden.
- Mahnung ab Stufe 1 blockiert Verkauf. Zahlungsdaten nur noch als Ausschluss, nicht im Scoring.
- Ohne Profiling-Einwilligung: keine Verhaltensdaten, kein Clustering, keine Twins, Ton „Sie“, nur vertragsbasierte Angebote.
- Alter wird nicht mehr verwendet (Ton, Preisstabilität).
- Customer Benefit Gate, Status-Labels (computed / estimated / scenario).
- Bugs: dynamischer Tarif wurde nie empfohlen (`smart` statt `smart_meter_imsys`), Thermostate an Besitzer,
  Simulator-Absturz (JSON.stringify auf React-Elementen), Autostrom-Baseline der Alt-Engine (0 % wegen Fehl-Targeting).
- Cluster: k per Silhouette (3–8), Namen aus dominanten Bedürfnissen.
