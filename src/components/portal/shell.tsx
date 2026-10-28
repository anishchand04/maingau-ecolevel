// Portal frame: demo bar, header (bell + profile menu), pill tabs, mobile bottom bar, search.
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, LogOut, RotateCcw, Search, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { PROFILES } from "@/lib/engine";
import { actions, useStore } from "@/lib/store";
import { PORTAL, DEMO_SCENARIOS } from "@/config/portal";
import { searchPortal, type SearchEntry } from "@/config/portalSearch";
import { placeholderFirstName } from "@/config/names";
import { Wordmark } from "@/components/base/Wordmark";
import { PillButton } from "@/components/base/PillButton";
import { Funki } from "@/components/funki/Funki";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CHAT_UI } from "@/config/chat";
import { cn } from "@/lib/utils";
import { ICONS, STROKE } from "./icons";
import { NotificationBell } from "./notifications";
import { usePortal } from "./use-portal";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue";

/** Collapsible demo strip – collapsed by default, clearly marked, out of the customer's way. */
export function DemoBar() {
  const [open, setOpen] = useState(false);
  const id = useStore((s) => s.portalCustomer);
  const ai = useStore((s) => s.aiEnabled);
  const d = PORTAL.demo;
  return (
    <div className="border-b border-dashed border-mg-line bg-[#F7F8FA] text-[15px] text-mg-muted">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 md:px-8">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={cn("flex min-h-9 cursor-pointer items-center gap-1.5 font-semibold", focusRing)}>
          <span className="rounded-full border border-mg-muted/40 px-2 py-0 text-xs uppercase tracking-wider">{d.toggle}</span>
          {open ? <ChevronUp className="size-4" strokeWidth={STROKE} /> : <ChevronDown className="size-4" strokeWidth={STROKE} />}
          <span className="sr-only">{d.title}</span>
        </button>
        {!open && <span className="truncate text-sm">{id}</span>}
      </div>
      {open && (
        <div className="mx-auto max-w-[1120px] space-y-3 px-4 pb-4 md:px-8">
          <p className="text-sm">{d.note}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={id} onValueChange={(v) => actions.setPortalCustomer(v)}>
              <SelectTrigger aria-label={d.customer} className="h-10 w-[160px] rounded-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{PROFILES.map((p) => <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>)}</SelectContent>
            </Select>
            {DEMO_SCENARIOS.map((s) => (
              <button key={s.id} type="button" onClick={() => actions.setPortalCustomer(s.customer)} aria-pressed={id === s.customer}
                className={cn("min-h-10 cursor-pointer rounded-full border px-4 text-sm", focusRing, id === s.customer ? "border-mg-navy bg-mg-navy text-white" : "border-mg-line bg-white text-mg-navy hover:bg-mg-surface")}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 font-semibold text-mg-navy" title={CHAT_UI.aiHint}>
              <Switch checked={ai} onCheckedChange={(v) => actions.setAi(v)} />{CHAT_UI.aiLabel}
            </label>
            <button type="button" onClick={() => { actions.reset(); toast(d.resetDone); }} className={cn("flex min-h-10 cursor-pointer items-center gap-1.5 font-semibold text-mg-navy", focusRing)}>
              <RotateCcw className="size-4" strokeWidth={STROKE} />{d.reset}
            </button>
            <Link to="/marketing/customers" search={{ id }} className={cn("flex min-h-10 items-center gap-1.5 font-semibold text-mg-navy underline-offset-4 hover:underline", focusRing)}>
              <ArrowLeftRight className="size-4" strokeWidth={STROKE} />{d.internal}
            </Link>
            <a href="/demo" target="_top" className={cn("flex min-h-10 items-center font-semibold text-mg-navy underline-offset-4 hover:underline", focusRing)}>{d.split}</a>
          </div>
        </div>
      )}
    </div>
  );
}

export function PortalHeader() {
  const { id } = usePortal();
  const initial = placeholderFirstName(id).slice(0, 1);
  const m = PORTAL.profileMenu;
  const navigate = useNavigate();
  return (
    <header className="bg-white">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-4 md:px-8">
        <Link to="/portal" className={cn("rounded-md", focusRing)} aria-label={`${PORTAL.meta.title} – Startseite`}><Wordmark /></Link>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={m.label}
              className={cn("grid size-12 cursor-pointer place-items-center rounded-full bg-mg-yellow text-lg font-bold text-mg-navy", focusRing)}>
              {initial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="theme-portal w-64 rounded-2xl p-2">
              {m.items.map((it) => (
                <DropdownMenuItem key={it.hash} className="min-h-11 cursor-pointer rounded-xl px-3 text-[15px]"
                  onSelect={() => navigate({ to: "/portal/service", hash: it.hash })}>
                  {it.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11 cursor-pointer rounded-xl px-3 text-[15px]" onSelect={() => navigate({ to: "/" })}>
                <LogOut className="size-4" strokeWidth={STROKE} />{m.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/** Desktop: pill tab bar like "Energie | Internet | Mobilfunk". */
export function PortalTabs() {
  return (
    <nav aria-label="Hauptnavigation" className="mx-auto hidden max-w-[1120px] px-4 md:block md:px-8">
      <div className="inline-flex gap-1 rounded-full border-2 border-mg-line p-1">
        {PORTAL.nav.map((n) => {
          const Icon = ICONS[n.icon];
          return (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
              className={cn("flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-mg-navy transition-colors duration-150 ease-out hover:bg-mg-surface", focusRing)}
              activeProps={{ className: "!bg-mg-navy !text-white" }}>
              <Icon className="size-5" strokeWidth={STROKE} />{n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile: fixed bar at the bottom with icon + label. */
export function MobileNav() {
  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-mg-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-4">
        {PORTAL.nav.map((n) => {
          const Icon = ICONS[n.icon];
          return (
            <li key={n.to}>
              <Link to={n.to} activeOptions={{ exact: "exact" in n }}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[15px] font-semibold leading-none text-mg-muted", focusRing)}
                activeProps={{ className: "!text-mg-navy [&_svg]:!stroke-[2.25]", "aria-current": "page" }}>
                <Icon className="size-6" strokeWidth={STROKE} />
                {PORTAL.navMobile[n.to]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "Was möchtest du tun?" – actions, contracts, FAQ. No hit → "Frag Funki". */
export function PortalSearch() {
  const { id, style } = usePortal();
  const s = PORTAL.search;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchPortal(q), [q]);
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const du = style.anrede === "du";

  function go(e: SearchEntry) {
    setOpen(false); setQ("");
    const t = e.target;
    if (t.kind === "action") actions.openChat({ customerId: id, actionId: t.id });
    else if (t.kind === "page") navigate({ to: t.to, hash: t.hash });
    else navigate({ to: "/portal", hash: `vertrag-${t.id}` });
  }
  function askFunki() {
    actions.openChat({ customerId: id, draft: q });
    setOpen(false);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) go(hits[active]); else if (q.trim().length >= 2) askFunki(); }
    else if (e.key === "Escape") setOpen(false);
  }
  const showPanel = open && q.trim().length >= 2;
  const groups = (["action", "contract", "faq"] as const).map((g) => ({ g, items: hits.filter((h) => h.group === g) })).filter((x) => x.items.length);

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">{du ? s.label : s.labelSie}</label>
      <div className="flex min-h-14 items-center gap-3 rounded-full border-2 border-mg-line bg-white px-5 focus-within:border-mg-blue">
        <Search className="size-6 shrink-0 text-mg-navy" strokeWidth={STROKE} aria-hidden />
        <input ref={inputRef} id={`${listId}-input`} type="search" role="combobox" autoComplete="off"
          aria-expanded={showPanel} aria-controls={listId} aria-activedescendant={showPanel && hits[active] ? `${listId}-${active}` : undefined}
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey}
          placeholder={du ? s.label : s.labelSie} aria-describedby={`${listId}-hint`}
          className="min-w-0 flex-1 bg-transparent text-[17px] text-mg-navy placeholder:text-mg-muted focus:outline-none" />
      </div>
      <p id={`${listId}-hint`} className="mt-2 px-5 type-small text-mg-muted">{s.hint}</p>
      {showPanel && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-14 z-30 mt-2 rounded-[24px] border border-mg-line bg-white p-2">
          {hits.length ? groups.map(({ g, items }) => (
            <div key={g} role="group" aria-label={s.groups[g]}>
              <p className="px-4 pt-2 pb-1 text-sm font-semibold text-mg-muted">{s.groups[g]}</p>
              {items.map((h) => {
                const i = hits.indexOf(h);
                return (
                  <div key={h.title} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={(e) => { e.preventDefault(); go(h); }} onMouseEnter={() => setActive(i)}
                    className={cn("flex min-h-12 cursor-pointer items-center rounded-2xl px-4 text-mg-navy", i === active && "bg-mg-surface")}>
                    {h.title}
                  </div>
                );
              })}
            </div>
          )) : (
            <div className="flex items-center gap-4 px-4 py-3">
              <Funki mood="thinking" size={48} decorative />
              <p className="flex-1 text-mg-muted">{s.empty}</p>
              <PillButton variant="outline" size="sm" onMouseDown={(e) => { e.preventDefault(); askFunki(); }}>{du ? s.askFunki : s.askFunkiSie}</PillButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
