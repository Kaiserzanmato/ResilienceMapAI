"use client";
import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from "geojson";

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface WorldAtlasResult {
  countries: FeatureCollection | null;
  error: boolean;
  loading: boolean;
}

export function useWorldAtlas(): WorldAtlasResult {
  const [countries, setCountries] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(WORLD_ATLAS_URL, { cache: "force-cache" });
        if (!res.ok) throw new Error("fetch failed");
        const topology = (await res.json()) as Topology<{
          countries: GeometryCollection;
        }>;
        if (cancelled) return;
        const fc = feature(
          topology,
          topology.objects.countries
        ) as unknown as FeatureCollection;
        setCountries(fc);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { countries, error, loading };
}
