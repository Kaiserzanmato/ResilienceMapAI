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
  hits.set(key, recent);
  return recent.length > maxRequests;
}

export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
