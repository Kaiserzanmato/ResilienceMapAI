"""The deprecated GET /api/location-risk must never show a number POST /api/assessments withholds."""
import asyncio
import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.repositories.fire_repo import get_fire_repo
from app.services import volcano_scoring as vs
from app.services.global_assessment import assess_location
from app.services.risk_scoring import score_location

client = TestClient(app, client=("203.0.113.9", 50000))
MAYON = {"lat": 13.257, "lng": 123.685, "country_code": "PH", "name": "Mayon"}
TOKYO = {"lat": 35.6762, "lng": 139.6503, "country_code": "JP", "name": "Tokyo"}


def legacy(place):
    return client.get("/api/location-risk", params=place)


def assessment(place):
    return client.post("/api/assessments", json=place).json()


def test_route_is_marked_deprecated():
    assert app.openapi()["paths"]["/api/location-risk"]["get"]["deprecated"] is True


@pytest.mark.parametrize("place", [MAYON, TOKYO])
def test_volcanic_is_no_data_on_both_routes_when_scoring_is_off(place):
    assert get_settings().enable_volcanic_scoring is False
    old = legacy(place).json()
    new = assessment(place)["hazards"]["volcano"]
    assert old["hazards"]["volcano"]["score"] is None
    assert old["hazards"]["volcano"]["level"] == "No Data"
    assert new["score"] is None and new["indicative_score"] is None
    assert "Volcanic Activity" not in old["main_drivers"]


def test_volcanic_does_not_feed_the_overall_score():
    scored = score_location(MAYON["lat"], MAYON["lng"], "Mayon", "PH")
    others = [h["score"] for k, h in scored["hazards"].items() if k != "volcano" and h["score"] is not None]
    assert scored["overall"]["score"] == round(0.65 * max(others) + 0.35 * (sum(others) / len(others)))


def test_assessment_never_carries_a_volcanic_indicative_number_in_any_hazard_row():
    for place in (MAYON, TOKYO):
        assert assess_location(place["lat"], place["lng"], place["name"], place["country_code"])["hazards"]["volcano"]["indicative_score"] is None


def test_legacy_wildfire_comes_from_the_same_engine_as_the_assessment():
    for place in (MAYON, TOKYO):
        assert legacy(place).json()["hazards"]["wildfire"]["score"] == assessment(place)["hazards"]["wildfire"]["score"]
    # Tokyo is outside the FIRMS area: no data, not a zone-model 0
    assert legacy(TOKYO).json()["hazards"]["wildfire"]["level"] == "No Data"


def test_legacy_wildfire_shows_a_stored_detection(monkeypatch):
    from datetime import timedelta
    from app.repositories.sync_health_repo import get_sync_health_repo
    from app.services import wildfire_scoring as ws
    monkeypatch.setattr(get_settings(), "nasa_firms_area", "116,4,127,22")
    now = datetime.now(timezone.utc)
    # MAYON itself is within VOLCANO_EXCLUSION_RADIUS_KM (5) of the real Mayon summit (see
    # PH_ACTIVE_VOLCANO_SUMMITS), so the detection must sit clear of that — but still inside
    # RADIUS_KM (10) of MAYON, the query point. This test is about the legacy/assessment
    # routes agreeing, not about the volcano exclusion itself (covered separately in
    # test_wildfire_scoring.py). 0.06 degrees north is about 6.7 km.
    rows = [ws.FireDetection(MAYON["lat"] + 0.06, MAYON["lng"], now - timedelta(hours=h), "N", "h", 30.0, "D") for h in (5, 30, 60)]
    rows.append(ws.FireDetection(14.0, 121.0, now - timedelta(days=15), "N", "h", 5.0, "N"))  # history anchor, far away
    asyncio.run(get_fire_repo().upsert_many(rows))
    # Freshness/history now come from sync health (see load_fire_context), not the rows above.
    health_repo = get_sync_health_repo()
    asyncio.run(health_repo.record_success("nasa-firms", len(rows)))
    health_repo._health["nasa-firms"]["first_successful_sync_at"] = (now - timedelta(days=15)).isoformat()
    old = legacy(MAYON).json()["hazards"]["wildfire"]["score"]
    assert old and old == assessment(MAYON)["hazards"]["wildfire"]["score"]


def test_legacy_volcanic_agrees_with_the_assessment_when_scoring_is_on(tmp_path, monkeypatch):
    path = tmp_path / "v.json"
    path.write_text(json.dumps({
        "source": {"name": "Synthetic test list", "url": "https://example.test/v", "retrieved": "2026-10-02", "licence_note": "test data"},
        "volcanoes": [{"name": "Teston", "latitude": MAYON["lat"], "longitude": MAYON["lng"], "status": "active"}]}), encoding="utf-8")
    settings = get_settings()
    monkeypatch.setattr(settings, "volcano_data_file", str(path))
    monkeypatch.setattr(settings, "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    try:
        expected = assessment(MAYON)["hazards"]["volcano"]["score"]
        assert expected == 90
        assert legacy(MAYON).json()["hazards"]["volcano"]["score"] == 90
    finally:
        vs._load.cache_clear()
