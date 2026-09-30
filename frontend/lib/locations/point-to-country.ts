import { COUNTRY_REGISTRY } from "./country-registry";

/**
 * Resolve the ISO 3166-1 alpha-2 code for a coordinate using the bundled
 * Natural Earth 110m boundaries. Loaded lazily so the atlas stays out of the
 * initial map bundle. Returns undefined over open water / unresolved points; the
 * API derives the country server-side in that case.
 */
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
