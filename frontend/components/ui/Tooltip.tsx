"use client";
import { cloneElement, useId, useState, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/** Minimal glass tooltip for icon-only controls (TopNav's collapsed nav links):
 * shown on hover/focus, positioned below the trigger, role="tooltip" wired via
 * aria-describedby. CSS opacity only (no motion library), so it's inert under
 * prefers-reduced-motion by construction rather than needing special-casing. */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "glass-strong pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[var(--z-dropdown)] -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--fg)] transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}
