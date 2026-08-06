/** Hover telemetry for RiskMap: reads whatever risk-zone/heatmap features are
 * already rendered under the cursor (no extra network calls) and reports
 * them at a debounced cadence so panning stays smooth.
 *
 * Property names below must match the GeoJSON produced by
 * `backend/app/services/geospatial_query.py::hazard_layer_geojson` — there
 * is no separate fault/flood layer in this app (that was assumed by an
 * earlier draft of this feature); "risk-zones-fill" is the only vector
 * layer with per-feature risk attributes.
 *
 * Deliberately does NOT clear the payload on canvas `mouseleave`: the
 * telemetry card renders as a sibling overlay on top of the canvas, so
 * moving the cursor onto the card itself (e.g. to click its "Analyze with
 * AI" button) also fires a canvas `mouseleave` — clearing on that event
 * would unmount the card out from under the cursor before the click could
 * land. The caller owns dismissal instead (see RiskMap.tsx's close button).
 */
import type { Map as MLMap, MapMouseEvent } from "maplibre-gl";

export interface TelemetryPayload {
  lat: number;
  lng: number;
  name?: string;
  country?: string;
  hazard?: string;
  score?: number;
  level?: string;
  population?: number;
}

const HOVER_DEBOUNCE_MS = 40;
const TELEMETRY_LAYERS = ["risk-zones-fill", "risk-heatmap"] as const;

interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced;
}

export function attachHoverTelemetry(
  map: MLMap,
  onUpdate: (data: TelemetryPayload) => void
): () => void {
  const handleMouseMove = debounce((e: MapMouseEvent) => {
    const { lng, lat } = e.lngLat;
    const layers = TELEMETRY_LAYERS.filter((id) => map.getLayer(id));
    const features = layers.length
      ? map.queryRenderedFeatures(e.point, { layers: [...layers] })
      : [];

    const zone = features.find((f) => f.layer.id === "risk-zones-fill");
    const props = (zone?.properties ?? {}) as Record<string, unknown>;

    onUpdate({
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      name: typeof props.name === "string" ? props.name : undefined,
      country: typeof props.country === "string" ? props.country : undefined,
      hazard: typeof props.hazard === "string" ? props.hazard : undefined,
      score: typeof props.score === "number" ? props.score : undefined,
      level: typeof props.level === "string" ? props.level : undefined,
      population: typeof props.population === "number" ? props.population : undefined,
    });
  }, HOVER_DEBOUNCE_MS);

  map.on("mousemove", handleMouseMove);
  return () => {
    // Cancel first: a pending debounced call would otherwise still fire
    // ~40ms after detach and call onUpdate() on an unmounted component (and
    // queryRenderedFeatures on a map that may already be map.remove()'d).
    handleMouseMove.cancel();
    map.off("mousemove", handleMouseMove);
  };
}
