import type { AIResponse, Dataset, GeocodeResult, RiskAssessment } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: any
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new APIError(
      detail?.detail ?? `Request failed (${res.status})`,
      res.status,
      detail
    );
  }
  return res.json();
}

export const api = {
  post: <T,>(path: string, body: any) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  locationRisk: (lat: number, lng: number, name?: string) =>
    request<RiskAssessment>(
      `/api/location-risk?lat=${lat}&lng=${lng}${name ? `&name=${encodeURIComponent(name)}` : ""}`
    ),

  compare: (locations: { lat: number; lng: number; name?: string }[]) =>
    request<{ results: RiskAssessment[] }>("/api/compare-locations", {
      method: "POST",
      body: JSON.stringify({ locations }),
    }),

  geocode: (q: string) =>
    request<{ results: GeocodeResult[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),

  hazardLayers: (layer: string, format: "geojson" | "heatmap" = "geojson") =>
    request<GeoJSON.FeatureCollection>(`/api/hazard-layers?layer=${layer}&format=${format}`),

  layerIndex: () => request<{ layers: { key: string; label: string }[] }>("/api/hazard-layers/index"),

  hazardEvents: () => request<{ events: import("./types").HazardEvent[]; alerts: import("./types").ActiveAlert[] }>("/api/hazard-events"),

  aiSummary: (body: { lat: number; lng: number; name?: string; persona: string }) =>
    request<AIResponse & { risk: RiskAssessment }>("/api/ai/summary", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  agentQuery: (body: {
    message: string;
    persona: string;
    lat?: number;
    lng?: number;
    location_name?: string;
  }) =>
    request<AIResponse>("/api/agent/query", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  datasets: () => request<{ datasets: Dataset[] }>("/api/datasets"),

  uploadDataset: (meta: {
    name: string;
    agency: string;
    category: string;
    url: string;
    confidence: string;
    records: number;
  }) =>
    request<{ dataset: Dataset; message: string }>("/api/datasets/upload", {
      method: "POST",
      headers: { "x-role": "dataset_admin" },
      body: JSON.stringify(meta),
    }),

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
