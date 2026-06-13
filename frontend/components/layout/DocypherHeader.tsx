"use client";

/**
 * Docypher Labs branding header
 * Appears at top of page with consistent styling
 */
export function DocypherHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--surface-border)] bg-gradient-to-r from-[#0a0e27] via-[#0f1535] to-[#0a0e27] backdrop-blur-md shadow-lg">
      <div className="mx-auto flex items-center justify-center px-4 py-2 text-center">
        <span className="text-[10px] tracking-widest text-[var(--fg-muted)]">
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
    </header>
  );
}
