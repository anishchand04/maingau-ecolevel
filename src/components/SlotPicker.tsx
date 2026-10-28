// Terminauswahl: zeigt nur freie Zeiten; „passt nicht“ schlägt die nächsten vor, am Ende bleibt „nach Absprache“.
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { countBookings, demoBookings, freeSlots, mergeBookings, type SlotKind } from "@/lib/slots";
import { PillButton } from "@/components/base/PillButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const SLOT_TEXT = {
  notFit: "Keiner dieser Termine passt",
  byArrangement: "Wunschzeit nach Absprache",
  byArrangementValue: "nach Absprache",
  exhausted: "Keine weiteren freien Termine in den nächsten Wochen.",
};
const PAGE = 3;

/** Freie Zeiten für `kind`, abzüglich dessen, was andere Kunden schon belegt haben. */
export function useFreeSlots(kind: SlotKind) {
  const callbacks = useStore((s) => s.callbacks);
  const appointments = useStore((s) => s.appointments);
  return useMemo(() => freeSlots(kind, mergeBookings(demoBookings(kind), countBookings([...Object.values(callbacks), ...Object.values(appointments)]))), [kind, callbacks, appointments]);
}

export function SlotPicker({ kind, onPick }: { kind: SlotKind; onPick: (slot: string) => void }) {
  const free = useFreeSlots(kind);
  const [page, setPage] = useState(0);
  const shown = free.slice(page * PAGE, page * PAGE + PAGE);
  const hasMore = (page + 1) * PAGE < free.length;
  return (
    <div>
      <ul className="space-y-2">
        {shown.map((slot) => (
          <li key={slot}><PillButton variant="outline" className="w-full justify-start" onClick={() => onPick(slot)}>{slot}</PillButton></li>
        ))}
      </ul>
      {!shown.length && <p className="type-small text-mg-muted">{SLOT_TEXT.exhausted}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {hasMore && <PillButton variant="ghost" onClick={() => setPage((p) => p + 1)}>{SLOT_TEXT.notFit}</PillButton>}
        {(page > 0 || !hasMore) && <PillButton variant="ghost" onClick={() => onPick(SLOT_TEXT.byArrangementValue)}>{SLOT_TEXT.byArrangement}</PillButton>}
      </div>
    </div>
  );
}

export function SlotDialog({ open, onOpenChange, kind, title, intro, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: SlotKind; title: string; intro?: string; onPick: (slot: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {intro && <DialogDescription>{intro}</DialogDescription>}
        </DialogHeader>
        <SlotPicker kind={kind} onPick={(s) => { onPick(s); onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}
