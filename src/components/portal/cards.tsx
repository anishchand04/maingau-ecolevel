// Mein-Zuhause building blocks: help card, the one recommendation, quick actions.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { fill, helpReasons, passendCards, recommendationState } from "@/lib/portal";
import { OFFER_TEXT } from "@/config/offers";
import { PORTAL } from "@/config/portal";
import { PillButton } from "@/components/base/PillButton";
import { SlotDialog, SlotPicker } from "@/components/SlotPicker";
import { Funki } from "@/components/funki/Funki";
import { cn } from "@/lib/utils";
import { ICONS, STROKE } from "./icons";
import { usePortal } from "./use-portal";

const H = PORTAL.help;
const R = PORTAL.recommendation;

/** Open problem → help first. While it is shown there are no offers and no tips. */
export function HelpCard() {
  const { p, t } = usePortal();
  const callback = useStore((s) => (p ? s.callbacks[p.id] : undefined));
  if (!p) return null;
  const reasons = helpReasons(p);
  if (!reasons.length) return null;
  const ask = (slot: string) => { actions.callback(p.id, slot); toast.success(H.callbackDone); };
  return (
    <section aria-labelledby="help-title" className="rounded-[24px] border-2 border-mg-navy bg-white p-6">
      <div className="flex items-start gap-4">
        <Funki mood="empathetic" size={56} className="hidden shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 id="help-title" className="type-section">{t(H.title)}</h2>
          <ul className="mt-3 space-y-2">
            {reasons.map((r) => H.reasons[r] && <li key={r}>{t(H.reasons[r])}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {callback ? (
              <p className="font-semibold">{H.callbackDone}: {callback}</p>
            ) : (
              <div className="w-full max-w-md"><SlotPicker kind="call" onPick={ask} /></div>
            )}
          </div>
          <p className="mt-4 type-small text-mg-muted">{t(H.noOffers)}</p>
        </div>
      </div>
    </section>
  );
}

/** "Ich habe Interesse" → employee consultation: pick one of the free slots. */
export function BookingDialog({ open, onOpenChange, productId }: { open: boolean; onOpenChange: (o: boolean) => void; productId: string }) {
  const { id, t } = usePortal();
  const book = (slot: string) => {
    actions.feedback(id, productId, "learn_more");
    actions.appointment(id, productId, slot);
    toast.success(t(R.bookToast));
  };
  return <SlotDialog open={open} onOpenChange={onOpenChange} kind="consult" title={R.bookTitle} intro={t(R.bookIntro)} onPick={book} />;
}

/** The ONE recommendation. Unapproved → dashed demo hint (invisible to real customers). */
export function RecommendationCard() {
  const { p, t } = usePortal();
  const decisions = useStore((s) => s.decisions);
  const given = useStore((s) => (p ? s.feedback[`${p.id}:${p.nba.productId}`] : undefined));
  const appointment = useStore((s) => (p ? s.appointments[`${p.id}:${p.nba.productId}`] : undefined));
  const [why, setWhy] = useState(false);
  const [booking, setBooking] = useState(false);
  if (!p) return null;
  const state = recommendationState(p, (cid, pid) => decisions[`${cid}:${pid}`]?.status);
  if (state === "none") return null;
  const nba = p.nba;
  if (state === "demo-hint") {
    return (
      <div className="rounded-[24px] border-2 border-dashed border-mg-line p-4 type-small text-mg-muted">
        {fill(R.demoHint, { product: nba.product })}{" "}
        <Link to="/marketing/recommendations" className="font-semibold text-mg-navy underline underline-offset-4">{R.demoLink}</Link>
      </div>
    );
  }
  const text = OFFER_TEXT[nba.productId];
  const send = (f: "not_interested" | "already_have" | "learn_more") => {
    actions.feedback(p.id, nba.productId, f);
    toast(f === "learn_more" ? t(R.moreDone) : t(R.thanks));
  };
  return (
    <section aria-labelledby="rec-title" className="rounded-[24px] bg-mg-surface p-6">
      <p className="type-small font-semibold text-mg-muted">{t(R.eyebrow)}</p>
      <h2 id="rec-title" className="mt-1 type-section">{text.title}</h2>
      <p className="mt-2 max-w-2xl">{t(text)}</p>
      <button type="button" aria-expanded={why} onClick={() => setWhy((w) => !w)}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-mg-navy focus-visible:outline-2 focus-visible:outline-mg-blue">
        <Info className="size-5" strokeWidth={STROKE} />{R.why}
        <ChevronDown className={cn("size-5 transition-transform duration-150", why && "rotate-180")} strokeWidth={STROKE} />
      </button>
      {why && <p className="max-w-2xl type-small text-mg-muted">{fill(t(R.whyText), { benefit: nba.benefitDe })}</p>}
      {appointment ? (
        <p className="mt-4 font-semibold">{t(R.bookDone)} {appointment}</p>
      ) : given ? (
        <p className="mt-4 font-semibold">{given === "learn_more" ? t(R.moreDone) : t(R.thanks)}</p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <PillButton onClick={() => setBooking(true)}>{R.interested}</PillButton>
          <PillButton variant="outline" onClick={() => send("not_interested")}>{R.notInterested}</PillButton>
          <PillButton variant="ghost" onClick={() => send("already_have")}>{R.haveIt}</PillButton>
        </div>
      )}
      <BookingDialog open={booking} onOpenChange={setBooking} productId={nba.productId} />
    </section>
  );
}

/** 4 big tiles. Self-service flows run in Funki's chat. */
export function QuickActions({ onInvoice }: { onInvoice: () => void }) {
  const navigate = useNavigate();
  const { id } = usePortal();
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="sr-only">{PORTAL.sections.quick}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PORTAL.quickActions.map((a) => {
          const Icon = ICONS[a.icon];
          const go = () => {
            if (a.id === "rechnung") onInvoice();
            else if (a.id === "hilfe") navigate({ to: "/portal/service" });
            else actions.openChat({ customerId: id, actionId: a.id });
          };
          return (
            <li key={a.id}>
              <button type="button" onClick={go}
                className="flex min-h-28 w-full cursor-pointer flex-col items-start justify-between gap-3 rounded-[24px] bg-mg-surface p-5 text-left font-semibold text-mg-navy transition-colors duration-150 ease-out hover:bg-[#e3ebf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
                <span className="grid size-11 place-items-center rounded-full bg-mg-yellow"><Icon className="size-6" strokeWidth={STROKE} /></span>
                {a.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Passt zu dir": max. 3 personal cards from the engine's eligible candidates – no banners, no countdowns. */
export function PassendCards({ detailed = false }: { detailed?: boolean }) {
  const { p, t } = usePortal();
  const feedback = useStore((s) => s.feedback);
  if (!p) return null;
  const cards = passendCards(p).filter((k) => !feedback[`${p.id}:${k.rec.productId}`]);
  if (!cards.length) return null;
  const P = PORTAL.passend;
  const send = (pid: string, f: "learn_more" | "not_interested") => {
    actions.feedback(p.id, pid, f);
    toast(t(f === "learn_more" ? P.moreDone : P.noDone));
  };
  return (
    <section aria-labelledby="passend-title">
      <h2 id="passend-title" className="type-section">{t(P.title)}</h2>
      <p className="mt-1 text-mg-muted">{t(detailed ? P.introLong : P.intro)}</p>
      <ul className={cn("mt-4 grid gap-3", cards.length > 1 && "md:grid-cols-2", cards.length > 2 && "lg:grid-cols-3")}>
        {cards.map((k) => (
          <li key={k.rec.productId} className="flex flex-col rounded-[24px] border-2 border-mg-line p-5">
            <p className="font-bold">{OFFER_TEXT[k.rec.productId]?.title ?? k.rec.product}</p>
            <p className="mt-2">{t(k.reason)}</p>
            {detailed && <p className="mt-2 type-small text-mg-muted"><span className="font-semibold">{P.benefit}: </span>{k.rec.benefitDe}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <PillButton size="sm" variant="outline" onClick={() => send(k.rec.productId, "learn_more")}>{P.more}</PillButton>
              <PillButton size="sm" variant="ghost" onClick={() => send(k.rec.productId, "not_interested")}>{P.no}</PillButton>
            </div>
          </li>
        ))}
      </ul>
      {detailed && <a href={P.shopUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-12 items-center font-semibold text-mg-navy underline underline-offset-4">{P.shopLink}</a>}
    </section>
  );
}
