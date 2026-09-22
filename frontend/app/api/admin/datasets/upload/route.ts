import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Server-only proxy for the RBAC-gated dataset upload endpoint. The backend's
// X-Role header is client-controllable, so as a stopgap (until real auth
// exists) it also requires ADMIN_SHARED_SECRET — which must never reach the
// browser. This route holds that secret server-side and forwards it, but
// only after the CALLER proves they know it via the `x-admin-key` header —
// previously this route attached the secret for every caller unconditionally,
// which meant the "gate" protected nothing (any anonymous request could act
// as dataset_admin). The client (lib/api.ts) calls this same-origin route
// instead of hitting the backend directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET ?? "";

function isValidAdminKey(provided: string | null): boolean {
  if (!ADMIN_SHARED_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_SHARED_SECRET);
  // timingSafeEqual throws on length mismatch rather than returning false
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isValidAdminKey(request.headers.get("x-admin-key"))) {
    return NextResponse.json({ detail: "Invalid or missing admin key" }, { status: 401 });
  }

  const body = await request.json();

  const res = await fetch(`${API_BASE}/api/datasets/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-role": "dataset_admin",
      authorization: `Bearer ${ADMIN_SHARED_SECRET}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
