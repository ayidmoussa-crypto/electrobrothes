import type { ReactNode } from "react";

// Status colours come in soft background + strong text pairs (all ≥4.5:1).
const tones = {
  neutral: "bg-warm-100 text-warm-800",
  accent: "bg-yellow-100 text-yellow-900",
  action: "bg-yellow-500 text-ink",
  ink: "bg-ink text-white",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
