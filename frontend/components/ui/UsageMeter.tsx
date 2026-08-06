"use client";
import { Gauge, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsageStatus } from "@/lib/api";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Usage-quota meter — mirrors the app's existing 429 messaging
 * (app/services/usage_quota.py) so the UI never surprises a user with a
 * blocked action it didn't warn them about first. */
export function UsageMeter({
  label,
  unitLabel = "requests",
  status,
  className,
}: {
  label: string;
  unitLabel?: string;
  status: UsageStatus | null;
  className?: string;
}) {
  if (!status) return null;
  const percent = status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
  const exhausted = status.remaining <= 0;
  const resetClock = new Date(status.resets_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-[11.5px]",
        exhausted
          ? "border-red-500/40 bg-red-500/[0.06]"
          : "border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[var(--fg-muted)]">
          <Gauge size={13} aria-hidden="true" />
          {percent}% of {label} used
        </span>
        <span className="flex items-center gap-1 text-[var(--fg-muted)]">
          <Clock size={12} aria-hidden="true" />
          Resets in {formatDuration(status.resets_in_seconds)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={status.used}
        aria-valuemin={0}
        aria-valuemax={status.limit}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]"
      >
        <div
          className={cn("h-full rounded-full", exhausted ? "bg-red-500" : "bg-[var(--accent)]")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[var(--fg-muted)]">
        <span>
          {status.used} / {status.limit} {unitLabel}
        </span>
        <span>Resets at {resetClock}</span>
      </div>
    </div>
  );
}
