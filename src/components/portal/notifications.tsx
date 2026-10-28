// Simulated notifications: bell list + phone-style push preview (4 s). Nothing is sent.
import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { notificationsOf, tx, type PortalNote } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PillButton } from "@/components/base/PillButton";
import { EmptyState } from "@/components/base/EmptyState";
import { cn } from "@/lib/utils";
import { STROKE } from "./icons";
import { usePortal } from "./use-portal";
import { BookingDialog } from "./cards";

const N = PORTAL.notifications;
const PUSH_MS = 4000;

function useNotes(): PortalNote[] {
  const { p, style } = usePortal();
  const decisions = useStore((s) => s.decisions);
  const feedback = useStore((s) => s.feedback);
  const callback = useStore((s) => (p ? s.callbacks[p.id] : undefined));
  const cases = useStore((s) => s.cases);
  return useMemo(() => (p ? notificationsOf(p, style, {
    decision: (cid, pid) => decisions[`${cid}:${pid}`]?.status,
    feedback: (pid) => feedback[`${p.id}:${pid}`],
    callback,
    solved: cases.filter((k) => k.customerId === p.id && k.status === "solved").map((k) => k.id),
  }) : []), [p, style, decisions, feedback, callback, cases]);
}

function OfferButtons({ note, onInterested, onDone }: { note: PortalNote; onInterested: (productId: string) => void; onDone?: () => void }) {
  const { id, style } = usePortal();
  if (note.kind !== "offer" || !note.productId) return null;
  const r = PORTAL.recommendation;
  const send = (f: "not_interested" | "already_have") => {
    actions.feedback(id, note.productId!, f);
    toast(tx(style, r.thanks));
    onDone?.();
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <PillButton size="sm" onClick={() => { onInterested(note.productId!); onDone?.(); }}>{r.interested}</PillButton>
      <PillButton size="sm" variant="outline" onClick={() => send("not_interested")}>{r.notInterested}</PillButton>
      <PillButton size="sm" variant="ghost" onClick={() => send("already_have")}>{r.haveIt}</PillButton>
    </div>
  );
}

export function NotificationBell() {
  const { id } = usePortal();
  const notes = useNotes();
  const read = useStore((s) => s.readNotes[id]);
  const unread = notes.filter((n) => !read?.includes(n.id)).length;
  const [open, setOpen] = useState(false);
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) actions.markNotes("readNotes", id, notes.map((n) => n.id)); }}>
        <PopoverTrigger aria-label={unread ? `${N.open} (${N.unread.replace("{n}", String(unread))})` : N.open}
          className="relative grid size-12 cursor-pointer place-items-center rounded-full text-mg-navy hover:bg-mg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
          <Bell className="size-6" strokeWidth={STROKE} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-mg-blue px-1 text-xs font-bold leading-5 text-white tabular-nums">{unread}</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="theme-portal w-[min(92vw,380px)] rounded-[24px] border-mg-line p-2">
          <p className="px-3 pt-2 pb-1 font-bold">{N.title}</p>
          {notes.length ? (
            <ul className="divide-y divide-mg-line">
              {notes.map((n) => (
                <li key={n.id} className="px-3 py-3">
                  <p className="text-[15px] leading-[22px]">{n.text}</p>
                  <OfferButtons note={n} onInterested={(pid) => { setOpen(false); setBookingFor(pid); }} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title={N.empty} text={N.emptyText} funki="idle" className="py-6" />}
        </PopoverContent>
      </Popover>
      <PushPreview notes={notes} onInterested={setBookingFor} />
      <BookingDialog open={!!bookingFor} onOpenChange={(o) => { if (!o) setBookingFor(null); }} productId={bookingFor ?? ""} />
    </>
  );
}

/** New notes appear once as a push preview, top right, for 4 s (closable). */
function PushPreview({ notes, onInterested }: { notes: PortalNote[]; onInterested: (productId: string) => void }) {
  const { id } = usePortal();
  const seen = useStore((s) => s.seenNotes[id]);
  const [current, setCurrent] = useState<PortalNote | null>(null);

  useEffect(() => {
    if (current) return;
    const next = notes.find((n) => !seen?.includes(n.id));
    if (!next) return;
    setCurrent(next);
    actions.markNotes("seenNotes", id, [next.id]);
  }, [notes, seen, current, id]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), PUSH_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <div role="status" aria-live="polite"
      className={cn("fixed top-3 right-3 left-3 z-50 rounded-[20px] border border-mg-line bg-white p-4 shadow-[0_8px_24px_-12px_rgba(11,42,91,0.35)] sm:left-auto sm:w-[360px]",
        "animate-in fade-in slide-in-from-top-2 duration-200 ease-out")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-mg-yellow font-extrabold text-mg-navy">+</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mg-muted">{N.pushFrom}</p>
          <p className="text-[15px] leading-[22px] text-mg-navy">{current.text}</p>
          <OfferButtons note={current} onInterested={onInterested} onDone={() => setCurrent(null)} />
        </div>
        <button type="button" onClick={() => setCurrent(null)} aria-label={N.close}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-mg-navy hover:bg-mg-surface focus-visible:outline-2 focus-visible:outline-mg-blue">
          <X className="size-5" strokeWidth={STROKE} />
        </button>
      </div>
    </div>
  );
}
