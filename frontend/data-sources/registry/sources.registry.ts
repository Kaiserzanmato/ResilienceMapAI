export type RiskDomain =
  | "natural_hazards"
  | "climate"
  | "humanitarian"
  | "conflict_security"
  | "aviation"
  | "maritime"
  | "infrastructure"
  | "supply_chain"
  | "force_majeure";

export type ConfidenceCategory =
  | "official_warning"
  | "official_observation"
  | "model_forecast"
  | "satellite_detection"
  | "humanitarian_report"
  | "conflict_event_dataset"
  | "historical_record"
  | "climate_projection"
  | "aviation_advisory"
  | "maritime_security_alert"
  | "economic_indicator"
  | "manual_curated_record";

export type AccessType =
  | "api"
  | "rss"
  | "geojson"
  | "csv"
  | "kml"
  | "shapefile"
  | "download"
  | "portal"
  | "manual";

export type SyncStatus = "success" | "failed" | "partial" | "disabled";
export type Coverage = "global" | "regional" | "country";
export type TrustLevel = 1 | 2 | 3 | 4 | 5;

export interface RiskSource {
  id: string;
  name: string;
  organization: string;
  url: string;
  docsUrl?: string;
  accessType: AccessType;
  coverage: Coverage;
  countries?: string[];
  regions?: string[];
  domains: RiskDomain[];
  trustLevel: TrustLevel;
  confidenceCategory: ConfidenceCategory;
  enabled: boolean;
  autoSyncEnabled: boolean;
  syncFrequencyMinutes?: number;
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncStatus?: SyncStatus;
  nextSyncAt?: string;
  requiresApiKey?: boolean;
  requiresRegistration?: boolean;
  rateLimitNotes?: string;
  licenseNotes?: string;
}

export const SOURCE_REGISTRY: RiskSource[] = [
  // ── Global Disaster & Natural Hazard ──────────────────────────────────────
  {
    id: "gdacs",
    name: "GDACS",
    organization: "European Commission / United Nations",
    url: "https://www.gdacs.org",
    docsUrl: "https://www.gdacs.org/gdacsapi/swagger/index.html",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 10,
    licenseNotes: "Free for non-commercial use with attribution",
  },
  {
    id: "gdacs-rss",
    name: "GDACS RSS Feeds",
    organization: "European Commission / United Nations",
    url: "https://www.gdacs.org/feed_reference.aspx",
    accessType: "rss",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 10,
  },
  {
    id: "nasa-eonet",
    name: "NASA EONET",
    organization: "NASA",
    url: "https://eonet.gsfc.nasa.gov",
    docsUrl: "https://eonet.gsfc.nasa.gov/docs/v3",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "satellite_detection",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 10,
  },
  {
    id: "nasa-open-apis",
    name: "NASA Open APIs",
    organization: "NASA",
    url: "https://api.nasa.gov",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: false,
    requiresApiKey: true,
    rateLimitNotes: "1000 req/hour with API key",
  },
  {
    id: "nasa-firms",
    name: "NASA FIRMS",
    organization: "NASA",
    url: "https://firms.modaps.eosdis.nasa.gov",
    docsUrl: "https://firms.modaps.eosdis.nasa.gov/api",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "satellite_detection",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 30,
    requiresApiKey: true,
    rateLimitNotes: "Requires free MAP_KEY registration",
  },
  {
    id: "usgs-earthquake",
    name: "USGS Earthquake Hazards Program",
    organization: "USGS",
    url: "https://earthquake.usgs.gov",
    docsUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    accessType: "geojson",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 5,
  },
  {
    id: "usgs-event-api",
    name: "USGS Earthquake Event API",
    organization: "USGS",
    url: "https://earthquake.usgs.gov/fdsnws/event/1/",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 5,
  },
  {
    id: "noaa",
    name: "NOAA",
    organization: "NOAA",
    url: "https://www.noaa.gov",
    accessType: "portal",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "noaa-nws-api",
    name: "NOAA NWS API",
    organization: "NOAA",
    url: "https://www.weather.gov/documentation/services-web-api",
    accessType: "api",
    coverage: "global",
    countries: ["US"],
    domains: ["natural_hazards", "climate"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 15,
  },
  {
    id: "noaa-ncei",
    name: "NOAA NCEI",
    organization: "NOAA",
    url: "https://www.ncei.noaa.gov",
    accessType: "portal",
    coverage: "global",
    domains: ["climate", "natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "historical_record",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "copernicus-ems",
    name: "Copernicus Emergency Management Service",
    organization: "European Commission",
    url: "https://emergency.copernicus.eu",
    accessType: "portal",
    coverage: "global",
    regions: ["Europe"],
    domains: ["natural_hazards", "humanitarian"],
    trustLevel: 4,
    confidenceCategory: "satellite_detection",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "copernicus-dataspace",
    name: "Copernicus Data Space APIs",
    organization: "European Commission",
    url: "https://dataspace.copernicus.eu/analyse/apis",
    accessType: "api",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 4,
    confidenceCategory: "satellite_detection",
    enabled: true,
    autoSyncEnabled: false,
    requiresRegistration: true,
  },

  // ── Humanitarian ──────────────────────────────────────────────────────────
  {
    id: "reliefweb",
    name: "ReliefWeb",
    organization: "UN OCHA",
    url: "https://reliefweb.int",
    docsUrl: "https://apidoc.reliefweb.int",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian", "natural_hazards"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 120,
  },
  {
    id: "un-ocha",
    name: "UN OCHA",
    organization: "United Nations",
    url: "https://www.unocha.org",
    accessType: "portal",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "hdx",
    name: "Humanitarian Data Exchange",
    organization: "UN OCHA",
    url: "https://data.humdata.org",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 360,
  },
  {
    id: "unicef-data",
    name: "UNICEF Data",
    organization: "UNICEF",
    url: "https://data.unicef.org",
    docsUrl: "https://sdmx.data.unicef.org/ws/public/sdmxapi/rest/",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "ifrc-go",
    name: "IFRC GO Platform",
    organization: "International Federation of Red Cross",
    url: "https://go.ifrc.org",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 180,
  },
  {
    id: "undp-data",
    name: "UNDP Data Futures Platform",
    organization: "UNDP",
    url: "https://data.undp.org",
    accessType: "portal",
    coverage: "global",
    domains: ["humanitarian", "climate"],
    trustLevel: 2,
    confidenceCategory: "economic_indicator",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "unhcr-data",
    name: "UNHCR Operational Data Portal",
    organization: "UNHCR",
    url: "https://data.unhcr.org",
    docsUrl: "https://data.unhcr.org/en/api/api-registration",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: false,
    requiresRegistration: true,
  },
  {
    id: "iom-data",
    name: "IOM Data and Research",
    organization: "IOM",
    url: "https://www.iom.int/data-and-research",
    accessType: "portal",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 2,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "idmc",
    name: "IDMC Global Internal Displacement Database",
    organization: "Internal Displacement Monitoring Centre",
    url: "https://www.internal-displacement.org/database/api-documentation/",
    accessType: "api",
    coverage: "global",
    domains: ["humanitarian"],
    trustLevel: 3,
    confidenceCategory: "humanitarian_report",
    enabled: true,
    autoSyncEnabled: false,
    requiresRegistration: true,
  },

  // ── Climate & Resilience ──────────────────────────────────────────────────
  {
    id: "worldbank-climate",
    name: "World Bank Climate Change Knowledge Portal",
    organization: "World Bank",
    url: "https://climateknowledgeportal.worldbank.org",
    docsUrl: "https://climateknowledgeportal.worldbank.org/download-data",
    accessType: "api",
    coverage: "global",
    domains: ["climate"],
    trustLevel: 3,
    confidenceCategory: "climate_projection",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "worldbank-open",
    name: "World Bank Open Data",
    organization: "World Bank",
    url: "https://data.worldbank.org",
    docsUrl: "https://api.worldbank.org",
    accessType: "api",
    coverage: "global",
    domains: ["climate", "humanitarian"],
    trustLevel: 3,
    confidenceCategory: "economic_indicator",
    enabled: true,
    autoSyncEnabled: true,
    syncFrequencyMinutes: 43200,
  },
  {
    id: "worldbank-data360",
    name: "World Bank Data360 API",
    organization: "World Bank",
    url: "https://data360.worldbank.org/en/api",
    accessType: "api",
    coverage: "global",
    domains: ["climate", "humanitarian"],
    trustLevel: 3,
    confidenceCategory: "economic_indicator",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "wmo",
    name: "World Meteorological Organization",
    organization: "WMO",
    url: "https://wmo.int",
    accessType: "portal",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 3,
    confidenceCategory: "model_forecast",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "undrr",
    name: "UNDRR",
    organization: "United Nations",
    url: "https://www.undrr.org",
    accessType: "portal",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 3,
    confidenceCategory: "historical_record",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "preventionweb",
    name: "PreventionWeb",
    organization: "UNDRR",
    url: "https://www.preventionweb.net",
    accessType: "portal",
    coverage: "global",
    domains: ["natural_hazards", "climate"],
    trustLevel: 3,
    confidenceCategory: "historical_record",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "emdat",
    name: "EM-DAT International Disaster Database",
    organization: "CRED",
    url: "https://www.emdat.be",
    accessType: "download",
    coverage: "global",
    domains: ["natural_hazards", "humanitarian"],
    trustLevel: 3,
    confidenceCategory: "historical_record",
    enabled: true,
    autoSyncEnabled: false,
    requiresRegistration: true,
  },

  // ── Conflict & Security ───────────────────────────────────────────────────
  {
    id: "acled",
    name: "ACLED",
    organization: "Armed Conflict Location & Event Data Project",
    url: "https://acleddata.com",
    docsUrl: "https://acleddata.com/acled-api-documentation",
    accessType: "api",
    coverage: "global",
    domains: ["conflict_security"],
    trustLevel: 3,
    confidenceCategory: "conflict_event_dataset",
    enabled: false,
    autoSyncEnabled: false,
    syncFrequencyMinutes: 1440,
    requiresApiKey: true,
    rateLimitNotes: "Free for non-commercial research with registration",
    licenseNotes: "Attribution required; commercial use requires license",
  },
  {
    id: "ucdp",
    name: "UCDP",
    organization: "Uppsala Conflict Data Program",
    url: "https://ucdp.uu.se",
    docsUrl: "https://ucdp.uu.se/apidocs/",
    accessType: "api",
    coverage: "global",
    domains: ["conflict_security"],
    trustLevel: 3,
    confidenceCategory: "conflict_event_dataset",
    enabled: false,
    autoSyncEnabled: false,
    syncFrequencyMinutes: 43200,
  },

  // ── Aviation ──────────────────────────────────────────────────────────────
  {
    id: "icao",
    name: "ICAO",
    organization: "International Civil Aviation Organization",
    url: "https://www.icao.int",
    docsUrl: "https://www.icao.int/api-data-service",
    accessType: "portal",
    coverage: "global",
    domains: ["aviation"],
    trustLevel: 4,
    confidenceCategory: "aviation_advisory",
    enabled: false,
    autoSyncEnabled: false,
  },
  {
    id: "faa",
    name: "FAA",
    organization: "Federal Aviation Administration",
    url: "https://www.faa.gov",
    docsUrl: "https://www.faa.gov/data_research",
    accessType: "portal",
    coverage: "regional",
    countries: ["US"],
    domains: ["aviation"],
    trustLevel: 4,
    confidenceCategory: "aviation_advisory",
    enabled: false,
    autoSyncEnabled: false,
  },
  {
    id: "easa",
    name: "EASA",
    organization: "European Union Aviation Safety Agency",
    url: "https://www.easa.europa.eu",
    accessType: "portal",
    coverage: "regional",
    regions: ["Europe"],
    domains: ["aviation"],
    trustLevel: 4,
    confidenceCategory: "aviation_advisory",
    enabled: false,
    autoSyncEnabled: false,
  },
  {
    id: "iata",
    name: "IATA",
    organization: "International Air Transport Association",
    url: "https://www.iata.org",
    accessType: "portal",
    coverage: "global",
    domains: ["aviation"],
    trustLevel: 4,
    confidenceCategory: "aviation_advisory",
    enabled: false,
    autoSyncEnabled: false,
  },

  // ── Maritime ──────────────────────────────────────────────────────────────
  {
    id: "imo",
    name: "IMO",
    organization: "International Maritime Organization",
    url: "https://www.imo.org",
    accessType: "portal",
    coverage: "global",
    domains: ["maritime"],
    trustLevel: 4,
    confidenceCategory: "maritime_security_alert",
    enabled: false,
    autoSyncEnabled: false,
  },
  {
    id: "ukmto",
    name: "UKMTO",
    organization: "UK Maritime Trade Operations",
    url: "https://www.ukmto.org",
    accessType: "portal",
    coverage: "regional",
    regions: ["Indian Ocean", "Gulf of Aden", "Red Sea"],
    domains: ["maritime"],
    trustLevel: 4,
    confidenceCategory: "maritime_security_alert",
    enabled: false,
    autoSyncEnabled: false,
    syncFrequencyMinutes: 60,
  },
  {
    id: "ics-shipping",
    name: "International Chamber of Shipping",
    organization: "ICS",
    url: "https://www.ics-shipping.org",
    accessType: "portal",
    coverage: "global",
    domains: ["maritime"],
    trustLevel: 4,
    confidenceCategory: "maritime_security_alert",
    enabled: false,
    autoSyncEnabled: false,
  },
  {
    id: "unctad",
    name: "UNCTAD",
    organization: "United Nations Conference on Trade and Development",
    url: "https://unctad.org",
    accessType: "portal",
    coverage: "global",
    domains: ["maritime", "supply_chain"],
    trustLevel: 3,
    confidenceCategory: "economic_indicator",
    enabled: false,
    autoSyncEnabled: false,
  },

  // ── Philippines ───────────────────────────────────────────────────────────
  {
    id: "pagasa",
    name: "PAGASA",
    organization: "Philippine Atmospheric, Geophysical and Astronomical Services Administration",
    url: "https://www.pagasa.dost.gov.ph",
    docsUrl: "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards", "climate"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: false,
    licenseNotes: "Official Philippine government data — manual grounding only (no stable public API)",
  },
  {
    id: "pagasa-climate",
    name: "PAGASA Climate Data",
    organization: "Philippine Atmospheric, Geophysical and Astronomical Services Administration",
    url: "https://www.pagasa.dost.gov.ph/climate/climate-data",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["climate"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "phivolcs",
    name: "PHIVOLCS",
    organization: "Philippine Institute of Volcanology and Seismology",
    url: "https://www.phivolcs.dost.gov.ph",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: false,
    licenseNotes: "Official Philippine government data — manual grounding only",
  },
  {
    id: "ndrrmc",
    name: "NDRRMC",
    organization: "National Disaster Risk Reduction and Management Council",
    url: "https://ndrrmc.gov.ph",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards", "humanitarian"],
    trustLevel: 1,
    confidenceCategory: "official_warning",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "georisk-ph",
    name: "GeoRiskPH",
    organization: "PHIVOLCS / MGB",
    url: "https://www.georisk.gov.ph",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "hazardhunter-ph",
    name: "HazardHunterPH / GeoRisk Map",
    organization: "PHIVOLCS / MGB",
    url: "https://hazardhunter.georisk.gov.ph/map",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "official_observation",
    enabled: true,
    autoSyncEnabled: false,
  },
  {
    id: "project-noah",
    name: "Project NOAH",
    organization: "University of the Philippines",
    url: "https://noah.up.edu.ph",
    accessType: "portal",
    coverage: "country",
    countries: ["PH"],
    domains: ["natural_hazards"],
    trustLevel: 1,
    confidenceCategory: "model_forecast",
    enabled: true,
    autoSyncEnabled: false,
  },
];

/** Return sources applicable for a given country and domain. */
export function getSourcesForContext(
  country?: string,
  domain?: RiskDomain
): RiskSource[] {
  return SOURCE_REGISTRY.filter((s) => {
    if (!s.enabled) return false;
    const domainMatch = !domain || s.domains.includes(domain);
    const coverageMatch =
      s.coverage === "global" ||
      (s.coverage === "country" && !!country && s.countries?.includes(country)) ||
      s.coverage === "regional";
    return domainMatch && coverageMatch;
  });
}

/** Return the highest-trust sources for a context (trust level 1 first). */
export function getPrioritizedSources(
  country?: string,
  domain?: RiskDomain
): RiskSource[] {
  return getSourcesForContext(country, domain).sort(
    (a, b) => a.trustLevel - b.trustLevel
  );
}
