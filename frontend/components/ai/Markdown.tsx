"use client";
import { Fragment } from "react";

/** Minimal markdown renderer for AI answers (headers, bullets, numbered
 * lists, blockquotes, rules, bold/italic). Avoids a full markdown
 * dependency; AI output is plain prose + light structure, not full CommonMark. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <Fragment key={i} />;
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed))
          return <hr key={i} className="my-2 border-[var(--surface-border)]" />;
        if (trimmed.startsWith("#"))
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
        const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/);
        if (numbered)
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true" className="shrink-0 font-medium text-[var(--accent)]">
                {numbered[1]}.
              </span>
              <span>{renderInline(numbered[2])}</span>
            </p>
          );
        if (trimmed.startsWith(">"))
          return (
            <p
              key={i}
              className="border-l-2 border-[var(--accent)] pl-2.5 text-[var(--fg-muted)]"
            >
              {renderInline(trimmed.replace(/^>\s?/, ""))}
            </p>
          );
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

export function renderInline(text: string): React.ReactNode[] {
  // [text](url) links, **bold**, then _italic_ / *italic* (checked after
  // bold so ** isn't split as two *).
  const parts = text.split(
    /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g
  );
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link)
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline underline-offset-2"
        >
          {link[1]}
        </a>
      );
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2)
      return <em key={i} className="text-[var(--fg-muted)]">{part.slice(1, -1)}</em>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i} className="text-[var(--fg-muted)]">{part.slice(1, -1)}</em>;
    return part;
  });
}
