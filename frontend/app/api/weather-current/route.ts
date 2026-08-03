import { NextResponse } from "next/server";
import { clientKeyFromRequest, isRateLimited } from "@/lib/rateLimit";

// Server-only proxy for OWM's Current Weather API (free tier, same key as
// the tile proxy) — keeps OPENWEATHERMAP_API_KEY out of the client bundle.
const OWM_API_KEY = process.env.OPENWEATHERMAP_API_KEY ?? "";

export async function GET(request: Request) {
  if (isRateLimited(clientKeyFromRequest(request))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  if (!OWM_API_KEY) {
    return NextResponse.json(
      { error: "OPENWEATHERMAP_API_KEY is not configured on the server" },
      { status: 503 }
    );
  }

  const upstream = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${OWM_API_KEY}`;
  const res = await fetch(upstream, { next: { revalidate: 300 } });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? "Upstream request failed" }, { status: res.status });
  }
  return NextResponse.json(data);
}
