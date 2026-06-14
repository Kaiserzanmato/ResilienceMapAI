import type { RiskDomain, ConfidenceCategory, TrustLevel } from "../registry/sources.registry";

export interface RiskEvent {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceEventUrl?: string;
  title: string;
  description?: string;
  domain: RiskDomain;
  eventType: string;
  country?: string;
  region?: string;
  adminArea?: string;
  latitude?: number;
  longitude?: number;
  geometry?: GeoJSON.Geometry;
  severity?: "low" | "medium" | "high" | "critical" | "unknown";
  confidence: "low" | "medium" | "high";
  startedAt?: string;
  endedAt?: string;
  updatedAt?: string;
  ingestedAt: string;
  confidenceCategory: ConfidenceCategory;
  trustLevel: TrustLevel;
  rawPayload?: unknown;
}

/** Map a raw GDACS-style event to the normalized RiskEvent schema. */
export function normalizeGdacsEvent(raw: Record<string, unknown>): RiskEvent {
  return {
    id: `gdacs-${raw.eventid ?? raw.id ?? Date.now()}`,
    sourceId: "gdacs",
    sourceName: "GDACS",
    sourceUrl: "https://www.gdacs.org",
    sourceEventUrl: raw.link as string | undefined,
    title: (raw.title ?? raw.name ?? "GDACS Event") as string,
    description: raw.description as string | undefined,
    domain: "natural_hazards",
    eventType: (raw.eventtype ?? raw.type ?? "unknown") as string,
    country: raw.country as string | undefined,
    latitude: raw.lat as number | undefined,
    longitude: raw.lon as number | undefined,
    severity: mapAlertLevel(raw.alertlevel as string | undefined),
    confidence: "high",
    startedAt: raw.fromdate as string | undefined,
    endedAt: raw.todate as string | undefined,
    updatedAt: raw.todate as string | undefined,
    ingestedAt: new Date().toISOString(),
    confidenceCategory: "official_warning",
    trustLevel: 1,
    rawPayload: raw,
  };
}

/** Map a USGS GeoJSON feature to RiskEvent. */
export function normalizeUsgsEvent(raw: {
  id: string;
  properties: Record<string, unknown>;
  geometry?: { coordinates?: number[] };
}): RiskEvent {
  const p = raw.properties;
  const coords = raw.geometry?.coordinates;
  return {
    id: `usgs-${raw.id}`,
    sourceId: "usgs-earthquake",
    sourceName: "USGS",
    sourceUrl: "https://earthquake.usgs.gov",
    sourceEventUrl: p.url as string | undefined,
    title: (p.title ?? p.place ?? "USGS Earthquake") as string,
    description: `M${p.mag} ${p.type} — ${p.place}`,
    domain: "natural_hazards",
    eventType: "earthquake",
    latitude: coords ? (coords[1] as number) : undefined,
    longitude: coords ? (coords[0] as number) : undefined,
    severity: usgsToSeverity(p.mag as number),
    confidence: "high",
    startedAt: p.time ? new Date(p.time as number).toISOString() : undefined,
    updatedAt: p.updated ? new Date(p.updated as number).toISOString() : undefined,
    ingestedAt: new Date().toISOString(),
    confidenceCategory: "official_observation",
    trustLevel: 1,
    rawPayload: raw,
  };
}

/** Map a ReliefWeb API disaster object to RiskEvent. */
export function normalizeReliefWebEvent(raw: {
  id: number | string;
  fields: Record<string, unknown>;
}): RiskEvent {
  const f = raw.fields;
  const country = Array.isArray(f.country)
    ? (f.country as Array<{ iso3?: string }>)[0]?.iso3
    : undefined;
  return {
    id: `reliefweb-${raw.id}`,
    sourceId: "reliefweb",
    sourceName: "ReliefWeb",
    sourceUrl: "https://reliefweb.int",
    title: (f.name ?? f.title ?? "ReliefWeb Event") as string,
    description: f.body as string | undefined,
    domain: "humanitarian",
    eventType: ((f.type as Array<{ name?: string }> | undefined)?.[0]?.name ?? "disaster") as string,
    country,
    severity: (f.status === "alert" ? "high" : "medium") as RiskEvent["severity"],
    confidence: "high",
    startedAt: (f.date as { event?: string } | undefined)?.event,
    updatedAt: (f.date as { changed?: string } | undefined)?.changed,
    ingestedAt: new Date().toISOString(),
    confidenceCategory: "humanitarian_report",
    trustLevel: 2,
    rawPayload: raw,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapAlertLevel(level?: string): RiskEvent["severity"] {
  switch ((level ?? "").toLowerCase()) {
    case "green": return "low";
    case "orange": return "medium";
    case "red": return "high";
    default: return "unknown";
  }
}

function usgsToSeverity(mag?: number): RiskEvent["severity"] {
  if (mag == null) return "unknown";
  if (mag >= 7.0) return "critical";
  if (mag >= 5.5) return "high";
  if (mag >= 4.0) return "medium";
  return "low";
}
