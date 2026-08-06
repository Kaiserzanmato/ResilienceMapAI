/** Location helpers for results resolved by the backend provider gateway. */

import { searchCountries } from "./country-search";

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
