"""Resilience Map AI — Approved Disaster Source Registry.

This module defines all official and trusted sources for disaster intelligence,
hazard monitoring, weather/climate risk, and resilience planning. All Ask AI
queries must reference only approved sources.

Source tiers:
  - official-national: PAGASA, PHIVOLCS, NDRRMC, MGB, NAMRIA
  - official-international: GDACS, WMO
  - official-space-agency: NASA, Copernicus EMS, JAXA
  - official-un: ReliefWeb, UNDRR
  - trusted-development: World Bank, GFDRR
  - trusted-academic: EM-DAT
"""
from typing import Optional, List

# Priority order for Philippines hazards
PHILIPPINES_SOURCE_PRIORITY = [
    "SRC-002",  # PAGASA Weather Forecast
    "SRC-003",  # PAGASA Severe Weather Bulletin
    "SRC-008",  # PHIVOLCS Latest Earthquake Information
    "SRC-009",  # PHIVOLCS Volcano Bulletins
    "SRC-010",  # PHIVOLCS Tsunami Information
    "SRC-012",  # HazardHunterPH
    "SRC-018",  # NDRRMC Official Portal
    "SRC-019",  # Office of Civil Defense
    "SRC-015",  # MGB Geohazard Maps
]

DISASTER_SOURCES = {
    "SRC-001": {
        "source_name": "PAGASA Main Portal",
        "agency": "DOST-PAGASA",
        "scope": "Philippines",
        "hazards": ["weather", "rainfall", "tropical cyclone", "thunderstorm", "flood warning", "heat index", "climate"],
        "type": "webpage/map",
        "url": "https://www.pagasa.dost.gov.ph/",
        "tier": "official-national",
        "method": "Use specific PAGASA pages first; scrape main portal only as fallback.",
        "grounding": "Primary official Philippine weather and hydrometeorological source.",
    },
    "SRC-002": {
        "source_name": "PAGASA Weather Forecast",
        "agency": "DOST-PAGASA",
        "scope": "Philippines",
        "hazards": ["weather", "rainfall", "monsoon", "thunderstorm", "flash flood", "landslide risk"],
        "type": "webpage",
        "url": "https://www.pagasa.dost.gov.ph/weather",
        "tier": "official-national",
        "method": "HTML parsing with timestamp extraction, caching, and attribution.",
        "grounding": "Grounded source for Philippine weather forecasts and rainfall-related risk language.",
    },
    "SRC-003": {
        "source_name": "PAGASA Severe Weather Bulletin",
        "agency": "DOST-PAGASA",
        "scope": "Philippines / PAR",
        "hazards": ["tropical cyclone", "storm signal", "rainfall warning", "wind signal"],
        "type": "webpage",
        "url": "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
        "tier": "official-national",
        "method": "Parse bulletin number, issued timestamp, cyclone name, TCWS areas, rainfall/wind hazards.",
        "grounding": "Primary official source for Philippine tropical cyclone warnings.",
    },
    "SRC-008": {
        "source_name": "PHIVOLCS Latest Earthquake Information",
        "agency": "DOST-PHIVOLCS",
        "scope": "Philippines",
        "hazards": ["earthquake", "seismic activity"],
        "type": "webpage/table",
        "url": "https://earthquake.phivolcs.dost.gov.ph/",
        "tier": "official-national",
        "method": "Parse table; normalize timestamps to Asia/Manila and UTC; cite PHIVOLCS.",
        "grounding": "Primary official source for Philippine earthquake events.",
    },
    "SRC-009": {
        "source_name": "PHIVOLCS Volcano Bulletins",
        "agency": "DOST-PHIVOLCS",
        "scope": "Philippines",
        "hazards": ["volcano", "eruption", "ashfall", "lahar", "alert level"],
        "type": "webpage",
        "url": "https://www.phivolcs.dost.gov.ph/index.php/volcano-hazard/volcano-bulletin-menu",
        "tier": "official-national",
        "method": "Parse bulletin date, volcano name, alert level, observations, and advisory text.",
        "grounding": "Primary official source for Philippine volcano status and alert levels.",
    },
    "SRC-010": {
        "source_name": "PHIVOLCS Tsunami Information",
        "agency": "DOST-PHIVOLCS",
        "scope": "Philippines",
        "hazards": ["tsunami", "tsunami advisory", "tsunami warning"],
        "type": "webpage",
        "url": "https://tsunami.phivolcs.dost.gov.ph/",
        "tier": "official-national",
        "method": "Use as primary Philippine tsunami source; pair with NOAA/PTWC as secondary regional reference.",
        "grounding": "Primary official Philippine tsunami advisory/warning source.",
    },
    "SRC-012": {
        "source_name": "HazardHunterPH",
        "agency": "GeoRisk Philippines / DOST-PHIVOLCS and partners",
        "scope": "Philippines",
        "hazards": ["multi-hazard", "earthquake", "volcano", "flood", "storm surge", "landslide"],
        "type": "web app/map/report generator",
        "url": "https://hazardhunter.georisk.gov.ph/",
        "tier": "official-national",
        "method": "Use for location-based hazard assessment; avoid aggressive scraping; check public APIs/endpoints.",
        "grounding": "Grounded source for official location-based hazard assessment.",
    },
    "SRC-015": {
        "source_name": "MGB Geohazard Maps",
        "agency": "DENR-MGB",
        "scope": "Philippines",
        "hazards": ["landslide", "flood susceptibility", "geohazard"],
        "type": "web map/download portal",
        "url": "https://databaseportal.mgb.gov.ph/",
        "tier": "official-national",
        "method": "Use official map downloads or public services where available; not a live alert source.",
        "grounding": "Grounded source for Philippine landslide and flood susceptibility.",
    },
    "SRC-018": {
        "source_name": "NDRRMC Official Portal",
        "agency": "NDRRMC / Office of Civil Defense",
        "scope": "Philippines",
        "hazards": ["disaster response", "situation reports", "damage reports", "government response"],
        "type": "webpage/report portal",
        "url": "https://ndrrmc.gov.ph/",
        "tier": "official-national",
        "method": "Use for official situation reports and response updates; parse PDFs/pages with attribution.",
        "grounding": "Grounded source for official national disaster response and situation reports.",
    },
    "SRC-019": {
        "source_name": "Office of Civil Defense",
        "agency": "OCD Philippines",
        "scope": "Philippines",
        "hazards": ["civil defense", "disaster response", "preparedness", "NDRRMC operations"],
        "type": "webpage",
        "url": "https://ocd.gov.ph/",
        "tier": "official-national",
        "method": "Use for civil defense advisories, preparedness, and coordination updates.",
        "grounding": "Grounded source for disaster management operations context.",
    },
    "SRC-020": {
        "source_name": "GDACS Main Portal",
        "agency": "Global Disaster Alert and Coordination System",
        "scope": "Global",
        "hazards": ["earthquake", "tsunami", "tropical cyclone", "flood", "volcano", "drought", "wildfire"],
        "type": "portal/feed/api",
        "url": "https://www.gdacs.org/",
        "tier": "official-international",
        "method": "Prefer GDACS API, RSS/XML, GeoJSON, or KML feeds over scraping.",
        "grounding": "Grounded global multi-hazard alert source.",
    },
    "SRC-021": {
        "source_name": "GDACS API Swagger",
        "agency": "GDACS",
        "scope": "Global",
        "hazards": ["multi-hazard disaster alerts"],
        "type": "api",
        "url": "https://www.gdacs.org/gdacsapi/swagger/index.html",
        "tier": "official-international",
        "method": "Use API for event list, alert level, geometry, and event metadata.",
        "grounding": "Grounded API source for global disaster alerts.",
    },
    "SRC-034": {
        "source_name": "NASA FIRMS Main Portal",
        "agency": "NASA LANCE / EOSDIS",
        "scope": "Global",
        "hazards": ["active fire", "wildfire", "thermal anomaly"],
        "type": "portal/api/map",
        "url": "https://firms.modaps.eosdis.nasa.gov/",
        "tier": "official-space-agency",
        "method": "Use official FIRMS API/web services for active fire data instead of scraping.",
        "grounding": "Grounded active fire and hotspot source.",
    },
    "SRC-035": {
        "source_name": "NASA FIRMS API",
        "agency": "NASA LANCE / EOSDIS",
        "scope": "Global",
        "hazards": ["active fire", "wildfire", "thermal anomaly"],
        "type": "api",
        "url": "https://firms.modaps.eosdis.nasa.gov/api/",
        "tier": "official-space-agency",
        "method": "Use API with MAP_KEY for CSV/GeoJSON/KML fire detections.",
        "grounding": "Grounded API source for active fire detections.",
    },
    "SRC-038": {
        "source_name": "NASA EONET API Documentation",
        "agency": "NASA Earth Observatory / GSFC",
        "scope": "Global",
        "hazards": ["natural events", "wildfire", "storm", "volcano", "dust", "iceberg", "flood"],
        "type": "api",
        "url": "https://eonet.gsfc.nasa.gov/docs/v3",
        "tier": "official-space-agency",
        "method": "Use API for natural event metadata, categories, geometry, status, and source links.",
        "grounding": "Grounded natural event API source.",
    },
    "SRC-046": {
        "source_name": "Copernicus GloFAS",
        "agency": "Copernicus EMS",
        "scope": "Global",
        "hazards": ["flood", "river flood forecast", "global flood awareness"],
        "type": "web app/data service",
        "url": "https://global-flood.emergency.copernicus.eu/",
        "tier": "official-space-agency",
        "method": "Use official GloFAS data access options and forecast products.",
        "grounding": "Grounded global flood forecast source.",
    },
    "SRC-053": {
        "source_name": "USGS Earthquake Hazards Program",
        "agency": "USGS",
        "scope": "Global",
        "hazards": ["earthquake", "seismic hazard"],
        "type": "portal/api/feed",
        "url": "https://earthquake.usgs.gov/",
        "tier": "official-national-global",
        "method": "Use USGS GeoJSON feeds or FDSN Event API.",
        "grounding": "Grounded global earthquake source.",
    },
    "SRC-054": {
        "source_name": "USGS Earthquake GeoJSON Feeds",
        "agency": "USGS",
        "scope": "Global",
        "hazards": ["earthquake", "real-time seismic events"],
        "type": "GeoJSON feed",
        "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
        "tier": "official-national-global",
        "method": "Use all_day.geojson, significant_day.geojson, 2.5_day.geojson, etc. based on needs.",
        "grounding": "Grounded real-time global earthquake feed source.",
    },
    "SRC-056": {
        "source_name": "NOAA Tsunami.gov",
        "agency": "NOAA / National Weather Service",
        "scope": "Pacific, Caribbean, US, global references",
        "hazards": ["tsunami", "tsunami advisory", "tsunami warning"],
        "type": "portal/feed",
        "url": "https://www.tsunami.gov/",
        "tier": "official-national-global",
        "method": "Use Atom feeds for product updates; PHIVOLCS remains primary for Philippines.",
        "grounding": "Grounded source for NOAA tsunami warning center products.",
    },
    "SRC-061": {
        "source_name": "NOAA National Hurricane Center",
        "agency": "NOAA NHC",
        "scope": "Atlantic / Eastern Pacific / Central Pacific",
        "hazards": ["hurricane", "tropical cyclone", "storm surge", "marine warning"],
        "type": "portal/feed/gis",
        "url": "https://www.nhc.noaa.gov/",
        "tier": "official-national-global",
        "method": "Use RSS and GIS products for active storms.",
        "grounding": "Grounded source for NHC tropical cyclone products.",
    },
    "SRC-024": {
        "source_name": "ReliefWeb",
        "agency": "UN OCHA",
        "scope": "Global",
        "hazards": ["humanitarian crisis", "disaster reports", "situation reports", "maps", "response"],
        "type": "portal/api",
        "url": "https://reliefweb.int/",
        "tier": "official-humanitarian",
        "method": "Prefer ReliefWeb API for reports, disasters, countries, and updates.",
        "grounding": "Grounded humanitarian reporting source.",
    },
}


def get_source(source_id: str) -> Optional[dict]:
    """Get a source by ID."""
    return DISASTER_SOURCES.get(source_id)


def list_sources(filter_scope: Optional[str] = None) -> List[dict]:
    """List all approved sources, optionally filtered by scope (e.g., 'Philippines')."""
    sources = list(DISASTER_SOURCES.values())
    if filter_scope:
        sources = [s for s in sources if filter_scope.lower() in s["scope"].lower()]
    return sources


def get_sources_for_hazard(hazard_type: str, is_philippines: bool = False) -> List[dict]:
    """Get approved sources for a specific hazard type.

    Hazard types may use underscores (e.g. 'tropical_cyclone') or spaces
    (e.g. 'tropical cyclone'). This function normalizes and matches both.
    """
    # Normalize input: convert underscores to spaces for matching
    normalized_hazard = hazard_type.lower().replace("_", " ")

    sources = []
    for s in DISASTER_SOURCES.values():
        # Check if the normalized hazard matches any of the source's hazards
        source_hazards = [h.lower() for h in s["hazards"]]
        if any(normalized_hazard in h or h in normalized_hazard for h in source_hazards):
            sources.append(s)

    if is_philippines:
        # Sort by priority: sources in PHILIPPINES_SOURCE_PRIORITY first
        ph_sources = [s for s in sources if s in [DISASTER_SOURCES.get(sid) for sid in PHILIPPINES_SOURCE_PRIORITY]]
        other_sources = [s for s in sources if s not in ph_sources]
        sources = ph_sources + other_sources
    return sources
