/** ISO 3166-1 country/territory registry types. */

export type CountryRegistryItem = {
  name: string;
  alpha2: string;
  alpha3: string;
  numeric?: string;
  officialName?: string;
  aliases?: string[];
  enabled: boolean;
};

export type Region =
  | "africa"
  | "americas"
  | "asia"
  | "europe"
  | "oceania"
  | "southeast_asia"
  | "south_asia"
  | "east_asia"
  | "middle_east";

export type CountrySourceCoverage = {
  countryAlpha2: string;
  countryName: string;
  globalSources: string[];
  regionalSources: string[];
  countrySpecificSources: string[];
  regions: Region[];
};
