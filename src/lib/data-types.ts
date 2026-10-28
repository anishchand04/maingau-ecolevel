// Types for the fields added to src/data/maingau.json in V3 (scripts/prepare_data.py).
// Kept apart from engine.ts: the engine never reads these fields for its decision.

export type Transcript = { id: string; ticketId: string; at: string; durationS: number | null; text: string };

export type DailyTelemetry = {
  date: string; household: number | null; pv: number | null; gridImport: number | null;
  gridExport: number | null; ev: number | null; heatPump: number | null;
};
export type ChargingMonth = { month: string; kwh: number; sessions: number; failed: number; eur?: number };
export type Consumption = { daily: DailyTelemetry[]; chargingMonthly: ChargingMonth[] };

export type PortalPage = { page: string; count: number };

/**
 * Kommunikationsstil (Master-Prompt §6). Changes only HOW we write, never WHAT we offer.
 * status "standard" = no profiling consent → neutral defaults, no analysis.
 */
export type StyleProfile = {
  anrede: "du" | "sie";
  laenge: "kurz" | "ausführlich";
  ton: "sachlich" | "herzlich";
  fachwissen: "einfach" | "fachlich";
  stimmung: "zufrieden" | "neutral" | "verärgert";
  belege: string[];
  quelle: string;
  status: "abgeleitet" | "standard" | "vom Kunden geändert";
};

export type ServiceCategoryStats = { tickets: number; avgHandlingCostEur: number; firstContactResolutionRate: number };
export type ServiceStats = ServiceCategoryStats & { byCategory: Record<string, ServiceCategoryStats> };

export type ShopOrder = { id: string; at: string; product: string; category: string | null; quantity: number; valueEur: number | null; status: string };

export type CityWeather = { lat: number; lon: number; geocoded: string; radiationKwhM2: number; sunshineHoursRaw: number; heatingDegreeDays: number; days: number };
export type WeatherData = { period: { from: string; to: string }; source: string; heatingDegreeDays: string; cities: Record<string, CityWeather> };
