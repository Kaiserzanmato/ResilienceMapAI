import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { clientKeyFromRequest, isRateLimited } from "@/lib/rateLimit";

// Server-only proxy for the RBAC-gated dataset sync trigger. Mirrors
// app/api/admin/datasets/upload/route.ts: the caller must prove they know
// ADMIN_SHARED_SECRET via the x-admin-key header before this route attaches
// the real secret and forwards to the backend's manage_datasets-gated
// endpoint. The client (lib/api.ts) calls this same-origin route instead of
// hitting the backend directly, so the secret never reaches the browser.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ADMIN_SHARED_SECRET = process.env.ADMIN_SHARED_SECRET ?? "";

// Tight budget — this gates a shared secret, not a quota-capped API key, so
// the limit exists to make online brute-forcing impractical rather than to
// protect an upstream quota.
const MAX_ATTEMPTS_PER_WINDOW = 5;

function isValidAdminKey(provided: string | null): boolean {
  if (!ADMIN_SHARED_SECRET || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_SHARED_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKeyFromRequest(request, "admin-datasets-sync"), MAX_ATTEMPTS_PER_WINDOW)) {
    return NextResponse.json({ detail: "Rate limit exceeded" }, { status: 429 });
  }
  if (!isValidAdminKey(request.headers.get("x-admin-key"))) {
    return NextResponse.json({ detail: "Invalid or missing admin key" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE}/api/data-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-role": "dataset_admin",
      authorization: `Bearer ${ADMIN_SHARED_SECRET}`,
    },
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
