export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outlineNavy"
  | "purple"
  | "dark"
  | "sun"
  | "ghostOnDark"
  | "danger"
  | "bare";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] px-[18px] py-[9px] text-[14px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-[#D81B7A] text-white hover:bg-[#be166b]",
  secondary: "border border-white/25 bg-transparent text-ink hover:border-white/60 hover:bg-white/[0.06]",
  outlineNavy: "border-[1.5px] border-white/40 bg-transparent text-ink font-bold hover:border-white hover:bg-white/[0.06]",
  purple: "border border-transparent bg-[#6A1B9A] text-white hover:bg-[#7b22b2]",
  dark: "border border-plum-700 bg-plum-700 text-white hover:bg-[#5d2490]",
  // Yellow is for dark backgrounds: always dark text on it, never white.
  sun: "border border-transparent bg-sun text-plum-950 font-bold hover:bg-[#e2b20c]",
  ghostOnDark: "border border-white/40 bg-transparent text-white hover:border-white hover:bg-white/[0.08]",
  danger: "border border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#991b1b]",
  // Behaviour only (disable-on-submit); the caller supplies all styling.
  bare: "",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  if (variant === "bare") return cx("disabled:cursor-not-allowed disabled:opacity-60", className);
  return cx(buttonBase, buttonVariants[variant], className);
}
