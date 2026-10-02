"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GlassMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** Accessible name for the menu panel (role="menu"). */
  label: string;
  align?: "left" | "right";
  className?: string;
}

/** Shared header-dropdown shell (persona menu, theme menu): spring-in panel,
 * outside-click + Escape to close, role="menu" semantics, and a reduced-motion
 * fallback that swaps the scale/slide for a plain fade. Transform/opacity only,
 * so it stays smooth at 120Hz. */
export function GlassMenu({
  open,
  onOpenChange,
  trigger,
  children,
  label,
  align = "right",
  className,
}: GlassMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: -6 };
  const shown = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };

  return (
    <div ref={ref} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: [0.32, 0.72, 0, 1] }}
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={cn(
              "glass-strong absolute top-12 z-[var(--z-dropdown)] rounded-xl p-1.5",
              align === "right" ? "right-0" : "left-0",
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
