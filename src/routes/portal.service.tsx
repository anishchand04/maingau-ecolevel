import { createFileRoute } from "@tanstack/react-router";
import { Check, MessageCircle, Phone, PhoneCall, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { actions, useStore } from "@/lib/store";
import { fill, fmtDate, hasOpenProblem } from "@/lib/portal";
import { PORTAL } from "@/config/portal";
import { SELF_SERVICE } from "@/config/selfService";
import { EMPTY_STATES } from "@/config/labels";
import { PillButton } from "@/components/base/PillButton";
import { EmptyState } from "@/components/base/EmptyState";
import { Switch } from "@/components/ui/switch";
import { HelpCard } from "@/components/portal/cards";
import { SlotDialog } from "@/components/SlotPicker";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { INVOICE_TEXT } from "@/config/details";
import { ECO_TEXT } from "@/config/ecoHome";
import { ICONS, STROKE } from "@/components/portal/icons";
import { usePortal } from "@/components/portal/use-portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/service")({ component: Service });

const S = PORTAL.service;
const cat = (c: string) => PORTAL.categories[c] ?? PORTAL.categories.other;

function Service() {
  const { p, t } = usePortal();
  const tipsOff = useStore((s) => (p ? s.tipsOff[p.id] : false));
  const ecoOff = useStore((s) => (p ? s.ecoOff[p.id] ?? false : false));
  const callback = useStore((s) => (p ? s.callbacks[p.id] : undefined));
  const [callbackOpen, setCallbackOpen] = useState(false);
  if (!p) return null;
  const c = p.raw;
  const open = c.tickets.filter((x) => x.status === "open");
  const closed = c.tickets.filter((x) => x.status !== "open").slice(-3).reverse();

  return (
    <div className="space-y-12">
      <h1 className="type-headline">{S.title}</h1>
      <HelpCard />

      <section aria-labelledby="cases-title">
        <h2 id="cases-title" className="type-section">{t(S.cases)}</h2>
        {open.length ? (
          <ul className="mt-4 space-y-3">
            {open.map((x) => (
              <li key={x.id} className="rounded-[24px] bg-mg-surface p-5">
                <p className="font-bold">{cat(x.category)} <span className="font-normal text-mg-muted">· {x.id}</span></p>
                <p className="type-small text-mg-muted">{fill(S.since, { date: fmtDate(x.at) })}</p>
                <CaseTimeline step={1} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title={EMPTY_STATES.anliegen.title} text={EMPTY_STATES.anliegen.text} funki="happy" className="mt-2 rounded-[24px] bg-mg-surface" />}
        {closed.length > 0 && (
          <>
            <p className="mt-6 font-semibold">{S.lastDone}</p>
            <ul className="mt-2 divide-y divide-mg-line border-y border-mg-line type-small">
              {closed.map((x) => (
                <li key={x.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span>{cat(x.category)}</span><span className="text-mg-muted tabular-nums">{fmtDate(x.at)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="move-title" className="flex flex-wrap items-center gap-5 rounded-[24px] border-2 border-mg-navy p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-mg-yellow"><Truck className="size-7" strokeWidth={STROKE} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="move-title" className="type-section">{S.moveTitle}</h2>
          <p className="mt-1 text-mg-muted">{t(S.moveText)}</p>
        </div>
        <PillButton variant="outline" onClick={() => actions.openChat({ customerId: p.id, actionId: "umzug" })}>{S.moveCta}</PillButton>
      </section>

      <section aria-labelledby="self-title">
        <h2 id="self-title" className="type-section">{S.selfTitle}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SELF_SERVICE.map((a) => {
            const Icon = ICONS[a.icon];
            return (
              <li key={a.id} id={`selbst-${a.id}`} className="scroll-mt-24 target:ring-2 target:ring-mg-blue rounded-[24px]">
                <button type="button" onClick={() => actions.openChat({ customerId: p.id, actionId: a.id })}
                  className="flex h-full w-full cursor-pointer items-start gap-4 rounded-[24px] bg-mg-surface p-5 text-left transition-colors duration-150 ease-out hover:bg-[#e3ebf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-mg-navy"><Icon className="size-6" strokeWidth={STROKE} /></span>
                  <span><span className="block font-bold">{a.title}</span><span className="block type-small text-mg-muted">{a.text}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="rechnungen" aria-labelledby="invoices-title" className="scroll-mt-24">
        <h2 id="invoices-title" className="type-section">{INVOICE_TEXT.title}</h2>
        <p className="mt-1 type-small text-mg-muted">{INVOICE_TEXT.demo}</p>
        <div className="mt-4"><InvoiceList /></div>
      </section>

      <section aria-labelledby="contact-title">
        <h2 id="contact-title" className="type-section">{S.contactTitle}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PillButton variant={hasOpenProblem(p) ? "outline" : "primary"} onClick={() => actions.openChat({ customerId: p.id })}><MessageCircle strokeWidth={STROKE} />{S.chat}</PillButton>
          {callback
            ? <p className="font-semibold">{PORTAL.help.callbackDone}: {callback}</p>
            : <PillButton variant="outline" onClick={() => setCallbackOpen(true)}><PhoneCall strokeWidth={STROKE} />{S.callback}</PillButton>}
          {p && <SlotDialog open={callbackOpen} onOpenChange={setCallbackOpen} kind="call" title={PORTAL.help.callbackTitle} onPick={(slot) => { actions.callback(p.id, slot); toast.success(PORTAL.help.callbackDone); }} />}
          <a href={`tel:${S.phone.replace(/\D/g, "")}`} className="inline-flex min-h-12 items-center gap-2 px-2 font-semibold text-mg-navy underline-offset-4 hover:underline">
            <Phone className="size-5" strokeWidth={STROKE} />{S.phone}<span className="font-normal text-mg-muted">· {S.phoneHours}</span>
          </a>
        </div>
      </section>

      <section id="einstellungen" aria-labelledby="settings-title" className="scroll-mt-24">
        <h2 id="settings-title" className="type-section">{S.settingsTitle}</h2>
        <div className="mt-4 divide-y divide-mg-line border-y border-mg-line">
          <div className="flex items-center justify-between gap-4 py-4">
            <div><p className="font-semibold">{ECO_TEXT.settingTitle}</p><p className="type-small text-mg-muted">{ECO_TEXT.settingText}</p></div>
            <Switch checked={!ecoOff} onCheckedChange={(v) => actions.setEcoOff(p.id, !v)} aria-label={ECO_TEXT.settingTitle} />
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div><p className="font-semibold">{S.tipsTitle}</p><p className="type-small text-mg-muted">{S.tipsText}</p></div>
            <Switch checked={!tipsOff} onCheckedChange={(v) => actions.setTips(p.id, v)} aria-label={S.tipsTitle} />
          </div>
        </div>
      </section>

      <section id="datenschutz" aria-labelledby="privacy-title" className="scroll-mt-24">
        <h2 id="privacy-title" className="type-section">{S.privacyTitle}</h2>
        <p className="mt-1 text-mg-muted">{t(S.privacyIntro)}</p>
        <p className="mt-2 type-small text-mg-muted">{t(S.styleNote)}</p>
        <ul className="mt-4 divide-y divide-mg-line border-y border-mg-line">
          {PORTAL.consents.map((k) => {
            const on = c.consent[k.key] === "granted";
            return (
              <li key={k.key} className="flex items-start justify-between gap-4 py-4">
                <div><p className="font-semibold">{k.label}</p><p className="type-small text-mg-muted">{k.why}</p></div>
                <Switch checked={on} aria-label={k.label} className="mt-1"
                  onCheckedChange={(v) => { actions.setConsent(p.id, k.key, v ? "granted" : "withdrawn"); toast(v ? S.toastOn : S.toastOff); }} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function CaseTimeline({ step }: { step: 0 | 1 | 2 }) {
  return (
    <ol className="mt-4 flex items-center gap-2">
      {S.caseSteps.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
            i < step ? "border-mg-navy bg-mg-navy text-white" : i === step ? "border-mg-navy bg-white text-mg-navy" : "border-mg-line text-mg-muted")}>
            {i < step ? <Check className="size-4" strokeWidth={2.25} /> : i + 1}
          </span>
          <span className={cn("type-small", i === step ? "font-semibold" : "text-mg-muted")}>{label}</span>
          {i < S.caseSteps.length - 1 && <span aria-hidden className={cn("hidden h-0.5 flex-1 sm:block", i < step ? "bg-mg-navy" : "bg-mg-line")} />}
        </li>
      ))}
    </ol>
  );
}
