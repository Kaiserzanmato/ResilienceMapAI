import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

/** 32px rounded-square glass tile for a menu row's leading icon (persona menu,
 * theme menu). The selected/active row gets the accent tint; everything else
 * stays a neutral frosted tile with the same inner top highlight as GlassPanel. */
export function IconTile({
  icon,
  active = false,
  className,
}: {
  icon: LucideIcon;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
        active
          ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]"
          : "border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] text-[var(--fg-muted)]",
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-lg border-t border-white/10 hc:hidden" />
      <Icon icon={icon} size="inline" />
    </span>
  );
}
