// Button styles as class strings so <button>, <Link> and <a> share them.
// Yellow 500 is the only action colour: hover 600, pressed 700, always ink text.

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-warm-100 disabled:text-warm-400 disabled:border-transparent";

const variants = {
  primary: "bg-yellow-500 text-ink hover:bg-yellow-600 active:bg-yellow-700",
  dark: "bg-ink text-white hover:bg-warm-900 active:bg-warm-800",
  outline: "border border-warm-200 bg-white text-ink hover:border-warm-300 hover:bg-warm-50 active:bg-warm-100",
  ghost: "text-ink hover:bg-warm-100 active:bg-warm-200",
  // Secondary action on dark surfaces (hero).
  outlineDark: "border border-white/30 text-white hover:bg-white/10 active:bg-white/15",
} as const;

const sizes = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-12 px-8 text-lg",
  icon: "size-11",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: keyof typeof sizes; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export const primaryButton = buttonClass();
