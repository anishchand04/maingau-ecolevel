import { cn } from "@/lib/utils";

export type FunkiMood = "idle" | "thinking" | "happy" | "empathetic";

/**
 * Funki – das MAINGAU-Glühwürmchen. Flache Formen, keine Verläufe.
 * Bewegung nur per CSS (src/styles/funki.css), prefers-reduced-motion wird global respektiert.
 */
export function Funki({
  mood = "idle",
  size = 48,
  label = "Funki",
  decorative = false,
  glow = 0,
  className,
}: {
  mood?: FunkiMood;
  size?: number;
  label?: string;
  decorative?: boolean;
  /** 0–3: brighter light per Eco-Zuhause level */
  glow?: number;
  className?: string;
}) {
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label };
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("funki shrink-0", `funki--${mood}`, className)}
      data-mood={mood}
      {...a11y}
    >
      <g className="funki-body">
        {/* Fühler */}
        <path d="M27 16 Q24 8 19 7" fill="none" stroke="#0B2A5B" strokeWidth="2" strokeLinecap="round" />
        <path d="M37 16 Q40 8 45 7" fill="none" stroke="#0B2A5B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="19" cy="7" r="2.2" fill="#0B2A5B" />
        <circle cx="45" cy="7" r="2.2" fill="#0B2A5B" />

        {/* Flügel */}
        <ellipse cx="19" cy="23" rx="10" ry="6.5" transform="rotate(30 19 23)" fill="#CFE0F7" stroke="#0B2A5B" strokeWidth="1.5" className="funki-wing funki-wing--l" />
        <ellipse cx="45" cy="23" rx="10" ry="6.5" transform="rotate(-30 45 23)" fill="#CFE0F7" stroke="#0B2A5B" strokeWidth="1.5" className="funki-wing funki-wing--r" />

        {/* Leuchtender Hinterleib: flacher Hof + Kern */}
        <circle cx="32" cy="46" r={17 + glow * 1.5} fill="#F5DC3C" fillOpacity={0.6 + glow * 0.13} className="funki-halo" />
        <ellipse cx="32" cy="46" rx="11.5" ry="11" fill="#F5DC3C" stroke="#0B2A5B" strokeWidth="1.5" className="funki-light" />
        <path d="M23 44 H41 M24.5 50 H39.5" stroke="#0B2A5B" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />

        {/* Kopf/Körper */}
        <circle cx="32" cy="27" r="14" fill="#0B2A5B" />

        {/* Gesicht je Stimmung */}
        {mood === "happy" ? (
          <>
            <path d="M24.5 27 Q27 23.5 29.5 27" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M34.5 27 Q37 23.5 39.5 27" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M27.5 32 Q32 36.5 36.5 32" fill="none" stroke="#F5DC3C" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="27" cy="26.5" r="3.6" fill="#FFFFFF" />
            <circle cx="37" cy="26.5" r="3.6" fill="#FFFFFF" />
            <g className="funki-pupils">
              <circle cx={mood === "thinking" ? 28.2 : 27.4} cy={mood === "empathetic" ? 28 : mood === "thinking" ? 25.4 : 27} r="1.8" fill="#0B2A5B" />
              <circle cx={mood === "thinking" ? 38.2 : 37.4} cy={mood === "empathetic" ? 28 : mood === "thinking" ? 25.4 : 27} r="1.8" fill="#0B2A5B" />
            </g>
            {mood === "empathetic" ? (
              <>
                <path d="M23.5 21.5 L29.5 20" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M40.5 21.5 L34.5 20" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M29 34 Q32 32.5 35 34" fill="none" stroke="#F5DC3C" strokeWidth="1.8" strokeLinecap="round" />
              </>
            ) : mood === "thinking" ? (
              <path d="M29.5 33.5 H34.5" stroke="#F5DC3C" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M28.5 32.5 Q32 35.5 35.5 32.5" fill="none" stroke="#F5DC3C" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </>
        )}
      </g>
    </svg>
  );
}
