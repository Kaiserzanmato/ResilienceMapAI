import { COUNTRY_REGISTRY } from "./country-registry";

/**
 * Resolve the ISO 3166-1 alpha-2 code for a coordinate using the bundled
 * Natural Earth 110m boundaries. Loaded lazily so the atlas stays out of the
 * initial map bundle. Returns undefined over open water / unresolved points; the
 * API derives the country server-side in that case.
 */
/** Natural Earth 110m omits many small states (e.g. Singapore falls inside Malaysia),
 * so these approximate boxes are checked, in order, BEFORE the polygon lookup.
 * States the polygons already contain (e.g. LU, BN) are deliberately left out:
 * a rectangle would only replace a correct polygon result.
 * [code, west, south, east, north]. Keep identical to SMALL_COUNTRY_BOXES in
 * backend/app/services/country_lookup.py (a backend test enforces it). They are coarse
 * rectangles: near a shared border they can claim a sliver of a neighbour. */
export const SMALL_COUNTRY_BOXES: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ["SG", 103.6, 1.15, 104.05, 1.47],
  ["HK", 113.83, 22.15, 114.43, 22.5],
  ["MO", 113.52, 22.1, 113.6, 22.217],
  ["BH", 50.35, 25.65, 50.85, 26.35],
  ["MT", 14.17, 35.78, 14.6, 36.09],
  ["MV", 72.55, -0.8, 73.8, 7.15],
  ["AD", 1.41, 42.43, 1.79, 42.66],
  ["MC", 7.4, 43.72, 7.44, 43.76],
  ["LI", 9.47, 47.05, 9.64, 47.27],
  ["SM", 12.4, 43.89, 12.52, 43.99],
];

export function smallCountryOverride(lat: number, lng: number): string | undefined {
  return SMALL_COUNTRY_BOXES.find(([, west, south, east, north]) => lng >= west && lng <= east && lat >= south && lat <= north)?.[0];
}

type Atlas = { features: Array<{ id?: string | number; geometry: unknown }> };

let atlasPromise: Promise<Atlas> | null = null;
let alpha2ByNumeric: Map<string, string> | null = null;

function loadAtlas(): Promise<Atlas> {
  if (!atlasPromise) {
    atlasPromise = Promise.all([
      import("topojson-client"),
      import("@/components/globe/countries-110m.json"),
    ]).then(([{ feature }, atlas]) => {
      const topology = (atlas.default ?? atlas) as never as Parameters<typeof feature>[0];
      const objects = (topology as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects;
      return feature(topology, objects.countries) as unknown as Atlas;
    });
  }
  return atlasPromise;
}

function numericToAlpha2(numeric: string): string | undefined {
  if (!alpha2ByNumeric) {
    alpha2ByNumeric = new Map(
      COUNTRY_REGISTRY.flatMap((country): Array<[string, string]> => (country.numeric ? [[country.numeric, country.alpha2]] : [])),
    );
  }
  return alpha2ByNumeric.get(numeric.padStart(3, "0"));
}

export async function pointToCountry(lat: number, lng: number): Promise<string | undefined> {
  const override = smallCountryOverride(lat, lng);
  if (override) return override;
  try {
    const [{ geoContains }, atlas] = await Promise.all([import("d3-geo"), loadAtlas()]);
    const match = atlas.features.find((f) =>
      geoContains(f as unknown as Parameters<typeof geoContains>[0], [lng, lat]),
    );
    return match?.id !== undefined ? numericToAlpha2(String(match.id)) : undefined;
  } catch {
    return undefined;
  }
}
