/** Route data sources by country, domain, and coverage type. */
import { countryBelongsToRegion, getCountryByAlpha2 } from "@/lib/locations/country-search";
import { RiskDomain } from "../registry/sources.registry";
import { SOURCE_REGISTRY } from "../registry/sources.registry";

export function selectSourcesForCountry(countryAlpha2: string, riskDomain: RiskDomain) {
  const country = getCountryByAlpha2(countryAlpha2);
  if (!country) return [];

  return SOURCE_REGISTRY.filter((source) => {
    if (!source.enabled) return false;
    if (!source.domains.includes(riskDomain)) return false;

    if (source.coverage === "global") return true;

    if (source.coverage === "country-specific") {
      return source.countrySpecific?.includes(countryAlpha2) || false;
    }

    if (source.coverage === "regional") {
      const sourceRegions = source.regions || [];
      return sourceRegions.some((region) => countryBelongsToRegion(countryAlpha2, region as any));
    }

    return false;
  }).sort((a, b) => a.trustLevel - b.trustLevel);
}

export function getCountrySources(countryAlpha2: string) {
  const country = getCountryByAlpha2(countryAlpha2);
  if (!country) return { global: [], regional: [], countrySpecific: [] };

  const globalSources = SOURCE_REGISTRY.filter((s) => s.enabled && s.coverage === "global").map((s) => s.id);

  const countrySources = SOURCE_REGISTRY.filter((s) => s.enabled && s.coverage === "country-specific");
  const countrySpecific = countrySources.filter((s) => s.countrySpecific?.includes(countryAlpha2)).map((s) => s.id);

  const regionalSources = SOURCE_REGISTRY.filter((s) => s.enabled && s.coverage === "regional");
  const regional = regionalSources.filter((s) =>
    s.regions?.some((region) => countryBelongsToRegion(countryAlpha2, region as any))
  ).map((s) => s.id);

  return { global: globalSources, regional, countrySpecific };
}
