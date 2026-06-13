"use client";

/**
 * Docypher Labs attribution footer
 * Appears on all pages with consistent styling
 */
export function DocypherFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--surface-border)] bg-gradient-to-r from-[#0a0e27]/95 via-[#0f1535]/95 to-[#0a0e27]/95 backdrop-blur-sm">
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
