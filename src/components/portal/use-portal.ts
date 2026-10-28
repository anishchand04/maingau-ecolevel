import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useProfile } from "@/lib/live";
import { styleOf } from "@/lib/style";
import { tx } from "@/lib/portal";
import { STANDARD_STYLE } from "@/config/style";
import type { DuSie } from "@/config/portal";

/** Current portal customer + their communication style (live consent, own override). */
export function usePortal() {
  const id = useStore((s) => s.portalCustomer);
  const p = useProfile(id);
  const override = useStore((s) => s.styleOverride[id]);
  const mood = useStore((s) => s.mood[id]);
  const style = useMemo(() => {
    if (!p) return STANDARD_STYLE;
    const base = styleOf(p.raw, override);
    // only the mood is updated live from new chat messages – and only with profiling consent
    return mood && p.profiling ? { ...base, stimmung: mood } : base;
  }, [p, override, mood]);
  const t = (d: DuSie) => tx(style, d);
  return { id, p, style, t };
}
