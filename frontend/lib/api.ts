import type { AIResponse, Dataset, GeocodeResult, InsightResponse, RiskAssessment } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: unknown
  ) {
    super(message);
  }
}

export interface UsageStatus {
  bucket: "insights" | "chat";
  used: number;
  limit: number;
  remaining: number;
  resets_in_seconds: number;
  resets_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    // Most endpoints send detail as a plain string; usage-quota 429s send a
    // structured object ({ message, bucket, resets_at, ... }) — see
    // backend/app/services/usage_quota.py.
    const message =
      typeof detail?.detail === "string"
        ? detail.detail
        : (detail?.detail?.message ?? `Request failed (${res.status})`);
    throw new APIError(message, res.status, detail);
  }
  return res.json();
}

export const api = {
  post: <T,>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  locationRisk: (lat: number, lng: number, name?: string, countryCode?: string) =>
    request<RiskAssessment>(
      `/api/location-risk?lat=${lat}&lng=${lng}${name ? `&name=${encodeURIComponent(name)}` : ""}${countryCode ? `&country_code=${countryCode}` : ""}`
    ),

  compare: (locations: { lat: number; lng: number; name?: string }[]) =>
    request<{ results: RiskAssessment[] }>("/api/compare-locations", {
      method: "POST",
      body: JSON.stringify({ locations }),
    }),

  geocode: (q: string) =>
    request<{ results: GeocodeResult[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),

  assessLocation: (body: { lat: number; lng: number; name?: string; country_code?: string; geometry_type?: string }) =>
    request<Record<string, unknown>>("/api/assessments", { method: "POST", body: JSON.stringify(body) }),

  hazardLayers: (layer: string, format: "geojson" | "heatmap" = "geojson") =>
    request<GeoJSON.FeatureCollection>(`/api/hazard-layers?layer=${layer}&format=${format}`),

  layerIndex: () => request<{ layers: { key: string; label: string }[] }>("/api/hazard-layers/index"),

  hazardEvents: () => request<{ events: import("./types").HazardEvent[]; alerts: import("./types").ActiveAlert[] }>("/api/hazard-events"),

  aiSummary: (body: { lat: number; lng: number; name?: string; persona: string }) =>
    request<AIResponse & { risk: RiskAssessment }>("/api/ai/summary", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  spatialVision: (
    body: {
      user_query: string;
      persona: string;
      map_image_base64: string;
      lat: number;
      lng: number;
      deterministic_scores: Record<string, unknown>;
      active_layers: string[];
    },
    signal?: AbortSignal
  ) =>
    request<{
      status: string;
      persona: string;
      engine: string;
      grounded_analysis: string;
      actionable_recommendations?: string[];
      official_sources: string[];
    }>("/api/ai/spatial-vision", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),

  generateInsights: (lat: number, lng: number, name?: string, hazardLayer: string = "overall", persona: string = "citizen") =>
    request<{ risk: RiskAssessment; insight: InsightResponse }>(
      `/api/generate-insights?lat=${lat}&lng=${lng}${name ? `&name=${encodeURIComponent(name)}` : ""}&hazard_layer=${hazardLayer}&persona=${persona}`,
      { method: "POST" }
    ),

  agentQuery: (body: {
    message: string;
    persona: string;
    lat?: number;
    lng?: number;
    location_name?: string;
    risk_context?: string;
    mapTargetContext?: string;
  }) =>
    request<AIResponse>("/api/agent/query", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  usageStatus: () =>
    request<{ insights: UsageStatus; chat: UsageStatus }>("/api/usage-status"),

  datasets: () => request<{ datasets: Dataset[] }>("/api/datasets"),

  // Routed through a same-origin Next.js proxy (app/api/admin/datasets/upload)
  // rather than straight to the backend — the backend's privileged-role
  // check requires a server-only secret that must never reach the browser.
  uploadDataset: async (meta: {
    name: string;
    agency: string;
    category: string;
    url: string;
    confidence: string;
    records: number;
  }) => {
    const res = await fetch("/api/admin/datasets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new APIError(data?.detail ?? `Request failed (${res.status})`, res.status, data);
    }
    return data as { dataset: Dataset; message: string };
  },

  reports: () =>
    request<{
      reports: { id: string; location: string; persona: string; created_at: string; overall: { score: number | null; level: string; color: string } }[];
    }>("/api/reports"),

  sharedReport: (id: string) =>
    request<{ risk: RiskAssessment; summary: string; persona: string; sources: AIResponse["sources"]; disclaimer: string; created_at: string }>(
      `/api/reports/${id}`
    ),

  shareLink: (body: { lat: number; lng: number; name?: string; persona: string }) =>
    request<{ report_id: string; path: string }>("/api/export/share-link", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

/** Trigger a server-generated file download (PDF/CSV). */
export async function downloadExport(
  kind: "pdf" | "csv",
  body: unknown,
  filename: string
) {
  const res = await fetch(`${API_BASE}/api/export/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
