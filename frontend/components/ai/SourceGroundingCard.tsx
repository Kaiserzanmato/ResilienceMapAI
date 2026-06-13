"use client";
import { BookOpenCheck, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { GroundingSource } from "@/lib/types";

export function SourceGroundingCard({ sources }: { sources: GroundingSource[] }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium text-[var(--fg-muted)]"
      >
        <BookOpenCheck size={13} className="text-[var(--accent)]" aria-hidden="true" />
        Grounded in {sources.length} official source{sources.length > 1 ? "s" : ""}
        <ChevronDown
          size={13}
          className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="space-y-1.5 px-3 pb-2.5">
          {sources.map((s) => (
            <li key={s.name} className="text-[11px] leading-snug">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring font-medium text-[var(--accent)] hover:underline"
              >
                {s.name}
              </a>
              <span className="text-[var(--fg-muted)]">
                {" "}— {s.agency} · updated {s.updated} · {s.confidence} confidence
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
