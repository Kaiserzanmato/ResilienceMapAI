/** Satellite flood-capture helpers shared by the map and the risk panel.
 * Pure functions with no imports, so they can be unit-tested with node:test
 * (tests/flood-evidence.test.mjs). */

export type Bbox = [west: number, south: number, east: number, north: number];

export interface FloodExtentProps {
  id: number;
  source: string;
  scene_id: string;
  acquired_at: string;
  water_area_m2: number;
  /** All open water in the box. Absent on records stored before the permanent-water filter. */
  total_water_ha?: number;
  /** Total minus permanent water; null/absent when the filter did not run (unfiltered). */
  flood_ha?: number | null;
  permanent_water_filtered?: boolean;
  /** The whole capture box. Older responses lack it; then the water polygons' own bounds are used. */
  aoi_bbox?: Bbox | null;
}

export interface FloodFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: FloodExtentProps;
}

export const FLOOD_SOURCE_LABEL: Record<string, string> = {
  "s1-rtc-pc": "Sentinel-1 radar",
  "s2-l2a-e84": "Sentinel-2 optical",
};

/** The API caps a bbox query at this many degrees on a side. */
export const MAX_BBOX_SPAN_DEG = 30;

export function geometryBbox(geometry: FloodFeature["geometry"]): Bbox | null {
  if (!geometry) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      west = Math.min(west, node[0]); east = Math.max(east, node[0]);
      south = Math.min(south, node[1]); north = Math.max(north, node[1]);
    } else {
      node.forEach(walk);
    }
  };
  walk(geometry.coordinates);
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/** The area a capture covers: its capture box, else the water's own bounds. */
export function coverageBbox(feature: FloodFeature): Bbox | null {
  return feature.properties.aoi_bbox ?? geometryBbox(feature.geometry);
}

export function bboxContains(bbox: Bbox, lat: number, lng: number): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/** The newest capture whose box covers the point, or null. */
export function findFloodCapture(features: FloodFeature[] | undefined, lat: number, lng: number): FloodFeature | null {
  let best: FloodFeature | null = null;
  for (const feature of features ?? []) {
    const box = coverageBbox(feature);
    if (!box || !bboxContains(box, lat, lng)) continue;
    if (!best || Date.parse(feature.properties.acquired_at) > Date.parse(best.properties.acquired_at)) best = feature;
  }
  return best;
}

/** Ground distance in km from a point to the nearest edge of a box (0 inside it). */
export function distanceToBboxKm(bbox: Bbox, lat: number, lng: number): number {
  const dLat = Math.max(bbox[1] - lat, 0, lat - bbox[3]);
  const dLng = Math.max(bbox[0] - lng, 0, lng - bbox[2]);
  const kmPerDegree = 111.32;
  return Math.hypot(dLat * kmPerDegree, dLng * kmPerDegree * Math.cos((lat * Math.PI) / 180));
}

/** The closest capture within maxKm of the point (newest wins a tie), with its distance. */
export function nearestCapture(
  features: FloodFeature[] | undefined, lat: number, lng: number, maxKm = 15,
): { feature: FloodFeature; distanceKm: number } | null {
  let best: { feature: FloodFeature; distanceKm: number } | null = null;
  for (const feature of features ?? []) {
    const box = coverageBbox(feature);
    if (!box) continue;
    const distanceKm = distanceToBboxKm(box, lat, lng);
    if (distanceKm > maxKm) continue;
    if (!best || distanceKm < best.distanceKm) best = { feature, distanceKm };
  }
  return best;
}

export interface FloodArea {
  /** Hectares to headline: flooding when the filter ran, else all open water. */
  hectares: number;
  filtered: boolean;
  /** e.g. "about 1,187 ha of flooding (37 ha of permanent water excluded)". */
  text: string;
  /** Set only when permanent water could not be excluded. */
  unfilteredNote: string | null;
}

const UNFILTERED_NOTE = "Permanent water (rivers, lakes, fishponds) could not be excluded for this capture.";
const fmt = (n: number) => n.toLocaleString("en-US");

export function describeFloodArea(props: Pick<FloodExtentProps, "water_area_m2" | "total_water_ha" | "flood_ha" | "permanent_water_filtered">): FloodArea {
  const total = props.total_water_ha ?? props.water_area_m2 / 10_000;
  if (props.flood_ha != null) {
    const flood = Math.round(props.flood_ha);
    const excluded = Math.max(0, Math.round(total - props.flood_ha));
    const text = flood > 0
      ? `about ${fmt(flood)} ha of flooding (${fmt(excluded)} ha of permanent water excluded)`
      : `no flooding detected beyond permanent water (${fmt(excluded)} ha of permanent water excluded)`;
    return { hectares: flood, filtered: true, text, unfilteredNote: null };
  }
  const hectares = Math.round(total);
  const text = hectares > 0 ? `about ${fmt(hectares)} ha of open water` : "no open water detected";
  return { hectares, filtered: false, text, unfilteredNote: UNFILTERED_NOTE };
}

/** What to tell the user when "Flag flooding here" fails. A status of 0/none means the
 * request never got an answer (offline, blocked by the browser, CORS), so nothing was sent. */
export function describeFlagFailure(err: unknown): string {
  const raw = typeof err === "object" && err !== null && "status" in err ? Number((err as { status: unknown }).status) : NaN;
  const status = Number.isFinite(raw) ? raw : 0;
  if (status === 429) return "Flag limit reached (3 per hour). Nothing was sent; you can flag again within an hour.";
  if (status === 404) return "Flood capture isn't available right now. Nothing was sent.";
  if (status >= 500) return `The server had a problem (HTTP ${status}), so the flag wasn't saved. Try again in a minute.`;
  if (status >= 400) return `The flag was rejected (HTTP ${status}). Nothing was saved.`;
  return "Couldn't reach the server, so nothing was sent (offline, or blocked by the browser). Check your connection and try again.";
}

/** One line under the flag button when this spot already has a capture, so a click is
 * never a mystery: what the existing capture is and what flagging again does. */
export function recaptureHint(props: Pick<FloodExtentProps, "acquired_at" | "total_water_ha" | "flood_ha"> | null | undefined): string | null {
  if (!props) return null;
  const date = props.acquired_at.slice(0, 10);
  if (props.flood_ha == null) {
    return `This spot has a capture from the scene of ${date} without the permanent-water filter. Flagging again recaptures it with the filter.`;
  }
  return `This spot was captured from the scene of ${date}. Flagging again checks the newest scene; the same scene is reused, not redone.`;
}

export interface CaptureSummary {
  sourceLabel: string;
  sceneDate: string; // YYYY-MM-DD
  hectares: number;
  /** One line of evidence. Never a risk score. */
  text: string;
}

export function summarizeCapture(props: FloodExtentProps): CaptureSummary {
  const sourceLabel = FLOOD_SOURCE_LABEL[props.source] ?? "Satellite";
  const sceneDate = props.acquired_at.slice(0, 10);
  const area = describeFloodArea(props);
  const note = area.unfilteredNote ? ` ${area.unfilteredNote}` : "";
  return {
    sourceLabel, sceneDate, hectares: area.hectares,
    text: `${sourceLabel}, scene of ${sceneDate}: ${area.text} in the captured 5 km box.${note}`,
  };
}

/** Bbox string for /api/flood/extents for the current view, padded and rounded
 * outward to 0.5 degrees so small pans reuse the same cached query. null when the
 * view is wider than the API accepts (then the capped global list is used). */
export function viewportBboxParam(view: Bbox): string | null {
  const [west, south, east, north] = view;
  if (east - west > MAX_BBOX_SPAN_DEG - 1 || north - south > MAX_BBOX_SPAN_DEG - 1) return null;
  const step = 0.5;
  const w = Math.max(-180, Math.floor((west - step) / step) * step);
  const s = Math.max(-90, Math.floor((south - step) / step) * step);
  const e = Math.min(180, Math.ceil((east + step) / step) * step);
  const n = Math.min(90, Math.ceil((north + step) / step) * step);
  if (e - w > MAX_BBOX_SPAN_DEG || n - s > MAX_BBOX_SPAN_DEG) return null;
  return `${w},${s},${e},${n}`;
}

/** Small box around a point, for "is there a capture here" lookups. */
export function pointBboxParam(lat: number, lng: number, radiusDeg = 0.1): string {
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  return `${r(lng - radiusDeg)},${r(lat - radiusDeg)},${r(lng + radiusDeg)},${r(lat + radiusDeg)}`;
}

/** Capture boxes as a GeoJSON collection, for the dashed outline drawn at every zoom. */
export function aoiCollection(features: FloodFeature[] | undefined): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = [];
  for (const feature of features ?? []) {
    const box = coverageBbox(feature);
    if (!box) continue;
    const [w, s, e, n] = box;
    out.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
      properties: { ...feature.properties, centerLng: (w + e) / 2, centerLat: (s + n) / 2 },
    });
  }
  return { type: "FeatureCollection", features: out };
}

/** One point per capture (the centre of its box), drawn as a marker at low zoom,
 * where a 5 km box of small ponds would otherwise be a few invisible pixels. */
export function markerCollection(features: FloodFeature[] | undefined): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: aoiCollection(features).features.map((box) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(box.properties?.centerLng), Number(box.properties?.centerLat)],
      },
      properties: box.properties,
    })),
  };
}
