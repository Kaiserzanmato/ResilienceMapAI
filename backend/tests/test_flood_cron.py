"""/api/cron/flood-captures mirrors /api/cron/sync-sources (see test_sync.py)."""
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.config import get_settings
from app.flood import worker
from app.flood.stac import SceneRef
from app.main import app
from app.repositories.flood_repo import get_flood_repo

import asyncio

client = TestClient(app, client=("203.0.113.8", 50000))  # own rate-limit bucket
URL = "/api/cron/flood-captures"
SQUARE = {"type": "MultiPolygon", "coordinates": [[[[120.8, 14.9], [120.9, 14.9], [120.9, 14.95], [120.8, 14.95], [120.8, 14.9]]]]}


def test_cron_requires_the_matching_secret(monkeypatch, flood_enabled):
    monkeypatch.setattr(get_settings(), "cron_secret", "test-cron-secret")
    assert client.get(URL).status_code == 403
    assert client.get(URL, headers={"authorization": "Bearer wrong"}).status_code == 403
    assert client.get(URL, headers={"authorization": "test-cron-secret"}).status_code == 403
    assert client.get(URL, headers={"authorization": "Bearer test-cron-secret"}).status_code == 200


def test_cron_fails_closed_when_no_secret_is_configured(monkeypatch, flood_enabled):
    monkeypatch.setattr(get_settings(), "cron_secret", "")
    for header in ({}, {"authorization": "Bearer "}, {"authorization": "Bearer"}, {"authorization": "Bearer None"},
                   {"authorization": "Bearer null"}, {"authorization": "Bearer undefined"}):
        assert client.get(URL, headers=header).status_code == 403, header


def test_cron_is_a_no_op_while_the_feature_is_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", "test-cron-secret")
    monkeypatch.setattr(get_settings(), "enable_flood_capture", False)
    res = client.get(URL, headers={"authorization": "Bearer test-cron-secret"})
    assert res.status_code == 200 and res.json() == {"enabled": False}


def test_cron_drains_unfinished_jobs(monkeypatch, flood_enabled):
    monkeypatch.setattr(get_settings(), "cron_secret", "test-cron-secret")
    scene = SceneRef("s1-rtc-pc", "S1A_CRON", datetime(2026, 9, 29, tzinfo=timezone.utc), {"vv": "x"})
    monkeypatch.setattr(worker, "_find_scenes", lambda lat, lng, days: [scene])
    monkeypatch.setattr(worker, "_capture", lambda sc, aoi: SimpleNamespace(
        geometry=SQUARE, water_area_m2=1.0, polygon_count=1, method={}))
    repo = get_flood_repo()

    async def seed():
        flag = await repo.create_flag(14.93, 120.85, None, None, "h")
        return await repo.create_job(flag["id"])

    job = asyncio.run(seed())
    res = client.get(URL, headers={"authorization": "Bearer test-cron-secret"})
    assert res.status_code == 200
    assert res.json() == {"enabled": True, "processed": 1, "by_status": {"done": 1}, "expired_failed": 0}
    assert repo.jobs[job["id"]]["status"] == "done"
