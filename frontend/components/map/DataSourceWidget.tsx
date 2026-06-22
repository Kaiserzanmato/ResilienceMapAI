"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database, ExternalLink } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getSourcesForCountry } from "@/lib/risk-reference";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

/** Parse "Label — https://url" or "https://url (Label)" into {label, url} */
function parseSource(raw: string): { label: string; url: string } {
  // Format: "Agency Name — https://url"
  const dashMatch = raw.match(/^(.+?)\s*—\s*(https?:\/\/\S+)$/);
  if (dashMatch) return { label: dashMatch[1].trim(), url: dashMatch[2].trim() };

  // Format: "https://url (Description)"
  const urlFirstMatch = raw.match(/^(https?:\/\/\S+)\s+\((.+?)\)$/);
  if (urlFirstMatch) return { label: urlFirstMatch[2].trim(), url: urlFirstMatch[1].trim() };

  // Plain URL
  if (raw.startsWith("http")) return { label: raw, url: raw };

  return { label: raw, url: "#" };
}

export function DataSourceWidget() {
  const [open, setOpen] = useState(false);
  const { selected } = useAppStore();
  const { data } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const datasets = data?.datasets.slice(0, 4) ?? [];

  // Country-specific sources from research dataset
  const countryCode = selected?.countryCode ?? "";
  const countrySources = countryCode ? getSourcesForCountry(countryCode) : [];
  const hasCountrySources = countrySources.length > 0;

  return (
    <GlassCard strong className="w-60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold"
      >
        <Database size={15} className="text-[var(--accent-2)]" aria-hidden="true" />
        {hasCountrySources ? "Official Sources" : "Data Sources"}
        {hasCountrySources && (
          <span className="ml-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            {countrySources.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="pb-4">
          {/* Country-specific official sources from research dataset */}
          {hasCountrySources && (
            <div className="px-4 pb-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                {selected?.name ?? countryCode} — Official Agencies
              </p>
              <ul className="space-y-2">
                {countrySources.map((raw) => {
                  const { label, url } = parseSource(raw);
                  return (
                    <li key={url} className="text-[11.5px] leading-snug">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
                      >
                        {label}
                        <ExternalLink size={10} className="shrink-0 opacity-60" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Divider if both sections present */}
          {hasCountrySources && datasets.length > 0 && (
            <div className="mx-4 mb-3 border-t border-[var(--surface-border)]" />
          )}

          {/* Global datasets */}
          {datasets.length > 0 && (
            <div className="px-4">
              {hasCountrySources && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  Global Datasets
                </p>
              )}
              <ul className="space-y-2.5">
                {datasets.map((d) => (
                  <li key={d.id} className="text-[11.5px] leading-snug">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring font-medium text-[var(--accent)] hover:underline"
                    >
                      {d.name}
                    </a>
                    <p className="text-[var(--fg-muted)]">
                      {d.agency} · {d.updated} · {d.confidence} confidence
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
