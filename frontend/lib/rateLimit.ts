/** Best-effort in-memory sliding-window limiter for routes that spend a
 * shared, quota-capped upstream key (e.g. OpenWeatherMap's free tier).
 * Not distributed — relies on Vercel Fluid Compute reusing function
 * instances — but it's enough to stop a single client or hot-linker from
 * draining the whole account's quota. */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 50;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests = MAX_REQUESTS_PER_WINDOW): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);

  if (recent.length === 0) hits.delete(key);
  else hits.set(key, recent);

  return recent.length > maxRequests;
}

/** Namespaced per-route so different routes sharing this module don't share
 * a bucket (e.g. panning the weather map shouldn't burn through the much
 * tighter budget on the current-conditions lookup). */
export function clientKeyFromRequest(request: Request, namespace: string): string {
  // The last entry is the one appended by Vercel's own edge (the outermost,
  // trusted hop) — earlier entries can be set by the client itself and are
  // not a reliable identity signal.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",").pop()?.trim() || "unknown";
  return `${namespace}:${ip}`;
}
