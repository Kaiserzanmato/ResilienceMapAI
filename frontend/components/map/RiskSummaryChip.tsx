"use client";
import { Maximize2 } from "lucide-react";
import { riskColor } from "@/lib/utils";

/** The minimized risk summary: [Tagaytay / Taal • 54 Medium ⛶]. Clicking it reopens the full panel. */
export function RiskSummaryChip({
  name, score, level, color, onExpand,
}: {
  name: string;
  score: number | null;
  level?: string;
  color?: string;
  onExpand: () => void;
}) {
  const result = score === null ? "No data" : `${score} ${level ?? ""}`.trim();
  return (
    <button
      type="button"
      onClick={onExpand}
      data-testid="risk-chip"
      aria-label={`Expand risk assessment for ${name}, ${result}`}
      className="glass-strong focus-ring flex h-11 max-w-[min(20rem,calc(100vw-2rem))] cursor-pointer items-center gap-2 rounded-2xl px-4 text-[13px] font-semibold shadow-[var(--elevation-2)]"
    >
      <span className="min-w-0 truncate">{name}</span>
      <span aria-hidden="true" className="text-[var(--fg-muted)]">•</span>
      <span className="shrink-0" style={{ color: color ? riskColor(color) : undefined }}>{result}</span>
      <Maximize2 size={14} className="shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
    </button>
  );
}
