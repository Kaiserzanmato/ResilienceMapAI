"""
Global approved source registry — backend Python mirror of the TypeScript registry.
Used by connectors, sync jobs, and the AI grounding layer.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class RiskSource:
    id: str
    name: str
    organization: str
    url: str
    access_type: str  # api | rss | geojson | csv | kml | shapefile | download | portal | manual
    coverage: str     # global | regional | country
    domains: list[str]
    trust_level: int  # 1–5
    confidence_category: str
    enabled: bool
    auto_sync_enabled: bool
    docs_url: Optional[str] = None
    countries: list[str] = field(default_factory=list)
    regions: list[str] = field(default_factory=list)
    sync_frequency_minutes: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    last_successful_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None  # success | failed | partial | disabled
    next_sync_at: Optional[datetime] = None
    requires_api_key: bool = False
    requires_registration: bool = False
    rate_limit_notes: Optional[str] = None
    license_notes: Optional[str] = None


SOURCE_REGISTRY: list[RiskSource] = [
    # ── Global Disaster & Natural Hazard ──────────────────────────────────
    RiskSource(
        id="gdacs", name="GDACS",
        organization="European Commission / United Nations",
        url="https://www.gdacs.org",
        docs_url="https://www.gdacs.org/gdacsapi/swagger/index.html",
        access_type="api", coverage="global",
        domains=["natural_hazards"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=10,
    ),
    RiskSource(
        id="gdacs-rss", name="GDACS RSS Feeds",
        organization="European Commission / United Nations",
        url="https://www.gdacs.org/feed_reference.aspx",
        access_type="rss", coverage="global",
        domains=["natural_hazards"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=10,
    ),
    RiskSource(
        id="nasa-eonet", name="NASA EONET",
        organization="NASA",
        url="https://eonet.gsfc.nasa.gov",
        docs_url="https://eonet.gsfc.nasa.gov/docs/v3",
        access_type="api", coverage="global",
        domains=["natural_hazards"],
        trust_level=1, confidence_category="satellite_detection",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=10,
    ),
    RiskSource(
        id="nasa-firms", name="NASA FIRMS",
        organization="NASA",
        url="https://firms.modaps.eosdis.nasa.gov",
        docs_url="https://firms.modaps.eosdis.nasa.gov/api",
        access_type="api", coverage="global",
        domains=["natural_hazards"],
        trust_level=1, confidence_category="satellite_detection",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=30,
        requires_api_key=True, rate_limit_notes="Requires free MAP_KEY registration",
    ),
    RiskSource(
        id="usgs-earthquake", name="USGS Earthquake Hazards Program",
        organization="USGS",
        url="https://earthquake.usgs.gov",
        docs_url="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
        access_type="geojson", coverage="global",
        domains=["natural_hazards"],
        trust_level=1, confidence_category="official_observation",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=5,
    ),
    RiskSource(
        id="noaa-nws-api", name="NOAA NWS API",
        organization="NOAA",
        url="https://www.weather.gov/documentation/services-web-api",
        access_type="api", coverage="global",
        domains=["natural_hazards", "climate"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=15,
    ),
    RiskSource(
        id="copernicus-ems", name="Copernicus EMS",
        organization="European Commission",
        url="https://emergency.copernicus.eu",
        access_type="portal", coverage="global",
        domains=["natural_hazards", "humanitarian"],
        trust_level=4, confidence_category="satellite_detection",
        enabled=True, auto_sync_enabled=False,
    ),

    # ── Humanitarian ──────────────────────────────────────────────────────
    RiskSource(
        id="reliefweb", name="ReliefWeb",
        organization="UN OCHA",
        url="https://reliefweb.int",
        docs_url="https://apidoc.reliefweb.int",
        access_type="api", coverage="global",
        domains=["humanitarian", "natural_hazards"],
        trust_level=2, confidence_category="humanitarian_report",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=120,
    ),
    RiskSource(
        id="hdx", name="Humanitarian Data Exchange",
        organization="UN OCHA",
        url="https://data.humdata.org",
        access_type="api", coverage="global",
        domains=["humanitarian"],
        trust_level=2, confidence_category="humanitarian_report",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=360,
    ),
    RiskSource(
        id="ifrc-go", name="IFRC GO Platform",
        organization="International Federation of Red Cross",
        url="https://go.ifrc.org",
        access_type="api", coverage="global",
        domains=["humanitarian"],
        trust_level=2, confidence_category="humanitarian_report",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=180,
    ),
    RiskSource(
        id="unhcr-data", name="UNHCR Operational Data Portal",
        organization="UNHCR",
        url="https://data.unhcr.org",
        docs_url="https://data.unhcr.org/en/api/api-registration",
        access_type="api", coverage="global",
        domains=["humanitarian"],
        trust_level=2, confidence_category="humanitarian_report",
        enabled=True, auto_sync_enabled=False,
        requires_registration=True,
    ),

    # ── Climate & Resilience ──────────────────────────────────────────────
    RiskSource(
        id="worldbank-open", name="World Bank Open Data",
        organization="World Bank",
        url="https://data.worldbank.org",
        docs_url="https://api.worldbank.org",
        access_type="api", coverage="global",
        domains=["climate", "humanitarian"],
        trust_level=3, confidence_category="economic_indicator",
        enabled=True, auto_sync_enabled=True, sync_frequency_minutes=43200,
    ),
    RiskSource(
        id="emdat", name="EM-DAT",
        organization="CRED",
        url="https://www.emdat.be",
        access_type="download", coverage="global",
        domains=["natural_hazards", "humanitarian"],
        trust_level=3, confidence_category="historical_record",
        enabled=True, auto_sync_enabled=False,
        requires_registration=True,
    ),

    # ── Conflict & Security (disabled until connectors validated) ─────────
    RiskSource(
        id="acled", name="ACLED",
        organization="Armed Conflict Location & Event Data Project",
        url="https://acleddata.com",
        docs_url="https://acleddata.com/acled-api-documentation",
        access_type="api", coverage="global",
        domains=["conflict_security"],
        trust_level=3, confidence_category="conflict_event_dataset",
        enabled=False, auto_sync_enabled=False, sync_frequency_minutes=1440,
        requires_api_key=True,
        license_notes="Attribution required; commercial use requires license",
    ),
    RiskSource(
        id="ucdp", name="UCDP",
        organization="Uppsala Conflict Data Program",
        url="https://ucdp.uu.se",
        docs_url="https://ucdp.uu.se/apidocs/",
        access_type="api", coverage="global",
        domains=["conflict_security"],
        trust_level=3, confidence_category="conflict_event_dataset",
        enabled=False, auto_sync_enabled=False, sync_frequency_minutes=43200,
    ),

    # ── Philippines ───────────────────────────────────────────────────────
    RiskSource(
        id="pagasa", name="PAGASA",
        organization="Philippine Atmospheric, Geophysical and Astronomical Services Administration",
        url="https://www.pagasa.dost.gov.ph",
        docs_url="https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
        access_type="portal", coverage="country",
        countries=["PH"],
        domains=["natural_hazards", "climate"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=False,
        license_notes="Official Philippine government data — manual grounding only",
    ),
    RiskSource(
        id="phivolcs", name="PHIVOLCS",
        organization="Philippine Institute of Volcanology and Seismology",
        url="https://www.phivolcs.dost.gov.ph",
        access_type="portal", coverage="country",
        countries=["PH"],
        domains=["natural_hazards"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=False,
        license_notes="Official Philippine government data — manual grounding only",
    ),
    RiskSource(
        id="ndrrmc", name="NDRRMC",
        organization="National Disaster Risk Reduction and Management Council",
        url="https://ndrrmc.gov.ph",
        access_type="portal", coverage="country",
        countries=["PH"],
        domains=["natural_hazards", "humanitarian"],
        trust_level=1, confidence_category="official_warning",
        enabled=True, auto_sync_enabled=False,
    ),
    RiskSource(
        id="georisk-ph", name="GeoRiskPH",
        organization="PHIVOLCS / MGB",
        url="https://www.georisk.gov.ph",
        access_type="portal", coverage="country",
        countries=["PH"],
        domains=["natural_hazards"],
        trust_level=1, confidence_category="official_observation",
        enabled=True, auto_sync_enabled=False,
    ),
]


def get_enabled_sources() -> list[RiskSource]:
    return [s for s in SOURCE_REGISTRY if s.enabled]


def get_sources_for_country(country_code: str) -> list[RiskSource]:
    return [
        s for s in SOURCE_REGISTRY
        if s.enabled and (
            s.coverage == "global" or country_code in s.countries
        )
    ]


def get_sources_for_domain(domain: str) -> list[RiskSource]:
    return [
        s for s in SOURCE_REGISTRY
        if s.enabled and domain in s.domains
    ]


def get_source_by_id(source_id: str) -> Optional[RiskSource]:
    return next((s for s in SOURCE_REGISTRY if s.id == source_id), None)


def get_registry_summary() -> list[dict]:
    return [
        {
            "id": s.id,
            "name": s.name,
            "organization": s.organization,
            "url": s.url,
            "docs_url": s.docs_url,
            "access_type": s.access_type,
            "coverage": s.coverage,
            "countries": s.countries,
            "regions": s.regions,
            "domains": s.domains,
            "trust_level": s.trust_level,
            "confidence_category": s.confidence_category,
            "enabled": s.enabled,
            "auto_sync_enabled": s.auto_sync_enabled,
            "sync_frequency_minutes": s.sync_frequency_minutes,
            "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None,
            "last_successful_sync_at": (
                s.last_successful_sync_at.isoformat()
                if s.last_successful_sync_at else None
            ),
            "last_sync_status": s.last_sync_status,
            "next_sync_at": s.next_sync_at.isoformat() if s.next_sync_at else None,
            "requires_api_key": s.requires_api_key,
            "requires_registration": s.requires_registration,
            "rate_limit_notes": s.rate_limit_notes,
            "license_notes": s.license_notes,
        }
        for s in SOURCE_REGISTRY
    ]
