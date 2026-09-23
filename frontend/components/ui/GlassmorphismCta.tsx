import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassmorphismCtaProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  /** Leading icon; defaults to a wand. */
  icon?: ReactNode;
  /** Width of the rotating shimmer arc. */
  spread?: string;
  shimmerColor?: string;
  /** Duration of one shimmer rotation. */
  speed?: string;
};

/** Pill-shaped call-to-action with a rotating conic shimmer border and a
 * sweeping border beam. Animations stop under prefers-reduced-motion via the
 * global rule in globals.css. */
export function GlassmorphismCta({
  label,
  icon,
  spread = "90deg",
  shimmerColor = "rgba(255,255,255,0.6)",
  speed = "4s",
  className,
  type = "button",
  style,
  ...props
}: GlassmorphismCtaProps) {
  return (
    <button
      type={type}
      className={cn(
        "focus-ring group relative isolate inline-flex cursor-pointer overflow-hidden rounded-full",
        "shadow-[0_8px_32px_var(--accent-glow)] transition-all duration-300",
        "hover:scale-[1.03] hover:shadow-[0_0_36px_6px_var(--accent-glow)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        className
      )}
      style={
        {
          "--spread": spread,
          "--shimmer-color": shimmerColor,
          "--speed": speed,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {/* Rotating conic shimmer, visible as a 1px border around the pill */}
      <span aria-hidden="true" className="absolute inset-0 hc:hidden">
        <span className="absolute inset-[-200%] h-[400%] w-[400%] [animation:rotate-gradient_var(--speed)_linear_infinite]">
          <span className="absolute inset-0 [background:conic-gradient(from_calc(270deg_-_(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </span>
      </span>

      <span className="relative z-10 flex items-center gap-2.5 overflow-hidden rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold text-white hc:text-black">
        {/* Border beam sweep */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[200%] w-[200%] [animation:borderBeamRotation_var(--speed)_linear_infinite]"
          style={{
            transform: "translate(-50%, -50%)",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), rgba(255,255,255,0.2), transparent)",
          }}
        />
        {/* Fill, inset 1px so the shimmer reads as a border */}
        <span
          aria-hidden="true"
          className="absolute inset-px rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] backdrop-blur-sm hc:bg-[var(--accent)]"
        />
        <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 hc:bg-black/10">
          {icon ?? <WandSparkles size={14} strokeWidth={1.75} aria-hidden="true" />}
        </span>
        <span className="relative z-10 whitespace-nowrap">{label}</span>
      </span>
    </button>
  );
}
