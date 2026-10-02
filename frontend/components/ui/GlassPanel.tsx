import { cn } from "@/lib/utils";

/** Frosted panel with an inner highlight edge, meant to sit over the ambient
 * glow orbs of a workspace page. Built on the shared `.glass-strong` surface
 * (same blur/saturate/border tokens as every other glass surface, including
 * the reduced-transparency and no-backdrop-filter fallbacks) rather than its
 * own one-off Tailwind blur stack. */
export function GlassPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass-strong relative overflow-hidden rounded-2xl", className)}
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
