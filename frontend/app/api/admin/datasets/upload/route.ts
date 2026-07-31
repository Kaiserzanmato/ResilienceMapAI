import { NextRequest, NextResponse } from "next/server";

// Server-only proxy for the RBAC-gated dataset upload endpoint. The backend's
// X-Role header is client-controllable, so as a stopgap (until real auth
// exists) it also requires ADMIN_SHARED_SECRET — which must never reach the
// browser. This route holds that secret server-side and forwards both
// headers; the client (lib/api.ts) calls this same-origin route instead of
// hitting the backend directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET ?? "";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_BASE}/api/datasets/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-role": "dataset_admin",
      ...(ADMIN_SHARED_SECRET ? { authorization: `Bearer ${ADMIN_SHARED_SECRET}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
