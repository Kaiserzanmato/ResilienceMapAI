"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SPRING_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const subscribeNever = () => () => {};
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog primitive. It renders through a portal at <body>, so no ancestor's z-index,
 * transform or filter can trap it below the floating map controls; the backdrop and dialog use
 * the --z-modal-backdrop / --z-modal tokens, which sit above everything else. It traps focus,
 * closes on Esc and on a backdrop click, locks background scroll, and returns focus on close.
 * On phones it is full screen with a sticky header; the body scrolls inside its own area.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();
  // createPortal needs document.body, which does not exist during server render.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Safari's Tab order skips buttons, so a keydown trap alone can let focus walk out of the
    // dialog. Whatever takes focus outside the panel is pulled straight back in.
    const onFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) closeRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  const fade = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="modal"
          className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-4"
          style={{ zIndex: "var(--z-modal)" }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: "var(--z-modal-backdrop)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            data-testid="modal-backdrop"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="modal"
            initial={fade}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={fade}
            transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: SPRING_EASE }}
            style={{ zIndex: "var(--z-modal)" }}
            className={cn(
              "glass-strong relative flex w-full flex-col overflow-hidden",
              // phones: full screen; sm and up: centred card that never exceeds the viewport
              "h-[100dvh] rounded-none sm:h-auto sm:max-h-[min(80dvh,720px)] sm:max-w-2xl sm:rounded-[var(--radius-lg)]",
              className
            )}
          >
            <header
              className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--surface-border)] px-5 pb-3 pt-4"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
              data-testid="modal-header"
            >
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-xl font-bold sm:text-2xl">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 truncate text-sm text-[var(--fg-muted)]">{subtitle}</p>}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={`Close ${title}`}
                className="focus-ring -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg)] transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] active:scale-[var(--press-scale)]"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
