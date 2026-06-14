/** Search and lookup helpers for country registry. */
import { COUNTRY_REGISTRY, getCountryByAlpha2 as _getCountryByAlpha2 } from "./country-registry";
import { CountryRegistryItem, Region } from "./country-types";

export { getCountryByAlpha2 } from "./country-registry";

export function searchCountries(query: string, limit: number = 8): CountryRegistryItem[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase();
  const results: CountryRegistryItem[] = [];

  for (const country of COUNTRY_REGISTRY) {
    if (!country.enabled) continue;


    // Exact/prefix match on name
    if (country.name.toLowerCase().startsWith(q)) {
      results.push(country);
      continue;
    }

    // Substring match on name
    if (country.name.toLowerCase().includes(q)) {
      results.push(country);
      continue;
    }

    // Match on alpha2 or alpha3
    if (country.alpha2.startsWith(q.toUpperCase()) || country.alpha3.startsWith(q.toUpperCase())) {
      results.push(country);
      continue;
    }

    // Match on aliases
    if (country.aliases?.some((a) => a.toLowerCase().includes(q))) {
      results.push(country);
      continue;
    }

    // Match on official name
    if (country.officialName?.toLowerCase().includes(q)) {
      results.push(country);
    }
  }

  return results.slice(0, limit);
}

/** Region assignment — customize based on UN M49 or app-specific regions. */
export function getCountryRegions(alpha2: string): Region[] {
  const regionMap: Record<string, Region[]> = {
    // Africa
    DZ: ["africa"], EG: ["africa"], ET: ["africa"], KE: ["africa"], NG: ["africa"], ZA: ["africa"], TZ: ["africa"], UG: ["africa"],
    GH: ["africa"], SN: ["africa"], CM: ["africa"], MA: ["africa"], BW: ["africa"], ZM: ["africa"], ZW: ["africa"], MZ: ["africa"],
    TN: ["africa"], MW: ["africa"], RW: ["africa"], SS: ["africa"], SD: ["africa"], DJ: ["africa"], ER: ["africa"], SO: ["africa"],
    // Americas
    US: ["americas"], CA: ["americas"], MX: ["americas"], BR: ["americas"], AR: ["americas"], CL: ["americas"], CO: ["americas"],
    PE: ["americas"], VE: ["americas"], EC: ["americas"], BO: ["americas"], PY: ["americas"], UY: ["americas"], JM: ["americas"],
    CR: ["americas"], PA: ["americas"], GT: ["americas"], HN: ["americas"], SV: ["americas"], NI: ["americas"], DO: ["americas"],
    // Asia
    CN: ["asia", "east_asia"], JP: ["asia", "east_asia"], KR: ["asia", "east_asia"], KP: ["asia", "east_asia"],
    IN: ["asia", "south_asia"], BD: ["asia", "south_asia"], PK: ["asia", "south_asia"], LK: ["asia", "south_asia"],
    ID: ["asia", "southeast_asia"], PH: ["asia", "southeast_asia"], TH: ["asia", "southeast_asia"], MY: ["asia", "southeast_asia"],
    VN: ["asia", "southeast_asia"], KH: ["asia", "southeast_asia"], LA: ["asia", "southeast_asia"], MM: ["asia", "southeast_asia"],
    BN: ["asia", "southeast_asia"], SG: ["asia", "southeast_asia"], TW: ["asia", "east_asia"],
    IR: ["asia", "middle_east"], IQ: ["asia", "middle_east"], SA: ["asia", "middle_east"], AE: ["asia", "middle_east"],
    QA: ["asia", "middle_east"], KW: ["asia", "middle_east"], BH: ["asia", "middle_east"], OM: ["asia", "middle_east"],
    YE: ["asia", "middle_east"], IL: ["asia", "middle_east"], JO: ["asia", "middle_east"], LB: ["asia", "middle_east"],
    SY: ["asia", "middle_east"], TR: ["asia", "middle_east"], KZ: ["asia"], KG: ["asia"], TJ: ["asia"], UZ: ["asia"],
    TM: ["asia"], AF: ["asia"], NP: ["asia", "south_asia"], BT: ["asia", "south_asia"],
    // Europe
    DE: ["europe"], FR: ["europe"], GB: ["europe"], IT: ["europe"], ES: ["europe"], PL: ["europe"], RU: ["europe"],
    UA: ["europe"], RO: ["europe"], NL: ["europe"], BE: ["europe"], AT: ["europe"], CH: ["europe"], SE: ["europe"],
    NO: ["europe"], DK: ["europe"], FI: ["europe"], GR: ["europe"], PT: ["europe"], CZ: ["europe"], SK: ["europe"],
    HU: ["europe"], HR: ["europe"], BA: ["europe"], RS: ["europe"], BG: ["europe"], LT: ["europe"], LV: ["europe"],
    EE: ["europe"], IS: ["europe"], IE: ["europe"], LU: ["europe"], MT: ["europe"], CY: ["europe"], MK: ["europe"],
    AL: ["europe"], ME: ["europe"], MD: ["europe"], SI: ["europe"], LI: ["europe"], MC: ["europe"], SM: ["europe"],
    // Oceania
    AU: ["oceania"], NZ: ["oceania"], FJ: ["oceania"], SB: ["oceania"], VU: ["oceania"], TO: ["oceania"], WS: ["oceania"],
    KI: ["oceania"], MH: ["oceania"], PW: ["oceania"], FM: ["oceania"], NC: ["oceania"], PF: ["oceania"],
  };

  return regionMap[alpha2] || [];
}

export function countryBelongsToRegion(alpha2: string, region: Region): boolean {
  return getCountryRegions(alpha2).includes(region);
}

export function getCountriesInRegion(region: Region): CountryRegistryItem[] {
  return COUNTRY_REGISTRY.filter((c) => c.enabled && getCountryRegions(c.alpha2).includes(region));
}
