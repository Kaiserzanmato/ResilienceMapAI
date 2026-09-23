import { cn } from "@/lib/utils";

/** Frosted panel with an inner highlight edge, meant to sit over the ambient
 * glow orbs of a workspace page. Uses theme tokens so it works in light, dark
 * and high-contrast modes. */
export function GlassPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--surface-border)]",
        "bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] backdrop-blur-xl backdrop-saturate-150",
        "shadow-[var(--elevation-2)] hc:bg-[var(--surface-solid)] hc:shadow-none",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.06] hc:hidden"
      />
      <div className="relative z-10 flex h-full min-h-0 flex-col">{children}</div>
    </div>
  );
}
