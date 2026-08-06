"use client";
import { useMemo } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import worldAtlasTopology from "./countries-110m.json";

interface WorldAtlasResult {
  countries: FeatureCollection | null;
  error: boolean;
  loading: boolean;
}

// Bundled as a module import rather than fetched at runtime. It previously
// fetched the same file from /public with `cache: "force-cache"` — but
// force-cache ignores the server's Cache-Control (must-revalidate) and can
// pin whatever response is already in the browser's HTTP cache
// indefinitely, never re-checking the server. That's exactly why the globe
// rendered after a hard refresh (bypasses all caches) but not on a normal
// load or soft refresh (reused the pinned response, which could be from a
// stale or failed prior fetch). Bundling the topology directly removes the
// network/cache dependency — and therefore this entire bug class — outright.
let cached: FeatureCollection | null = null;
function getCountries(): FeatureCollection {
  if (!cached) {
    const topology = worldAtlasTopology as unknown as Topology<{
      countries: GeometryCollection;
    }>;
    cached = feature(
      topology,
      topology.objects.countries
    ) as unknown as FeatureCollection;
  }
  return cached;
}

export function useWorldAtlas(): WorldAtlasResult {
  const countries = useMemo(() => getCountries(), []);
  return { countries, error: false, loading: false };
}
