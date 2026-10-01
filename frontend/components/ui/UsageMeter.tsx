"use client";
import { Gauge, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { UsageStatus } from "@/lib/api";
import { formatDuration, formatResetClock, secondsUntil } from "@/lib/usage-reset";

/** Usage-quota meter — mirrors the app's existing 429 messaging
 * (app/services/usage_quota.py) so the UI never surprises a user with a
 * blocked action it didn't warn them about first.
 *
 * The countdown is computed from `resets_at` against the clock, not from the
 * seconds the server reported when the status was fetched, so it keeps moving
 * and never shows a reset time that has already passed. When that time passes
 * (the oldest use left the window) `onExpire` asks the owner to refetch. While
 * nothing is used there is nothing to reset, so no reset time is shown. */
export function UsageMeter({
  label,
  unitLabel = "requests",
  status,
  className,
  onExpire,
}: {
  label: string;
  unitLabel?: string;
  status: UsageStatus | null;
  className?: string;
  onExpire?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const resetsAt = status?.resets_at ?? null;
  useEffect(() => {
    if (!resetsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [resetsAt]);

  const secondsLeft = secondsUntil(resetsAt, now);
  const expiredFor = useRef<string | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });
  useEffect(() => {
    // Refetch once per reset time that has passed, not on every tick.
    if (resetsAt && secondsLeft === 0 && expiredFor.current !== resetsAt) {
      expiredFor.current = resetsAt;
      onExpireRef.current?.();
    }
  }, [resetsAt, secondsLeft]);

  if (!status) return null;
  const percent = status.limit > 0 ? Math.min(100, Math.round((status.used / status.limit) * 100)) : 0;
  const exhausted = status.remaining <= 0;

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
        {resetsAt && (
          <span className="flex items-center gap-1 text-[var(--fg-muted)]">
            <Clock size={12} aria-hidden="true" />
            {exhausted ? "Available again in" : "Next use frees up in"} {formatDuration(secondsLeft)}
          </span>
        )}
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
        <span>{resetsAt ? `At ${formatResetClock(resetsAt, now)}` : "Nothing used yet"}</span>
      </div>
    </div>
  );
}
