"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

export function DataSourceWidget() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const datasets = data?.datasets.slice(0, 5) ?? [];

  return (
    <GlassCard strong className="w-60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold"
      >
        <Database size={15} className="text-[var(--accent-2)]" aria-hidden="true" />
        Data Sources
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="space-y-2.5 px-4 pb-4">
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
      )}
    </GlassCard>
  );
}
