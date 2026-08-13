from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.data_sources.event_intelligence import (
    EventIntelligenceService,
    deduplicate_events,
    normalize_eonet,
    normalize_gdacs,
    normalize_reliefweb,
    normalize_usgs,
)
from app.main import app


NOW = datetime(2026, 8, 13, tzinfo=timezone.utc)


def test_usgs_normalization_preserves_authority_and_provenance():
    event = normalize_usgs({
        "id": "us7000test",
        "geometry": {"type": "Point", "coordinates": [125.0, 11.2, 10]},
        "properties": {"title": "M 5.4 - Test", "mag": 5.4, "magType": "mww", "time": 1_786_000_000_000, "updated": 1_786_000_001_000, "url": "https://earthquake.usgs.gov/test"},
    }, NOW)
    assert event.event_id == "usgs-earthquake:us7000test"
    assert event.official is True
    assert event.source_tier == 5
    assert event.latitude == 11.2
    assert event.magnitude == 5.4


def test_supplemental_normalizers_never_become_official():
    gdacs = normalize_gdacs({"id": "gdacs-1", "geometry": {"type": "Point", "coordinates": [120, 10]}, "properties": {"eventtype": "TC", "name": "Cyclone", "url": "https://www.gdacs.org/event"}}, NOW)
    eonet = normalize_eonet({"id": "eonet-1", "title": "Fire", "categories": [{"title": "Wildfires"}], "geometry": [{"date": "2026-08-13T00:00:00Z", "type": "Point", "coordinates": [121, 11]}], "sources": [{"url": "https://example.nasa.gov/event"}]}, NOW)
    reliefweb = normalize_reliefweb({"id": "rw-1", "fields": {"name": "Situation report", "date": {"created": "2026-08-13T00:00:00Z"}, "country": [{"iso3": "PHL"}], "type": [{"name": "Flood"}]}}, NOW)
    assert gdacs.hazard_type == "cyclone"
    assert all(event.official is False and event.source_tier == 4 for event in (gdacs, eonet, reliefweb))
    assert reliefweb.geometry is None


def test_invalid_provider_record_is_rejected_without_crashing():
    service = EventIntelligenceService()
    result = service.ingest("usgs-earthquake", [{"id": "missing-geometry", "properties": {"title": "Broken"}}], NOW)
    assert result["records_accepted"] == 0
    assert result["records_rejected"] == 1


def test_deduplication_preserves_separate_cross_provider_provenance():
    usgs = normalize_usgs({"id": "u1", "geometry": {"type": "Point", "coordinates": [125, 11]}, "properties": {"title": "M 5", "time": int(NOW.timestamp() * 1000), "url": "https://earthquake.usgs.gov/u1"}}, NOW)
    gdacs = normalize_gdacs({"id": "g1", "geometry": {"type": "Point", "coordinates": [125.1, 11.1]}, "properties": {"eventtype": "EQ", "name": "Earthquake", "fromdate": "2026-08-13T00:00:00Z", "url": "https://www.gdacs.org/g1"}}, NOW)
    events = deduplicate_events([usgs, gdacs, usgs])
    assert len(events) == 2
    assert gdacs.event_id in usgs.related_event_ids
    assert usgs.event_id in gdacs.related_event_ids


@pytest.mark.asyncio
async def test_disabled_event_service_never_fetches():
    service = EventIntelligenceService()
    result = await service.refresh()
    assert result["enabled"] is False


def test_events_api_rejects_unbounded_or_invalid_filters():
    client = TestClient(app)
    assert client.get("/api/events?bbox=bad").status_code == 422
    assert client.get("/api/events?limit=201").status_code == 422
    assert client.get("/api/events?start_time=2026-01-01T00:00:00Z&end_time=2026-03-01T00:00:00Z").status_code == 422


def test_events_api_is_safe_when_feature_is_disabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "enable_realtime_events", False)
    response = TestClient(app).get("/api/events")
    assert response.status_code == 200
    assert response.json()["enabled"] is False
