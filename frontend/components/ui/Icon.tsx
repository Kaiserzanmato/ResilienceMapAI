import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconSize = "menu" | "inline" | number;

const SIZE_PX: Record<"menu" | "inline", number> = { menu: 20, inline: 18 };

/** Shared icon rendering: every lucide-react icon in the app goes through this
 * wrapper so stroke width, sizing and color stay identical everywhere.
 * `size="menu"` (20px) for dropdowns/menus, `size="inline"` (18px) for text-adjacent
 * icons; pass a number to opt out for a one-off (e.g. a 15px nav icon). Purely
 * decorative by default (aria-hidden); pass `title` to make it a labeled graphic. */
export function Icon({
  icon: LucideIconComponent,
  size = "inline",
  className,
  title,
}: {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  title?: string;
}) {
  const px = typeof size === "number" ? size : SIZE_PX[size];
  return (
    <LucideIconComponent
      size={px}
      strokeWidth={1.5}
      color="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      className={cn("shrink-0", className)}
    />
  );
}
