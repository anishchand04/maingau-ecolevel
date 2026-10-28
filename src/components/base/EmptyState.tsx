import type { ReactNode } from "react";
import { Funki, type FunkiMood } from "@/components/funki/Funki";
import { cn } from "@/lib/utils";

/** Gestalteter Leerzustand: Titel, ein Satz, optional nächster Schritt. Funki nur im Portal. */
export function EmptyState({
  title,
  text,
  action,
  funki,
  className,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  funki?: FunkiMood | false;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      {funki && <Funki mood={funki} size={72} />}
      <p className="font-bold">{title}</p>
      {text && <p className="max-w-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Lade-Platzhalter (< 300 ms), statt Spinner. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[var(--card-radius)] bg-muted", className)} />;
}
