// Texte der Einstiegsseite (Demo-Auswahl).
export const START = {
  title: "MAINGAU EcoLevel",
  metaDescription: "Bedarfsorientierte Next Best Actions für MAINGAU – Kundenportal und interne Arbeitsoberfläche.",
  intro: "Demo mit synthetischen Daten. Eine gemeinsame Engine, zwei Oberflächen: das Kundenportal und das interne Werkzeug für Marketing und Service.",
  entries: [
    { to: "/portal", title: "Kundenportal", text: "Meine MAINGAU aus Kundensicht: Verträge, Vorteile, EcoJourney, Hilfe und Funki.", cta: "Als Kunde öffnen" },
    { to: "/marketing", title: "Intern: Marketing", text: "Segmente, Empfehlungen zur Freigabe, Wirkung und Simulation.", cta: "Als Marketing öffnen" },
    { to: "/service", title: "Intern: Service", text: "Eingang nach Dringlichkeit, Fälle mit Zeitleiste und Antwortentwurf.", cta: "Als Service öffnen" },
    { to: "/demo", title: "Demo", text: "Portal und interne Sicht nebeneinander, mit festen Szenarien.", cta: "Demo starten" },
  ],
  footnote: "Keine echten Kundendaten. Werte sind transparente Heuristiken, keine validierten Vorhersagen. Änderungen werden nur in diesem Browser gespeichert.",
  customersLabel: "Kunden im Datensatz",
} as const;
