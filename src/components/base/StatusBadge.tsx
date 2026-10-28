import { DATA_STATUS, DECISION_STATUS, type DataStatus, type DecisionStatus } from "@/config/labels";
import { cn } from "@/lib/utils";

const DATA_TONE: Record<DataStatus, string> = {
  berechnet: "border-foreground/30 text-foreground",
  geschaetzt: "border-dashed border-foreground/40 text-muted-foreground",
  simuliert: "border-dashed border-foreground/40 text-muted-foreground",
  annahme: "border-dotted border-foreground/40 text-muted-foreground",
};

/** Herkunft einer Zahl (berechnet / geschätzt / simuliert / Annahme). */
export function DataBadge({ status, className }: { status: DataStatus; className?: string }) {
  const s = DATA_STATUS[status];
  return (
    <span title={s.hint} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4", DATA_TONE[status], className)}>
      {s.label}
    </span>
  );
}

const DECISION_TONE: Record<DecisionStatus, string> = {
  CARE: "bg-status-care text-white",
  SELL: "bg-status-sell text-white",
  WAIT: "bg-status-wait/15 text-status-wait",
};

/** Engine-Entscheidung – nur intern verwenden, nie im Portal. */
export function DecisionBadge({ status, className }: { status: DecisionStatus; className?: string }) {
  const s = DECISION_STATUS[status];
  return (
    <span title={s.hint} className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide tabular-nums", DECISION_TONE[status], className)}>
      {s.label}
    </span>
  );
}
