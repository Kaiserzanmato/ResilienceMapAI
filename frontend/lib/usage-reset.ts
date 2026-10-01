/** Reset-time display for the usage meters. Pure; no imports (tests/usage-reset.test.mjs). */

/** Whole seconds until an ISO time, never negative; 0 when there is no reset. */
export function secondsUntil(iso: string | null, now: number): number {
  if (!iso) return 0;
  const target = Date.parse(iso);
  return Number.isFinite(target) ? Math.max(0, Math.ceil((target - now) / 1000)) : 0;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (m === 60) return `${h + 1}h 0m`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "07:55 PM" for a time later today, "Oct 2, 12:00 AM" for another day. */
export function formatResetClock(iso: string, now: number = Date.now(), locale?: string): string {
  const target = new Date(iso);
  const clock = target.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const sameDay = target.toDateString() === new Date(now).toDateString();
  return sameDay ? clock : `${target.toLocaleDateString(locale, { month: "short", day: "numeric" })}, ${clock}`;
}
