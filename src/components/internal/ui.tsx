// Internal tool building blocks: calm, compact, 8-px grid, tabular numbers. One signal colour per status.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/base/Wordmark";
import { DataBadge } from "@/components/base/StatusBadge";
import { INTERNAL_NAV } from "@/config/internal";
import type { DataStatus } from "@/config/labels";
import { cn } from "@/lib/utils";

export function InternalShell({ area, children }: { area: "marketing" | "service"; children: ReactNode }) {
  const nav = INTERNAL_NAV[area];
  return (
    <div className="theme-internal min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link to="/" className="rounded focus-visible:outline-2 focus-visible:outline-ring"><Wordmark size="sm" /></Link>
          <nav aria-label="Bereich" className="inline-flex rounded-full border border-border p-0.5">
            {INTERNAL_NAV.areas.map((a) => (
              <Link key={a.to} to={a.to} className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                activeProps={{ className: "!bg-primary !text-primary-foreground" }}>{a.label}</Link>
            ))}
          </nav>
          <nav aria-label="Ansichten" className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                activeProps={{ className: "!bg-muted !text-foreground font-semibold" }}>{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hidden lg:inline">{INTERNAL_NAV.role[area]}</span>
            <Link to="/portal" className="underline-offset-4 hover:underline">{INTERNAL_NAV.portalLink}</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, status, children }: { label: string; value: ReactNode; status?: DataStatus; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 text-sm text-muted-foreground"><span>{label}</span>{status && <DataBadge status={status} />}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {children && <div className="mt-2 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Section({ title, sub, action, children, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div><h2 className="text-sm font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}</div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Simple horizontal bars – counts as one chart. */
export function Bars({ rows, tone = "neutral", format = (v) => String(v), label }: {
  rows: { label: string; value: number; tone?: "care" | "sell" | "wait" | "neutral" }[];
  tone?: "care" | "sell" | "wait" | "neutral"; format?: (v: number) => string; label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const color = { care: "bg-status-care", sell: "bg-status-sell", wait: "bg-status-wait", neutral: "bg-foreground/60" };
  return (
    <figure aria-label={label}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate" title={r.label}>{r.label}</span>
            <span className="h-2.5 rounded-sm bg-muted"><span className={cn("block h-full rounded-sm", color[r.tone ?? tone])} style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="w-14 text-right tabular-nums">{format(r.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function TabBar<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={t.id === value} onClick={() => onChange(t.id)}
          className={cn("-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm", t.id === value ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
export const td = "px-3 py-2 align-top";
