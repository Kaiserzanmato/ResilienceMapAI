import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { API_BASE } from "@/lib/api";

// Same-origin cache in front of the FastAPI backend. dashboard_stats() is a
// deterministic aggregation over a curated dataset (see backend/app/services
// /dashboard.py) — it doesn't need to be recomputed per request. The first
// request in each 60s window pays the backend round trip (slow/cold on the
// free Render tier); unstable_cache serves every request after that from
// Vercel's Data Cache instead of blocking on the backend's connection setup.

const getCachedDashboardStats = unstable_cache(
  async () => {
    const res = await fetch(`${API_BASE}/api/dashboard-stats`);
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    return res.json();
  },
  ["dashboard-stats"],
  { revalidate: 60 }
);

export async function GET() {
  try {
    const data = await getCachedDashboardStats();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to load dashboard stats" },
      { status: 502 }
    );
  }
}
