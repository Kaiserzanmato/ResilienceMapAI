"""Flood API: flags, jobs, extents, tiles. In-memory repo, no network."""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.flood import worker
from app.flood.stac import SceneRef
from app.main import app
from app.repositories.flood_repo import MAX_FEATURES, get_flood_repo

# Own client address: the global per-IP rate limiter shares one bucket for every
# "testclient" request, and this file sends enough to starve later test files.
client = TestClient(app, client=("203.0.113.7", 50000))
POINT = {"lat": 14.93, "lng": 120.85}
SQUARE = {"type": "MultiPolygon", "coordinates": [[[[120.8, 14.9], [120.9, 14.9], [120.9, 14.95], [120.8, 14.95], [120.8, 14.9]]]]}


def run(coro):
    return asyncio.run(coro)


def _extent(scene_id="S1A_X", tile_key="k", geom=SQUARE, days_ago=1, area=250_000.0):
    return run(get_flood_repo().save_extent(
        source="s1-rtc-pc", scene_id=scene_id, acquired_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        tile_key=tile_key, aoi={"type": "Polygon", "coordinates": []}, geom=geom, water_area_m2=area,
        method={"algorithm": "sar-otsu-vv"}))


def test_every_flood_route_404s_while_the_feature_is_off():
    assert client.post("/api/flood/flags", json=POINT).status_code == 404
    assert client.get("/api/flood/extents").status_code == 404
    assert client.get("/api/flood/jobs/1").status_code == 404
    assert client.get("/api/flood/tiles/9/1/1.mvt").status_code == 404


def test_a_flag_returns_202_and_queues_a_job(flood_enabled):
    res = client.post("/api/flood/flags", json={**POINT, "note": "  knee-deep on the highway  "})
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "queued" and body["flag_id"] == 1 and body["job_id"] == 1
    repo = get_flood_repo()
    flag = run(repo.get_flag(body["flag_id"]))
    assert flag["note"] == "knee-deep on the highway"
    job = client.get(f"/api/flood/jobs/{body['job_id']}").json()
    assert job["status"] == "queued" and job["attempts"] == 0 and job["extent"] is None


def test_only_a_hash_of_the_client_ip_is_stored(flood_enabled):
    client.post("/api/flood/flags", json=POINT)
    flag = get_flood_repo().flags[1]
    assert len(flag["client_hash"]) == 64 and int(flag["client_hash"], 16) >= 0
    assert "203.0.113.7" not in str(flag)


@pytest.mark.parametrize("payload", [
    {"lat": 91, "lng": 10}, {"lat": -91, "lng": 10}, {"lat": 10, "lng": 181}, {"lng": 10}, {"lat": 10},
    {**POINT, "note": "x" * 281},
    {**POINT, "observed_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()},
    {**POINT, "observed_at": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()},
])
def test_invalid_flags_are_rejected_with_422(flood_enabled, payload):
    assert client.post("/api/flood/flags", json=payload).status_code == 422
    assert get_flood_repo().flags == {}


def test_fourth_flag_in_an_hour_is_429_with_retry_after(flood_enabled):
    for _ in range(3):
        assert client.post("/api/flood/flags", json=POINT).status_code == 202
    blocked = client.post("/api/flood/flags", json=POINT)
    assert blocked.status_code == 429 and blocked.headers["retry-after"] == "3600"
    assert len(get_flood_repo().flags) == 3 and len(get_flood_repo().jobs) == 3


def test_the_limit_is_per_client_not_global(flood_enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "flood_client_ip_header", "x-forwarded-for")
    for _ in range(3):
        assert client.post("/api/flood/flags", json=POINT, headers={"x-forwarded-for": "198.51.100.1"}).status_code == 202
    assert client.post("/api/flood/flags", json=POINT, headers={"x-forwarded-for": "198.51.100.1"}).status_code == 429
    assert client.post("/api/flood/flags", json=POINT, headers={"x-forwarded-for": "198.51.100.2"}).status_code == 202


def test_unknown_job_is_404(flood_enabled):
    assert client.get("/api/flood/jobs/999").status_code == 404


# ------------------------------------------------------------- extents

def test_extents_are_a_feature_collection_with_attribution_and_an_etag(flood_enabled):
    _extent()
    res = client.get("/api/flood/extents")
    body = res.json()
    assert res.status_code == 200 and body["type"] == "FeatureCollection" and len(body["features"]) == 1
    assert "Copernicus Sentinel" in body["attribution"] and body["truncated"] is False
    props = body["features"][0]["properties"]
    assert props["source"] == "s1-rtc-pc" and props["water_area_m2"] == 250_000.0 and props["source_tier"] == 3
    assert client.get("/api/flood/extents", headers={"if-none-match": res.headers["etag"]}).status_code == 304
    _extent(scene_id="S1A_NEW", tile_key="k2")  # new data changes the version, so the old ETag misses
    assert client.get("/api/flood/extents", headers={"if-none-match": res.headers["etag"]}).status_code == 200


def test_extents_are_capped_at_500_features_and_flag_truncation(flood_enabled):
    for i in range(MAX_FEATURES + 1):
        _extent(scene_id=f"S{i}", tile_key=f"k{i}", days_ago=0)
    body = client.get("/api/flood/extents").json()
    assert len(body["features"]) == MAX_FEATURES and body["truncated"] is True


def test_extents_filter_by_bbox_and_since(flood_enabled):
    _extent(scene_id="inside", tile_key="a", days_ago=1)
    _extent(scene_id="old", tile_key="b", days_ago=20)
    far = {"type": "MultiPolygon", "coordinates": [[[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]]}
    _extent(scene_id="far", tile_key="c", geom=far)
    ids = lambda r: sorted(f["properties"]["scene_id"] for f in r.json()["features"])
    assert ids(client.get("/api/flood/extents?bbox=120,14,122,16")) == ["inside", "old"]
    since = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    assert ids(client.get("/api/flood/extents", params={"bbox": "120,14,122,16", "since": since})) == ["inside"]


@pytest.mark.parametrize("bbox", ["abc", "1,2,3", "10,10,5,20", "10,20,20,10", "-200,0,10,10", "0,0,40,10", "0,0,10,40"])
def test_bad_or_oversized_bbox_is_422(flood_enabled, bbox):
    assert client.get("/api/flood/extents", params={"bbox": bbox}).status_code == 422
    assert client.get("/api/flood/flags", params={"bbox": bbox}).status_code == 422


def test_flags_listing_hides_notes_hashes_and_rejected_flags(flood_enabled):
    client.post("/api/flood/flags", json={**POINT, "note": "secret note"})
    client.post("/api/flood/flags", json={"lat": 10.0, "lng": 100.0})
    get_flood_repo().flags[2]["review_status"] = "rejected"
    body = client.get("/api/flood/flags").json()
    assert len(body["features"]) == 1
    assert "secret note" not in client.get("/api/flood/flags").text and "client_hash" not in client.get("/api/flood/flags").text
    assert body["features"][0]["geometry"]["coordinates"] == [120.85, 14.93]


def test_tiles_are_empty_below_zoom_8_and_404_out_of_range(flood_enabled):
    assert client.get("/api/flood/tiles/5/1/1.mvt").status_code == 204
    assert client.get("/api/flood/tiles/9/9999/1.mvt").status_code == 404
    assert client.get("/api/flood/tiles/9/100/100.mvt").status_code == 204  # in-memory repo has no tiles


# ------------------------------------------------ inline run after the 202

def test_an_inline_run_captures_the_flag_after_the_response(flood_enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "flood_inline_processing", True)
    scene = SceneRef("s1-rtc-pc", "S1A_INLINE", datetime(2026, 9, 29, tzinfo=timezone.utc), {"vv": "x"})
    monkeypatch.setattr(worker, "_find_scenes", lambda lat, lng, days: [scene])
    monkeypatch.setattr(worker, "_capture", lambda sc, aoi: SimpleNamespace(
        geometry=SQUARE, water_area_m2=123_400.0, polygon_count=1, method={"algorithm": "stub"}))
    job_id = client.post("/api/flood/flags", json=POINT).json()["job_id"]
    job = client.get(f"/api/flood/jobs/{job_id}").json()
    assert job["status"] == "done" and job["extent"]["scene_id"] == "S1A_INLINE"
    assert job["extent"]["water_area_m2"] == 123_400.0
    assert len(client.get("/api/flood/extents").json()["features"]) == 1
