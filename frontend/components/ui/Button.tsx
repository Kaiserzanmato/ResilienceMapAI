"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hc:text-black shadow-[0_4px_20px_var(--accent-glow)] hover:brightness-110 active:scale-[var(--press-scale)]",
  secondary:
    "glass text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] active:scale-[var(--press-scale)]",
  ghost: "bg-transparent hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] active:scale-[var(--press-scale)]",
  outline:
    "border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--surface-solid)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] active:scale-[var(--press-scale)]",
  danger: "bg-[var(--risk-high)] text-white hover:brightness-110 active:scale-[var(--press-scale)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  // 44px minimum tap target on every pointer type, not just touch.
  icon: "h-11 w-11 rounded-xl",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex cursor-pointer items-center justify-center font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
