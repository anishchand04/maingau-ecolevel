// Global V3 data from maingau.json that the engine does not use.
import raw from "@/data/maingau.json";
import type { ServiceStats } from "@/lib/data-types";

/** Ø handling cost, first-contact resolution and ticket count per category – basis of every relief estimate. */
export const SERVICE_STATS = (raw as unknown as { serviceStats: ServiceStats }).serviceStats;

export type Reaction = { n: number; converted: number; dismissed: number; ignored: number; engaged: number };
/** Reactions to past recommendations + control group (observed, not causal) and the CLV method label. */
export const NBA_STATS = (raw as unknown as { nbaStats: { byChannel: Record<string, Reaction>; treated: Reaction; control: Reaction; clvMethod: string } }).nbaStats;
