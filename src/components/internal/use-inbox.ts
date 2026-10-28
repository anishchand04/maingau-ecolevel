import { useMemo } from "react";
import { useProfiles } from "@/lib/live";
import { useStore } from "@/lib/store";
import { buildInbox } from "@/lib/inbox";
import { SERVICE_STATS } from "@/lib/data";
import { MINUTES_PER_CASE, SELF_SERVICE_CATEGORY } from "@/config/service";

export function useInbox() {
  const profiles = useProfiles();
  const cases = useStore((s) => s.cases);
  const mood = useStore((s) => s.mood);
  const resolved = useStore((s) => s.resolved);
  const audit = useStore((s) => s.audit);
  const items = useMemo(() => buildInbox(profiles, cases, mood, resolved), [profiles, cases, mood, resolved]);

  // Routine matters Funki closed without a human – and what they would have cost (dataset averages).
  const relief = useMemo(() => {
    const done = audit.filter((a) => a.actor === "Kunde über Funki" && SELF_SERVICE_CATEGORY[a.action]);
    const eur = done.reduce((s, a) => s + (SERVICE_STATS.byCategory[SELF_SERVICE_CATEGORY[a.action]]?.avgHandlingCostEur ?? SERVICE_STATS.avgHandlingCostEur), 0);
    return { count: done.length, eur, minutes: done.length * MINUTES_PER_CASE };
  }, [audit]);
  const handovers = cases.filter((k) => k.source === "uebergabe").length;
  return { profiles, items, relief, handovers };
}
