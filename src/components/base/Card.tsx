import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fläche ohne Schatten; Radius kommt aus dem Theme (Portal 24 px, intern 8 px). */
export function Card({
  title,
  sub,
  action,
  children,
  as: Tag = "section",
  className,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  as?: "section" | "article" | "div";
  className?: string;
}) {
  return (
    <Tag className={cn("rounded-[var(--card-radius)] bg-card p-6 text-card-foreground", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-[1.25em] font-bold leading-tight">{title}</h2>}
            {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
