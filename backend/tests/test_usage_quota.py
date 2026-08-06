import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services import usage_quota


def test_insights_allows_up_to_limit_then_blocks():
    for _ in range(get_settings().insights_quota_limit):
        status = usage_quota.consume("insights", "k1")
    assert status.used == get_settings().insights_quota_limit
    assert status.remaining == 0

    with pytest.raises(HTTPException) as exc:
        usage_quota.consume("insights", "k1")
    assert exc.value.status_code == 429
    assert exc.value.detail["bucket"] == "insights"


def test_insights_status_does_not_consume():
    before = usage_quota.get_status("insights", "k2")
    after = usage_quota.get_status("insights", "k2")
    assert before.used == after.used == 0


def test_insights_sliding_window_frees_up_after_expiry(monkeypatch):
    monkeypatch.setattr(get_settings(), "insights_quota_window_seconds", 1)
    for _ in range(get_settings().insights_quota_limit):
        usage_quota.consume("insights", "k3")
    assert usage_quota.get_status("insights", "k3").remaining == 0

    time.sleep(1.1)
    status = usage_quota.get_status("insights", "k3")
    assert status.remaining == get_settings().insights_quota_limit


def test_insights_keys_are_independent():
    for _ in range(get_settings().insights_quota_limit):
        usage_quota.consume("insights", "tenant-a")
    # A different key must not be affected by tenant-a's usage.
    status = usage_quota.get_status("insights", "tenant-b")
    assert status.remaining == get_settings().insights_quota_limit


def test_chat_allows_up_to_limit_then_blocks(monkeypatch):
    monkeypatch.setattr(get_settings(), "chat_quota_limit", 2)
    usage_quota.consume("chat", "k4")
    usage_quota.consume("chat", "k4")
    with pytest.raises(HTTPException) as exc:
        usage_quota.consume("chat", "k4")
    assert exc.value.status_code == 429
    assert exc.value.detail["bucket"] == "chat"


def test_chat_resets_on_new_utc_day(monkeypatch):
    monkeypatch.setattr(get_settings(), "chat_quota_limit", 1)
    usage_quota.consume("chat", "k5")
    assert usage_quota.get_status("chat", "k5").remaining == 0

    # Simulate the calendar day rolling over.
    monkeypatch.setattr(usage_quota, "_today_utc", lambda: "2099-01-01")
    status = usage_quota.get_status("chat", "k5")
    assert status.remaining == 1


def test_generate_insights_endpoint_returns_429_when_exhausted(monkeypatch):
    monkeypatch.setattr(get_settings(), "insights_quota_limit", 1)
    client = TestClient(app)
    params = {"lat": 14.6, "lng": 121.0, "name": "Test City"}

    first = client.post("/api/generate-insights", params=params)
    assert first.status_code == 200

    second = client.post("/api/generate-insights", params=params)
    assert second.status_code == 429
    assert second.json()["detail"]["bucket"] == "insights"
    assert "Retry-After" in second.headers


def test_usage_status_endpoint_reports_without_consuming():
    client = TestClient(app)
    resp = client.get("/api/usage-status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["insights"]["used"] == 0
    assert body["chat"]["used"] == 0
    assert body["insights"]["limit"] == get_settings().insights_quota_limit
    assert body["chat"]["limit"] == get_settings().chat_quota_limit
