"""Normalized, feature-gated current-event service.

Provider connectors remain responsible for fetching their documented,
allowlisted endpoints. This module is the validation, provenance, caching and
read-model boundary; it deliberately never feeds deterministic risk scoring.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, HttpUrl, ValidationError, field_validator

from ..config import get_settings

logger = logging.getLogger(__name__)

MAX_TITLE_LENGTH = 280
MAX_DESCRIPTION_LENGTH = 4_000
MAX_RAW_METADATA_BYTES = 16_000
PROVIDER_TIERS = {"usgs-earthquake": 5, "gdacs": 4, "nasa-eonet": 4, "reliefweb": 4}
SUPPLEMENTAL_PROVIDERS = {"nasa-eonet", "reliefweb"}


class EventGeometry(BaseModel):
    type: Literal["Point", "Polygon", "MultiPolygon"]
    coordinates: Any

    @field_validator("coordinates")
    @classmethod
    def valid_coordinates(cls, value: Any) -> Any:
        def point(coords: Any) -> None:
            if not isinstance(coords, list) or len(coords) < 2:
                raise ValueError("Point geometry needs longitude and latitude")
            lon, lat = coords[0], coords[1]
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                raise ValueError("coordinates must be numeric")
            if not -180 <= lon <= 180 or not -90 <= lat <= 90:
                raise ValueError("coordinates are out of range")

        if isinstance(value, list) and len(value) >= 2 and isinstance(value[0], (int, float)):
            point(value)
        elif not isinstance(value, list) or not value:
            raise ValueError("geometry coordinates are required")
        return value


class NormalizedEvent(BaseModel):
    event_id: str = Field(min_length=3, max_length=180)
    provider_event_id: str = Field(min_length=1, max_length=160)
    provider: Literal["usgs-earthquake", "gdacs", "nasa-eonet", "reliefweb"]
    source_tier: int = Field(ge=1, le=5)
    hazard_type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    description: str | None = Field(default=None, max_length=MAX_DESCRIPTION_LENGTH)
    geometry: EventGeometry | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    severity: str | None = Field(default=None, max_length=32)
    magnitude: float | None = None
    magnitude_unit: str | None = Field(default=None, max_length=24)
    event_time: datetime | None = None
    updated_at: datetime | None = None
    retrieved_at: datetime
    countries: list[str] = Field(default_factory=list, max_length=30)
    admin_regions: list[str] = Field(default_factory=list, max_length=50)
    source_url: HttpUrl | None = None
    official: bool
    confidence: str | None = Field(default=None, max_length=40)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)
    related_event_ids: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("event_id")
    @classmethod
    def canonical_id(cls, value: str) -> str:
        if ":" not in value:
            raise ValueError("event_id must include provider namespace")
        return value


def _utc(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _point(geometry: Any) -> tuple[EventGeometry | None, float | None, float | None]:
    if not isinstance(geometry, dict):
        return None, None, None
    try:
        parsed = EventGeometry.model_validate(geometry)
    except ValidationError:
        return None, None, None
    if parsed.type == "Point":
        return parsed, float(parsed.coordinates[1]), float(parsed.coordinates[0])
    return parsed, None, None


def _metadata(value: dict[str, Any], allowed: tuple[str, ...]) -> dict[str, Any]:
    result = {key: value[key] for key in allowed if key in value}
    if len(repr(result).encode()) > MAX_RAW_METADATA_BYTES:
        return {"truncated": True}
    return result


def _hazard(value: Any) -> str:
    text = str(value or "unknown").lower().replace(" ", "_")
    mappings = {
        "eq": "earthquake", "earthquake": "earthquake", "wildfires": "wildfire",
        "wildfire": "wildfire", "volcanoes": "volcanic", "volcano": "volcanic",
        "severestorms": "severe_weather", "severe_storm": "severe_weather",
        "tropicalcyclone": "cyclone", "tc": "cyclone", "flood": "flood", "fl": "flood",
    }
    return mappings.get(text, text[:64])


def normalize_usgs(raw: dict[str, Any], retrieved_at: datetime) -> NormalizedEvent:
    props = raw.get("properties") or {}
    event_id = str(raw.get("id") or "")
    geometry, lat, lon = _point(raw.get("geometry"))
    if not event_id or geometry is None:
        raise ValueError("USGS event requires ID and valid geometry")
    magnitude = props.get("mag")
    severity = props.get("alert") or ("significant" if isinstance(magnitude, (int, float)) and magnitude >= 6 else "observed")
    return NormalizedEvent(
        event_id=f"usgs-earthquake:{event_id}", provider_event_id=event_id, provider="usgs-earthquake",
        source_tier=5, hazard_type="earthquake", title=str(props.get("title") or "USGS earthquake"),
        geometry=geometry, latitude=lat, longitude=lon, severity=str(severity),
        magnitude=float(magnitude) if isinstance(magnitude, (int, float)) else None,
        magnitude_unit=str(props.get("magType")) if props.get("magType") else None,
        event_time=_utc(props.get("time")), updated_at=_utc(props.get("updated")), retrieved_at=retrieved_at,
        source_url=props.get("url"), official=True, confidence="official_observation",
        raw_metadata=_metadata(props, ("place", "status", "tsunami", "felt", "sig", "types")),
    )


def normalize_gdacs(raw: dict[str, Any], retrieved_at: datetime) -> NormalizedEvent:
    props = raw.get("properties") or {}
    provider_id = str(props.get("eventid") or props.get("eventID") or raw.get("id") or "")
    geometry, lat, lon = _point(raw.get("geometry"))
    if not provider_id or geometry is None:
        raise ValueError("GDACS event requires ID and valid geometry")
    event_type = props.get("eventtype") or props.get("eventType") or props.get("type")
    url = props.get("url") or props.get("details") or props.get("eventurl")
    return NormalizedEvent(
        event_id=f"gdacs:{provider_id}", provider_event_id=provider_id, provider="gdacs", source_tier=4,
        hazard_type=_hazard(event_type), title=str(props.get("name") or props.get("title") or "GDACS event"),
        description=str(props.get("description"))[:MAX_DESCRIPTION_LENGTH] if props.get("description") else None,
        geometry=geometry, latitude=lat, longitude=lon, severity=str(props.get("alertlevel") or "unknown"),
        event_time=_utc(props.get("fromdate") or props.get("date")), updated_at=_utc(props.get("todate") or props.get("updated")),
        retrieved_at=retrieved_at, source_url=url, official=False, confidence="intergovernmental_alert",
        raw_metadata=_metadata(props, ("eventtype", "alertlevel", "country", "population", "episodeid")),
    )


def normalize_eonet(raw: dict[str, Any], retrieved_at: datetime) -> NormalizedEvent:
    provider_id = str(raw.get("id") or "")
    geometries = raw.get("geometry") or []
    latest = geometries[-1] if isinstance(geometries, list) and geometries else {}
    geometry, lat, lon = _point(latest)
    if not provider_id or geometry is None:
        raise ValueError("EONET event requires ID and valid geometry")
    categories = raw.get("categories") or []
    category = categories[0].get("title") if categories and isinstance(categories[0], dict) else "unknown"
    sources = raw.get("sources") or []
    source_url = sources[0].get("url") if sources and isinstance(sources[0], dict) else raw.get("link")
    return NormalizedEvent(
        event_id=f"nasa-eonet:{provider_id}", provider_event_id=provider_id, provider="nasa-eonet", source_tier=4,
        hazard_type=_hazard(category), title=str(raw.get("title") or "NASA EONET event"),
        description=str(raw.get("description"))[:MAX_DESCRIPTION_LENGTH] if raw.get("description") else None,
        geometry=geometry, latitude=lat, longitude=lon, severity="supplemental",
        magnitude=float(raw["magnitudeValue"]) if isinstance(raw.get("magnitudeValue"), (int, float)) else None,
        magnitude_unit=raw.get("magnitudeUnit"), event_time=_utc(latest.get("date") if isinstance(latest, dict) else None),
        updated_at=_utc(raw.get("closed")), retrieved_at=retrieved_at, source_url=source_url,
        official=False, confidence="supplemental_curated_metadata",
        raw_metadata=_metadata(raw, ("categories", "closed", "sources")),
    )


def normalize_reliefweb(raw: dict[str, Any], retrieved_at: datetime) -> NormalizedEvent:
    fields = raw.get("fields") or raw
    provider_id = str(raw.get("id") or fields.get("id") or "")
    if not provider_id:
        raise ValueError("ReliefWeb record requires ID")
    countries = [str(item.get("iso3") or item.get("name")) for item in fields.get("country", []) if isinstance(item, dict)]
    types = fields.get("type") or []
    hazard = types[0].get("name") if types and isinstance(types[0], dict) else "humanitarian"
    dates = fields.get("date") or {}
    return NormalizedEvent(
        event_id=f"reliefweb:{provider_id}", provider_event_id=provider_id, provider="reliefweb", source_tier=4,
        hazard_type=_hazard(hazard), title=str(fields.get("name") or "ReliefWeb disaster report"),
        description=str(fields.get("body"))[:MAX_DESCRIPTION_LENGTH] if fields.get("body") else None,
        severity="supplemental", event_time=_utc(dates.get("created") if isinstance(dates, dict) else None),
        updated_at=_utc(dates.get("changed") if isinstance(dates, dict) else None), retrieved_at=retrieved_at,
        countries=countries, source_url=fields.get("url"), official=False, confidence="supplemental_humanitarian_report",
        raw_metadata=_metadata(fields, ("status", "country", "type")),
    )


NORMALIZERS = {"usgs-earthquake": normalize_usgs, "gdacs": normalize_gdacs, "nasa-eonet": normalize_eonet, "reliefweb": normalize_reliefweb}


def _distance_km(a: NormalizedEvent, b: NormalizedEvent) -> float | None:
    if None in (a.latitude, a.longitude, b.latitude, b.longitude):
        return None
    lat1, lon1, lat2, lon2 = map(math.radians, (a.latitude, a.longitude, b.latitude, b.longitude))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2))


def deduplicate_events(events: list[NormalizedEvent]) -> list[NormalizedEvent]:
    """Drop repeated provider records and attach conservative cross-provider links.

    Cross-provider records remain separate so authority and provenance cannot be
    overwritten. A link requires the same taxonomy, <=100km, and <=24h.
    """
    unique = {event.event_id: event for event in events}
    ordered = list(unique.values())
    # Links are derived from the current normalized event set. Events retained
    # from a prior provider refresh may already have links, so rebuild them
    # rather than appending stale or duplicate IDs on every ingestion.
    for event in ordered:
        event.related_event_ids = []
    for index, event in enumerate(ordered):
        for other in ordered[index + 1:]:
            if event.provider == other.provider or event.hazard_type != other.hazard_type:
                continue
            if not event.event_time or not other.event_time or abs((event.event_time - other.event_time).total_seconds()) > 86400:
                continue
            distance = _distance_km(event, other)
            if distance is not None and distance <= 100:
                event.related_event_ids.append(other.event_id)
                other.related_event_ids.append(event.event_id)
    return ordered


class EventIntelligenceService:
    def __init__(self) -> None:
        self._events: list[NormalizedEvent] = []
        self._refreshed_at: datetime | None = None
        self._provider_metrics: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def enabled_providers(self) -> set[str]:
        settings = get_settings()
        if not settings.enable_realtime_events:
            return set()
        flags = {
            "usgs-earthquake": settings.enable_usgs_events,
            "gdacs": settings.enable_gdacs_events,
            "nasa-eonet": settings.enable_eonet_enrichment,
            "reliefweb": settings.enable_reliefweb_enrichment,
        }
        return {provider for provider, enabled in flags.items() if enabled}

    async def refresh(self, providers: set[str] | None = None) -> dict[str, Any]:
        targets = self.enabled_providers() if providers is None else providers & self.enabled_providers()
        if not targets:
            return {"enabled": False, "events": len(self._events), "providers": {}}
        async with self._lock:
            started = datetime.now(timezone.utc)
            results: dict[str, dict[str, Any]] = {}
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
                for provider in sorted(targets):
                    result, _ = await self._refresh_provider(provider, client, started)
                    results[provider] = result
            self._refreshed_at = started
            return {"enabled": True, "events": len(self._events), "providers": results}

    async def _refresh_provider(self, provider: str, client: httpx.AsyncClient, retrieved_at: datetime) -> tuple[dict[str, Any], list[NormalizedEvent]]:
        from .connectors.gdacs_connector import fetch_gdacs_events
        from .connectors.nasa_eonet_connector import fetch_eonet_events
        from .connectors.reliefweb_connector import fetch_reliefweb_disasters
        from .connectors.usgs_earthquake_connector import fetch_usgs_earthquakes

        fetchers = {
            "usgs-earthquake": lambda: fetch_usgs_earthquakes(client, feed="all_hour"),
            "gdacs": lambda: fetch_gdacs_events(client),
            "nasa-eonet": lambda: fetch_eonet_events(client, days=7, limit=100),
            "reliefweb": lambda: fetch_reliefweb_disasters(client, limit=20),
        }
        started = datetime.now(timezone.utc)
        try:
            records = await fetchers[provider]()
            latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
            result = self.ingest(provider, records, retrieved_at, latency_ms=latency_ms)
            return result, [event for event in self._events if event.provider == provider]
        except Exception as exc:  # provider failure is isolated by design
            latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
            result = {"status": "unavailable", "records_fetched": 0, "records_accepted": 0, "records_rejected": 0, "latency_ms": latency_ms, "last_successful_refresh": self._provider_metrics.get(provider, {}).get("last_successful_refresh")}
            self._provider_metrics[provider] = {**self._provider_metrics.get(provider, {}), **result}
            logger.warning("[events] provider=%s unavailable latency_ms=%d error=%s", provider, latency_ms, type(exc).__name__)
            return result, []

    def ingest(self, provider: str, records: list[dict], retrieved_at: datetime | None = None, *, latency_ms: int = 0) -> dict[str, Any]:
        """Normalize records already obtained by the legacy scheduled sync.

        This avoids a second provider request when `run_source_sync` is the
        caller, while keeping normalization in one place.
        """
        retrieved_at = retrieved_at or datetime.now(timezone.utc)
        accepted: list[NormalizedEvent] = []
        rejected = 0
        for record in records[:500]:
            try:
                accepted.append(NORMALIZERS[provider](record, retrieved_at))
            except (ValidationError, ValueError, TypeError):
                rejected += 1
        retained = [event for event in self._events if event.provider != provider]
        self._events = deduplicate_events(retained + accepted)
        self._refreshed_at = retrieved_at
        result = {"status": "healthy", "records_fetched": len(records), "records_accepted": len(accepted), "records_rejected": rejected, "latency_ms": latency_ms, "last_successful_refresh": retrieved_at.isoformat()}
        self._provider_metrics[provider] = result
        logger.info("[events] provider=%s success fetched=%d accepted=%d rejected=%d latency_ms=%d", provider, len(records), len(accepted), rejected, latency_ms)
        return result

    async def ensure_fresh(self) -> None:
        ttl = timedelta(seconds=get_settings().events_cache_ttl_seconds)
        if self.enabled_providers() and (self._refreshed_at is None or datetime.now(timezone.utc) - self._refreshed_at > ttl):
            await self.refresh()

    async def list_events(self, *, hazard_type: str | None = None, provider: str | None = None, authority: str | None = None, severity: str | None = None, start_time: datetime | None = None, end_time: datetime | None = None, bbox: tuple[float, float, float, float] | None = None, offset: int = 0, limit: int = 100) -> dict[str, Any]:
        await self.ensure_fresh()
        events = list(self._events)
        if hazard_type:
            events = [event for event in events if event.hazard_type == hazard_type]
        if provider:
            events = [event for event in events if event.provider == provider]
        if authority == "official":
            events = [event for event in events if event.official]
        elif authority == "supplemental":
            events = [event for event in events if event.provider in SUPPLEMENTAL_PROVIDERS]
        if severity:
            events = [event for event in events if (event.severity or "").lower() == severity.lower()]
        if start_time:
            events = [event for event in events if event.event_time and event.event_time >= start_time]
        if end_time:
            events = [event for event in events if event.event_time and event.event_time <= end_time]
        if bbox:
            west, south, east, north = bbox
            events = [event for event in events if event.latitude is not None and event.longitude is not None and west <= event.longitude <= east and south <= event.latitude <= north]
        events.sort(key=lambda event: event.event_time or event.retrieved_at, reverse=True)
        page = events[offset:offset + limit]
        next_offset = offset + limit if offset + limit < len(events) else None
        return {"enabled": bool(self.enabled_providers()), "events": [event.model_dump(mode="json") for event in page], "pagination": {"limit": limit, "offset": offset, "next_offset": next_offset, "total": len(events)}, "refreshed_at": self._refreshed_at.isoformat() if self._refreshed_at else None, "providers": self._provider_metrics}


_service = EventIntelligenceService()


def get_event_intelligence_service() -> EventIntelligenceService:
    return _service
