/** Global geocoding service using Nominatim (OpenStreetMap).
 * Supports: city, state/province, country, and coordinates worldwide.
 * Falls back to local gazetteer for known high-risk areas.
 */

import { getCountryByAlpha2, searchCountries } from "./country-search";
import { CountryRegistryItem } from "./country-types";

export interface GeocodedLocation {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  countryAlpha2?: string;
  display_name?: string;
  type?: "city" | "region" | "country" | "coordinate";
  boundingbox?: [number, number, number, number];
}

const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
const REVERSE_API = "https://nominatim.openstreetmap.org/reverse";

/** Search for locations globally using Nominatim. */
export async function geocodeLocation(query: string, limit: number = 8): Promise<GeocodedLocation[]> {
  if (!query.trim()) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: limit.toString(),
      "accept-language": "en",
    });

    const res = await fetch(`${NOMINATIM_API}?${params}`, {
      headers: { "User-Agent": "ResilienceMapAI" },
    });

    if (!res.ok) return [];

    const results = await res.json() as Array<{
      name?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string>;
      display_name?: string;
      type?: string;
      boundingbox?: string[];
    }>;

    return results
      .filter((r) => r.lat && r.lon)
      .map((r) => ({
        name: r.name || r.display_name || "Unknown",
        lat: parseFloat(r.lat!),
        lng: parseFloat(r.lon!),
        country: r.address?.country,
        countryAlpha2: r.address?.country_code?.toUpperCase(),
        display_name: r.display_name,
        type: (r.type as any) || "city",
        boundingbox: r.boundingbox
          ? ([
              parseFloat(r.boundingbox[0]),
              parseFloat(r.boundingbox[1]),
              parseFloat(r.boundingbox[2]),
              parseFloat(r.boundingbox[3]),
            ] as [number, number, number, number])
          : undefined,
      }));
  } catch (error) {
    console.error("[geocoding] Search failed:", error);
    return [];
  }
}

/** Reverse geocode coordinates to get location name. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: "json",
      "accept-language": "en",
    });

    const res = await fetch(`${REVERSE_API}?${params}`, {
      headers: { "User-Agent": "ResilienceMapAI" },
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      name?: string;
      lat?: string;
      lon?: string;
      address?: Record<string, string>;
      display_name?: string;
      type?: string;
    };

    if (!data.lat || !data.lon) return null;

    return {
      name: data.name || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      country: data.address?.country,
      countryAlpha2: data.address?.country_code?.toUpperCase(),
      display_name: data.display_name,
      type: "coordinate",
    };
  } catch (error) {
    console.error("[reverse-geocoding] Failed:", error);
    return null;
  }
}

/** Parse coordinates if query is a lat/lng pair (e.g., "40.7128, -74.0060"). */
export function parseCoordinates(query: string): GeocodedLocation | null {
  const match = query.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    lat,
    lng,
    type: "coordinate",
  };
}

/** Resolve country alpha2 from location. */
export function getLocationCountryAlpha2(loc: GeocodedLocation): string | undefined {
  if (loc.countryAlpha2) return loc.countryAlpha2;
  if (loc.country) {
    const found = searchCountries(loc.country, 1);
    return found[0]?.alpha2;
  }
  return undefined;
}
