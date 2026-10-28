import { cn } from "@/lib/utils";

/** MAINGAU-Wortmarke als Text + gelber Plus-Kreis (kein Fremdbild). */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const sm = size === "sm";
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-[family-name:var(--font-portal)] font-extrabold tracking-tight text-[#0B2A5B]", sm ? "text-base" : "text-[22px]", className)}>
      MAINGAU
      <span aria-hidden className={cn("grid place-items-center rounded-full bg-[#F5DC3C] text-[#0B2A5B]", sm ? "size-5" : "size-7")}>
        <svg viewBox="0 0 16 16" className={sm ? "size-3" : "size-4"}>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
