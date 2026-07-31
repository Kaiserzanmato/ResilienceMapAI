"""Foundation-phase sync tests: the WIRED_SOURCE_IDS allowlist, the
CRON_SECRET-gated cron endpoint, and /api/data-status reflecting real sync
health instead of the old hardcoded MVP response.

Connector fetches are mocked so these never make real network calls.
"""
from fastapi.testclient import TestClient

from app.config import get_settings
from app.data_sources.connectors import (gdacs_connector, nasa_eonet_connector,
                                         reliefweb_connector, usgs_earthquake_connector)
from app.data_sources.sync import run_source_sync as sync_module
from app.data_sources.sync.source_sync_health import get_sync_health_report
from app.main import app

import pytest


async def _fake_fetch(*args, **kwargs):
    return [{"id": "evt-1"}, {"id": "evt-2"}]


@pytest.fixture(autouse=True)
def _mock_connectors(monkeypatch):
    monkeypatch.setattr(gdacs_connector, "fetch_gdacs_events", _fake_fetch)
    monkeypatch.setattr(nasa_eonet_connector, "fetch_eonet_events", _fake_fetch)
    monkeypatch.setattr(usgs_earthquake_connector, "fetch_usgs_earthquakes", _fake_fetch)
    monkeypatch.setattr(reliefweb_connector, "fetch_reliefweb_disasters", _fake_fetch)


async def test_wired_batch_syncs_only_wired_sources():
    result = await sync_module.run_all_wired_sources()
    assert set(result["sources_synced"]) == sync_module.WIRED_SOURCE_IDS
    assert all(r["status"] == "success" and r["records_synced"] == 2 for r in result["results"])


async def test_unwired_enabled_source_is_never_included_in_a_batch_sync():
    # noaa-nws-api is enabled + auto_sync_enabled in the registry but has no
    # connector implementation — it must never be dispatched by the batch
    # helper (that was the false-positive "success, 0 records" bug).
    result = await sync_module.run_all_wired_sources()
    assert "noaa-nws-api" not in result["sources_synced"]
    assert "hdx" not in result["sources_synced"]

    health = await get_sync_health_report()
    unwired = next(h for h in health if h["source_id"] == "noaa-nws-api")
    assert unwired["last_sync_status"] != "success"


def test_cron_sync_requires_matching_secret(monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", "test-cron-secret")
    client = TestClient(app)

    assert client.get("/api/cron/sync-sources").status_code == 403
    assert client.get("/api/cron/sync-sources",
                      headers={"authorization": "Bearer wrong"}).status_code == 403

    allowed = client.get("/api/cron/sync-sources",
                         headers={"authorization": "Bearer test-cron-secret"})
    assert allowed.status_code == 200
    assert set(allowed.json()["sources_synced"]) == sync_module.WIRED_SOURCE_IDS


def test_cron_sync_fails_closed_when_no_secret_configured():
    # get_settings() is a process-wide singleton; explicitly clear it so this
    # test doesn't depend on execution order relative to the test above.
    settings = get_settings()
    original = settings.cron_secret
    settings.cron_secret = ""
    try:
        client = TestClient(app)
        resp = client.get("/api/cron/sync-sources", headers={"authorization": "Bearer "})
        assert resp.status_code == 403
    finally:
        settings.cron_secret = original


async def test_data_status_reflects_real_sync_health():
    await sync_module.run_all_wired_sources()
    client = TestClient(app)
    resp = client.get("/api/data-status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_type"] == "synced"
    assert body["last_sync_timestamp"] is not None
    assert body["is_fresh"] is True
