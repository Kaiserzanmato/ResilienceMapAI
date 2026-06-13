"use client";
import { Fragment } from "react";

/** Minimal markdown renderer for AI answers (bold, italics, bullets, headers).
 * Avoids a full markdown dependency; AI output is plain prose + bullets. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <Fragment key={i} />;
        if (trimmed.startsWith("###"))
          return (
            <p key={i} className="pt-1 text-sm font-semibold">
              {renderInline(trimmed.replace(/^#+\s*/, ""))}
            </p>
          );
        if (trimmed.startsWith("- ") || trimmed.startsWith("• "))
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true" className="text-[var(--accent)]">
                •
              </span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </p>
          );
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // **bold** and _italic_
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2)
      return <em key={i} className="text-[var(--fg-muted)]">{part.slice(1, -1)}</em>;
    return part;
  });
}
