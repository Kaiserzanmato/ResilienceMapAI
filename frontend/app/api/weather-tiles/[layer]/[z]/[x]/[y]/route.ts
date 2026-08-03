import { NextResponse } from "next/server";
import { WEATHER_LAYER_KEYS } from "@/lib/weatherLayers";
import { clientKeyFromRequest, isRateLimited } from "@/lib/rateLimit";

// Server-only proxy for OpenWeatherMap's tile layers (free tier:
// https://openweathermap.org/price — 60 calls/min, 1M calls/month).
// OWM's tile API takes the key as a query param; proxying here keeps
// OPENWEATHERMAP_API_KEY out of the client bundle (same pattern as the
// dataset-upload admin route) and lets us cache tiles at the edge since
// OWM only regenerates them every ~10 minutes anyway.
const OWM_API_KEY = process.env.OPENWEATHERMAP_API_KEY ?? "";

// A single map viewport can legitimately request dozens of tiles in a
// burst (pan/zoom), so this allows more headroom per client than a typical
// API route — it exists to stop a hot-linker or abusive client from
// draining the shared, quota-capped OWM key, not to throttle normal use.
const TILE_RATE_LIMIT_PER_MINUTE = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  if (isRateLimited(clientKeyFromRequest(request), TILE_RATE_LIMIT_PER_MINUTE)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { layer, z, x, y } = await params;

  if (!OWM_API_KEY) {
    return NextResponse.json(
      { error: "OPENWEATHERMAP_API_KEY is not configured on the server" },
      { status: 503 }
    );
  }
  if (!WEATHER_LAYER_KEYS.includes(layer)) {
    return NextResponse.json({ error: `Unknown weather layer '${layer}'` }, { status: 400 });
  }

  const upstream = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${OWM_API_KEY}`;
  const res = await fetch(upstream, { next: { revalidate: 600 } });

  if (!res.ok) {
    return NextResponse.json({ error: "Upstream tile fetch failed" }, { status: res.status });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
