"use client";

/**
 * Docypher Labs attribution footer
 * Appears on all pages with consistent styling
 */
export function DocypherFooter() {
  return (
    <footer className="glass-strong fixed inset-x-0 bottom-0 z-[var(--z-top-bar)] shadow-[var(--elevation-1)]">
      <div className="mx-auto flex items-center justify-center px-4 py-3 text-center">
        <span className="text-[11px] tracking-widest text-[var(--fg-muted)]">
          •&nbsp;&nbsp;<span className="font-medium text-[var(--fg)]">
            POWERED BY{" "}
            <a
              href="https://docypherlabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline transition-all hover:brightness-110"
            >
              DOCYPHERLABS
            </a>
          </span>
          &nbsp;|&nbsp;RESEARCH & INTELLIGENCE&nbsp;•
        </span>
      </div>
    </footer>
  );
}
