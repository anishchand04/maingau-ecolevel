// Mein Eco-Zuhause (Master-Prompt §4b): kundenfreundlicher Anreiz-Score, getrennt vom internen EcoLevel.
// Kulant: faire Grundpunktzahl, Punkte für Handlungen, Besitz nur als kleiner Bonus, der Score sinkt nie,
// kein Vergleich mit anderen Kunden. Verhaltensdaten nur mit Einwilligung – ohne nur Selbstangaben.

export const ECO_BASE = 40;
export const ECO_MAX = 100;

export type EcoAction = { id: string; label: string; points: number; step: string; source: "daten" | "selbst" };

/** Handlungen, die aus den eigenen Daten erkannt werden (nur mit profiling_analytics). */
export const DATA_ACTIONS: EcoAction[] = [
  { id: "zaehler_digital", label: "Zählerstand digital gemeldet", points: 8, step: "Zählerstand digital melden", source: "daten" },
  { id: "laden_guenstig", label: "Auto meist zu günstigen Zeiten geladen (mittags oder nachts)", points: 8, step: "Auto öfter mittags oder nachts laden", source: "daten" },
  { id: "eigenverbrauch", label: "Viel eigenen Solarstrom selbst genutzt", points: 8, step: "Eigenverbrauch mit dem HEMS erhöhen", source: "daten" },
  { id: "app", label: "Verbrauch im Blick mit der MAINGAU-App", points: 3, step: "MAINGAU-App nutzen", source: "daten" },
];

/** Selbstangaben – zählen immer, auch ohne Einwilligung. */
export const SELF_ACTIONS: EcoAction[] = [
  { id: "e_rechnung", label: "Ich nutze die E-Rechnung", points: 5, step: "E-Rechnung aktivieren", source: "selbst" },
  { id: "sparsam_heizen", label: "Ich heize sparsam (höchstens 20 °C)", points: 3, step: "Angeben, ob du sparsam heizt", source: "selbst" },
  { id: "waesche_30", label: "Ich wasche meist bei 30 °C", points: 3, step: "Angeben, wie warm du wäschst", source: "selbst" },
  { id: "standby_aus", label: "Ich schalte Geräte ganz aus statt Stand-by", points: 3, step: "Stand-by-Geräte ausschalten", source: "selbst" },
  { id: "spartipp", label: "Ich habe einen Spartipp von Funki umgesetzt", points: 4, step: "Einen Spartipp umsetzen", source: "selbst" },
];

/** Besitz gibt höchstens einen kleinen Bonus – Mieter ohne Dach haben dieselben Chancen. */
export const OWNERSHIP_BONUS = { perItem: 2, max: 6 };

/** Schwellen: Anteil günstiger Ladezeiten bzw. Eigenverbrauchsquote. */
export const ECO_THRESHOLDS = { cheapChargingShare: 0.5, selfConsumption: 0.4 };

export const ECO_LEVELS = [
  { min: 40, name: "Glühwürmchen", reward: "Beispiel: Willkommensgruß von Funki" },
  { min: 55, name: "Sonnenfänger", reward: "Beispiel: Gutschein aus der Vorteilswelt" },
  { min: 70, name: "Energiesparer", reward: "Beispiel: Ein Baum wird für dich gepflanzt" },
  { min: 85, name: "Eco-Zuhause-Profi", reward: "Beispiel: Smart-Plug-Set aus dem Shop" },
] as const;

export const ECO_TEXT = {
  title: "Mein Eco-Zuhause",
  intro: { du: "Punkte für das, was du für ein nachhaltiges Zuhause tust. Der Stand sinkt nie und wird mit niemandem verglichen.", sie: "Punkte für das, was Sie für ein nachhaltiges Zuhause tun. Der Stand sinkt nie und wird mit niemandem verglichen." },
  of: "von 100",
  next: { du: "Noch {n} Punkte bis „{level}“: {step}", sie: "Noch {n} Punkte bis „{level}“: {step}" },
  top: { du: "Höchste Stufe erreicht – stark!", sie: "Höchste Stufe erreicht – stark!" },
  base: "Grundpunkte für alle",
  bonus: "Bonus für Geräte und Tarife (höchstens 6)",
  earned: "Schon gesammelt",
  open: "Hier kannst du noch punkten",
  openSie: "Hier können Sie noch punkten",
  selfTitle: "Deine Angaben",
  selfTitleSie: "Ihre Angaben",
  selfHint: "Freiwillig – zählt sofort.",
  rewardNote: "Prämien sind Beispiele, keine Zusage.",
  noConsent: { du: "Ohne Einwilligung zur Personalisierung zählen nur deine eigenen Angaben.", sie: "Ohne Einwilligung zur Personalisierung zählen nur Ihre eigenen Angaben." },
  off: { du: "Mein Eco-Zuhause ist ausgeschaltet. Du kannst es in den Einstellungen einschalten.", sie: "Mein Eco-Zuhause ist ausgeschaltet. Sie können es in den Einstellungen einschalten." },
  settingTitle: "Mein Eco-Zuhause",
  settingText: "Punkte für nachhaltige Gewohnheiten. Nutzt eigene Daten nur mit Einwilligung zur Personalisierung.",
  tileCta: "Ansehen",
  points: "Punkte",
};
