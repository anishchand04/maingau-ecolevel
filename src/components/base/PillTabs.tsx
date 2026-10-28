import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTab<T extends string> = { value: T; label: ReactNode };

/** Umschalter wie "Energie | Internet | Mobilfunk": Pill-Container mit Rand, aktiver Tab Navy gefüllt. */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: PillTab<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-full border-2 border-border bg-background p-1", className)}>
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "min-h-10 shrink-0 cursor-pointer rounded-full px-5 text-[15px] font-semibold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active ? "bg-secondary-foreground text-background" : "text-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
