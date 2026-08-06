import { cn } from "@/lib/utils";

/**
 * Brand mark. Badge background uses the theme's accent gradient (already
 * flips per light/dark/high-contrast/system via CSS vars in globals.css);
 * the glyph is a solid "ink" color masked from `public/brand/resiliencemap-mark.png`.
 * White ink reads on the blue/purple accent gradients (light + dark); the
 * `hc:` variant swaps to black because the high-contrast gradient
 * (gold -> cyan) is too light for white to stay legible against.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] shadow-[0_4px_16px_var(--accent-glow)]",
        className,
      )}
    >
      <span
        className="absolute inset-[16%] bg-white hc:bg-black"
        style={{
          WebkitMaskImage: "url(/brand/resiliencemap-mark.png)",
          maskImage: "url(/brand/resiliencemap-mark.png)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </span>
  );
}
