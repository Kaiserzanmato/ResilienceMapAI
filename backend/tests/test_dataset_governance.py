"""Dataset governance: canonical trust tiers, tier-5 uploads with review, due-only
sync, sanitized failure reasons, durable-state requirement, and cache validators.

Connector fetches are mocked; nothing here touches the network or a database.
"""
from datetime import datetime, timedelta, timezone

import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings, require_durable_state
from app.data_sources.connectors import (gdacs_connector, nasa_eonet_connector,
                                         nasa_firms_connector, reliefweb_connector,
                                         usgs_earthquake_connector)
from app.data_sources.registry.sources_registry import (SOURCE_REGISTRY, TRUST_TIER_LABELS,
                                                        TrustTier)
from app.data_sources.sync import run_source_sync as sync_module
from app.data_sources.sync.reason_codes import REASON_LABELS, classify_error, safe_reason
from app.data_sources.sync.source_sync_health import get_sync_health_report
from app.data_sources.sync.sync_audit_log import get_audit_log
from app.main import app
from app.redaction import REDACTED, redact_secrets
from app.repositories import dataset_repo
from app.repositories.audit_log_repo import get_audit_log_repo
from app.repositories.hazard_event_repo import get_hazard_event_repo, severity_level
from app.repositories.sync_health_repo import get_sync_health_repo

# Captured at import, before the autouse fixture replaces it with a stub.
_REAL_FETCH_FIRMS = nasa_firms_connector.fetch_firms_fire_data
_REAL_ASYNC_CLIENT = httpx.AsyncClient

ADMIN_SECRET = "test-admin-secret"
ADMIN_HEADERS = {"x-role": "dataset_admin", "authorization": f"Bearer {ADMIN_SECRET}"}
GOOD_UPLOAD = {"name": "Local flood survey", "agency": "LGU Test", "category": "flood",
               "url": "https://example.org/survey.csv", "records": 12, "license": "CC BY 4.0"}


async def _fake_fetch(*args, **kwargs):
    return [{"id": "evt-1"}]


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    for module, name in ((gdacs_connector, "fetch_gdacs_events"), (nasa_eonet_connector, "fetch_eonet_events"),
                         (usgs_earthquake_connector, "fetch_usgs_earthquakes"),
                         (reliefweb_connector, "fetch_reliefweb_disasters"),
                         (nasa_firms_connector, "fetch_firms_fire_data")):
        monkeypatch.setattr(module, name, _fake_fetch)
    settings = get_settings()
    monkeypatch.setattr(settings, "nasa_firms_map_key", "test-map-key")
    monkeypatch.setattr(settings, "admin_shared_secret", ADMIN_SECRET)
    for repo, attr in ((get_sync_health_repo(), "_health"), (get_audit_log_repo(), "_log"),
                       (get_hazard_event_repo(), "rows")):
        getattr(repo, attr).clear()
    monkeypatch.setattr(dataset_repo, "get_dataset_repo", lambda: repo_instance)
    repo_instance._datasets.clear()
    yield


repo_instance = dataset_repo.InMemoryDatasetRepo()


@pytest.fixture
def client(monkeypatch):
    # main.py imported get_dataset_repo by name, so patch it there too.
    import app.main as main_module
    monkeypatch.setattr(main_module, "get_dataset_repo", lambda: repo_instance)
    return TestClient(app)


# ---------------------------------------------------------------- tiers
def test_every_registry_source_uses_a_canonical_tier():
    assert {s.trust_level for s in SOURCE_REGISTRY} <= set(TrustTier)
    assert set(TRUST_TIER_LABELS) == set(TrustTier)


def test_tier_five_is_reserved_for_user_uploads():
    assert all(s.trust_level != TrustTier.USER_UPLOAD for s in SOURCE_REGISTRY)


def test_official_agencies_are_tier_one():
    tiers = {s.id: s.trust_level for s in SOURCE_REGISTRY}
    assert all(tiers[i] == TrustTier.OFFICIAL for i in ("pagasa", "phivolcs", "usgs-earthquake", "noaa-nws-api", "gdacs"))
    assert tiers["copernicus-ems"] == TrustTier.REGIONAL


def test_source_registry_endpoint_reports_integer_tier_and_label(client):
    sources = client.get("/api/source-registry").json()["sources"]
    usgs = next(s for s in sources if s["id"] == "usgs-earthquake")
    assert usgs["trust_level"] == 1 and usgs["trust_label"] == "Official agency"


# ---------------------------------------------------------------- uploads
def test_upload_defaults_to_tier_five_pending(client):
    resp = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    dataset = resp.json()["dataset"]
    assert dataset["trust_level"] == 5
    assert dataset["review_status"] == "pending"
    assert dataset["status"] == "pending_review"
    assert dataset["license"] == "CC BY 4.0"
    assert len(dataset["checksum"]) == 64
    assert dataset["created_by"] == "dataset_admin"


def test_upload_requires_manage_datasets(client):
    assert client.post("/api/datasets/upload", json=GOOD_UPLOAD).status_code == 403


def test_review_approves_and_only_approved_are_returned_for_consumers(client):
    dataset_id = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    import asyncio
    assert asyncio.run(repo_instance.list(approved_only=True)) == []

    resp = client.post(f"/api/datasets/{dataset_id}/review", json={"decision": "approved"}, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    approved = resp.json()["dataset"]
    assert approved["review_status"] == "approved" and approved["status"] == "active"
    assert approved["last_verified_at"] is not None
    assert [d["id"] for d in asyncio.run(repo_instance.list(approved_only=True))] == [dataset_id]


def test_review_rejects_and_validates_input(client):
    dataset_id = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    rejected = client.post(f"/api/datasets/{dataset_id}/review", json={"decision": "rejected"}, headers=ADMIN_HEADERS)
    assert rejected.json()["dataset"]["review_status"] == "rejected"
    assert client.post(f"/api/datasets/{dataset_id}/review", json={"decision": "maybe"}, headers=ADMIN_HEADERS).status_code == 422
    assert client.post("/api/datasets/nope/review", json={"decision": "approved"}, headers=ADMIN_HEADERS).status_code == 404
    assert client.post(f"/api/datasets/{dataset_id}/review", json={"decision": "approved"}).status_code == 403


# ---------------------------------------------------------------- sync cadence
async def test_second_sync_skips_sources_that_are_not_due():
    first = await sync_module.run_all_wired_sources()
    assert set(first["sources_synced"]) == sync_module.WIRED_SOURCE_IDS

    second = await sync_module.run_all_wired_sources()
    assert second["sources_synced"] == []
    assert set(second["sources_skipped"]) == sync_module.WIRED_SOURCE_IDS
    assert all(r["reason"] == "not_due" for r in second["results"])


async def test_force_syncs_everything_regardless_of_due():
    await sync_module.run_all_wired_sources()
    forced = await sync_module.run_all_wired_sources(force=True)
    assert set(forced["sources_synced"]) == sync_module.WIRED_SOURCE_IDS


async def test_only_sources_past_their_own_frequency_are_synced():
    await sync_module.run_all_wired_sources()
    twenty_minutes_ago = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
    for entry in get_sync_health_repo()._health.values():
        entry["last_successful_sync_at"] = twenty_minutes_ago
    result = await sync_module.run_all_wired_sources()
    # usgs (5m), gdacs (10m) and eonet (10m) are due; firms (30m) and reliefweb (120m) are not.
    assert set(result["sources_synced"]) == {"usgs-earthquake", "gdacs", "nasa-eonet"}


async def test_firms_without_a_key_is_skipped_not_recorded_as_success(monkeypatch):
    monkeypatch.setattr(get_settings(), "nasa_firms_map_key", "")
    result = await sync_module.run_all_wired_sources()
    firms = next(r for r in result["results"] if r["source_id"] == "nasa-firms")
    assert firms == {"source_id": "nasa-firms", "status": "skipped", "reason": "not_configured"}
    health = {h["source_id"]: h for h in await get_sync_health_report()}
    assert health["nasa-firms"]["last_sync_status"] == "never"


def test_sources_without_connectors_no_longer_claim_auto_sync():
    by_id = {s.id: s for s in SOURCE_REGISTRY}
    for source_id in ("noaa-nws-api", "gdacs-rss", "hdx", "ifrc-go", "worldbank-open"):
        assert by_id[source_id].auto_sync_enabled is False
    assert all(by_id[i].auto_sync_enabled for i in sync_module.WIRED_SOURCE_IDS)


async def test_synced_events_are_persisted_with_registry_tier(monkeypatch):
    async def usgs(*args, **kwargs):
        return [{"id": "us7000test", "geometry": {"type": "Point", "coordinates": [125.0, 11.2, 10]},
                 "properties": {"title": "M 5.4 - Test", "mag": 5.4, "alert": "orange",
                                "time": 1_786_000_000_000, "updated": 1_786_000_001_000,
                                "url": "https://earthquake.usgs.gov/test"}}]
    monkeypatch.setattr(usgs_earthquake_connector, "fetch_usgs_earthquakes", usgs)
    await sync_module.run_all_wired_sources()
    rows = get_hazard_event_repo().rows
    row = rows["https://earthquake.usgs.gov/test"]
    assert row["provider"] == "usgs-earthquake"
    assert row["source_tier"] == 1  # canonical TrustTier.OFFICIAL
    assert row["severity_level"] == 3 and row["lat"] == 11.2 and row["lng"] == 125.0
    # A repeat upserts on citation_url rather than duplicating.
    await sync_module.run_all_wired_sources(force=True)
    usgs_rows = [r for r in get_hazard_event_repo().rows.values() if r["provider"] == "usgs-earthquake"]
    assert len(usgs_rows) == 1


def test_severity_levels_default_to_unknown():
    assert severity_level("Red") == 4 and severity_level(None) == 0 and severity_level("weird") == 0


# ---------------------------------------------------------------- sanitised reasons
async def test_failure_details_never_reach_health_audit_or_results(monkeypatch):
    secret = "https://internal.example/feed?token=SUPERSECRET"

    async def boom(*args, **kwargs):
        request = httpx.Request("GET", secret)
        raise httpx.HTTPStatusError(f"Server error for {secret}", request=request,
                                    response=httpx.Response(503, request=request, text="db password=hunter2"))
    monkeypatch.setattr(usgs_earthquake_connector, "fetch_usgs_earthquakes", boom)

    result = await sync_module.run_all_wired_sources()
    usgs = next(r for r in result["results"] if r["source_id"] == "usgs-earthquake")
    assert usgs["status"] == "failed" and usgs["reason_code"] == "upstream_server_error"

    health = {h["source_id"]: h for h in await get_sync_health_report()}["usgs-earthquake"]
    assert health["reason_code"] == "upstream_server_error"
    assert health["error"] == REASON_LABELS["upstream_server_error"]
    audit = await get_audit_log(source_id="usgs-earthquake")
    everything = repr((usgs, health, audit))
    assert "SUPERSECRET" not in everything and "hunter2" not in everything and "internal.example" not in everything


def test_legacy_raw_errors_map_into_the_vocabulary():
    assert safe_reason("Traceback ... password=x") == "unknown_error"
    assert safe_reason("upstream_timeout") == "upstream_timeout"
    assert safe_reason(None) is None


def test_classify_error_covers_common_failures():
    assert classify_error(httpx.ReadTimeout("slow")) == "upstream_timeout"
    assert classify_error(httpx.ConnectError("nope")) == "upstream_unreachable"
    assert classify_error(ValueError("bad json")) == "upstream_invalid_response"
    assert classify_error(RuntimeError("boom")) == "internal_error"
    request = httpx.Request("GET", "https://x.example")
    assert classify_error(httpx.HTTPStatusError("m", request=request, response=httpx.Response(429, request=request))) == "upstream_rate_limited"


def test_sync_health_endpoint_exposes_reason_code_field(client):
    entry = client.get("/api/sync-health").json()["sync_health"][0]
    assert "reason_code" in entry and entry["trust_level"] in (1, 2, 3, 4)


# ---------------------------------------------------------------- cron + durable state
def test_cron_requires_secret_and_ticks_are_cheap(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", "cron-secret")
    assert client.get("/api/cron/sync-sources").status_code == 403
    assert client.get("/api/cron/sync-sources", headers={"authorization": "Bearer nope"}).status_code == 403
    headers = {"authorization": "Bearer cron-secret"}
    assert client.get("/api/cron/sync-sources", headers=headers).json()["sources_synced"]
    assert client.get("/api/cron/sync-sources", headers=headers).json()["sources_synced"] == []


def test_manual_admin_sync_forces_every_source(client):
    client.get("/api/data-status")  # no-op; state starts empty
    for _ in range(2):
        body = client.post("/api/data-sync", headers=ADMIN_HEADERS).json()
        assert set(body["sources_synced"]) == sync_module.WIRED_SOURCE_IDS


def test_production_requires_database_url_unless_explicitly_allowed():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        require_durable_state(Settings(environment="production", database_url="", allow_ephemeral_state=False))
    require_durable_state(Settings(environment="production", database_url="postgresql://x", allow_ephemeral_state=False))
    require_durable_state(Settings(environment="production", database_url="", allow_ephemeral_state=True))
    require_durable_state(Settings(environment="development", database_url="", allow_ephemeral_state=False))


# ---------------------------------------------------------------- cache validators
async def test_data_status_reports_data_version(client):
    assert client.get("/api/data-status").json()["data_version"] == "static"
    await sync_module.run_all_wired_sources()
    body = client.get("/api/data-status").json()
    assert body["data_version"] == body["last_sync_timestamp"] != "static"


def test_hazard_layers_send_etag_and_honour_if_none_match(client):
    first = client.get("/api/hazard-layers?layer=overall")
    assert first.status_code == 200
    assert first.headers["cache-control"] == "public, max-age=60, stale-while-revalidate=300"
    etag = first.headers["etag"]
    again = client.get("/api/hazard-layers?layer=overall", headers={"if-none-match": etag})
    assert again.status_code == 304 and again.content == b""
    other_layer = client.get("/api/hazard-layers?layer=flood")
    assert other_layer.headers["etag"] != etag


async def test_etag_changes_after_a_sync(client):
    before = client.get("/api/hazard-layers?layer=overall").headers["etag"]
    await sync_module.run_all_wired_sources()
    assert client.get("/api/hazard-layers?layer=overall").headers["etag"] != before
    assert client.get("/api/hazard-layers?layer=overall", headers={"if-none-match": before}).status_code == 200


def test_events_endpoint_sets_cache_headers(client):
    resp = client.get("/api/events")
    assert resp.status_code == 200
    assert "etag" in resp.headers and "max-age=60" in resp.headers["cache-control"]


# ---------------------------------------------------------------- F7: public vs admin listing
def test_public_datasets_hide_pending_and_internal_fields(client):
    pending_id = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    approved = {**GOOD_UPLOAD, "name": "Approved survey"}
    approved_id = client.post("/api/datasets/upload", json=approved, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    client.post(f"/api/datasets/{approved_id}/review", json={"decision": "approved"}, headers=ADMIN_HEADERS)

    public = client.get("/api/datasets").json()["datasets"]
    ids = {d["id"] for d in public}
    assert approved_id in ids and pending_id not in ids
    uploaded = next(d for d in public if d["id"] == approved_id)
    assert "checksum" not in uploaded and "created_by" not in uploaded
    assert uploaded["trust_level"] == 5 and uploaded["review_status"] == "approved"
    assert all("checksum" not in d and "created_by" not in d for d in public)


def test_rejected_uploads_are_not_public(client):
    dataset_id = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    client.post(f"/api/datasets/{dataset_id}/review", json={"decision": "rejected"}, headers=ADMIN_HEADERS)
    assert dataset_id not in {d["id"] for d in client.get("/api/datasets").json()["datasets"]}


def test_admin_listing_is_gated_and_shows_everything(client):
    pending_id = client.post("/api/datasets/upload", json=GOOD_UPLOAD, headers=ADMIN_HEADERS).json()["dataset"]["id"]
    assert client.get("/api/admin/datasets").status_code == 403
    wrong = {"x-role": "dataset_admin", "authorization": "Bearer wrong"}
    assert client.get("/api/admin/datasets", headers=wrong).status_code == 403

    listed = client.get("/api/admin/datasets", headers=ADMIN_HEADERS).json()["datasets"]
    row = next(d for d in listed if d["id"] == pending_id)
    assert row["review_status"] == "pending" and len(row["checksum"]) == 64 and row["created_by"] == "dataset_admin"


# ---------------------------------------------------------------- tier 5 means user upload only
async def test_event_normalizers_never_emit_tier_five(monkeypatch):
    from app.data_sources.event_intelligence import normalize_eonet, normalize_gdacs, normalize_reliefweb, normalize_usgs
    now = datetime.now(timezone.utc)
    events = [
        normalize_usgs({"id": "u1", "geometry": {"type": "Point", "coordinates": [125, 11]}, "properties": {"title": "Q"}}, now),
        normalize_gdacs({"id": "g1", "geometry": {"type": "Point", "coordinates": [120, 10]}, "properties": {"eventtype": "TC", "name": "C"}}, now),
        normalize_eonet({"id": "e1", "categories": [{"title": "Wildfires"}], "geometry": [{"date": "2026-08-13T00:00:00Z", "type": "Point", "coordinates": [121, 11]}]}, now),
        normalize_reliefweb({"id": "r1", "fields": {"name": "Report", "type": [{"name": "Flood"}]}}, now),
    ]
    by_provider = {e.provider: e.source_tier for e in events}
    assert by_provider == {"usgs-earthquake": 1, "gdacs": 1, "nasa-eonet": 1, "reliefweb": 2}
    assert TrustTier.USER_UPLOAD not in by_provider.values()


# ---------------------------------------------------------------- F5: nosniff everywhere
def test_nosniff_on_every_kind_of_response(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "cron_secret", "cron-secret")
    assert client.get("/health").headers["x-content-type-options"] == "nosniff"           # 200
    assert client.get("/no-such-route").headers["x-content-type-options"] == "nosniff"    # 404
    assert client.get("/api/cron/sync-sources").headers["x-content-type-options"] == "nosniff"  # 403
    assert client.post("/api/datasets/upload", json={}).headers["x-content-type-options"] == "nosniff"  # 403
    first = client.get("/api/hazard-layers?layer=overall")
    assert first.headers["x-content-type-options"] == "nosniff"
    cached = client.get("/api/hazard-layers?layer=overall", headers={"if-none-match": first.headers["etag"]})
    assert cached.status_code == 304 and cached.headers["x-content-type-options"] == "nosniff"  # 304
    preflight = client.options("/api/datasets", headers={"origin": "http://localhost:3000", "access-control-request-method": "GET"})
    assert preflight.headers["x-content-type-options"] == "nosniff"                       # CORS preflight


# ---------------------------------------------------------------- F1: secrets never reach logs or responses
FIRMS_KEY = "FIRMSKEY-abc123xyz"


def test_redact_secrets_scrubs_configured_extra_and_firms_url_keys(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "nasa_firms_map_key", FIRMS_KEY)
    monkeypatch.setattr(settings, "cron_secret", "cron-secret-value")
    monkeypatch.setattr(settings, "admin_shared_secret", "admin-secret-value")
    text = f"boom cron-secret-value and admin-secret-value and {FIRMS_KEY} and extra-one"
    cleaned = redact_secrets(text, extra=["extra-one"])
    for secret in (FIRMS_KEY, "cron-secret-value", "admin-secret-value", "extra-one"):
        assert secret not in cleaned
    assert cleaned.count(REDACTED) == 4
    # A key that isn't configured anywhere is still caught by the FIRMS URL shape.
    url_only = "for url 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/UNKNOWNKEY999/VIIRS_SNPP_NRT/world/1'"
    assert "UNKNOWNKEY999" not in redact_secrets(url_only)


def test_redact_secrets_ignores_empty_and_tiny_secrets(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "nasa_firms_map_key", "")
    monkeypatch.setattr(settings, "cron_secret", "x")
    assert redact_secrets("an ordinary x message") == "an ordinary x message"
    assert redact_secrets(ValueError("plain")) == "plain"


def test_httpx_request_logs_are_redacted(caplog):
    """httpx logs the full request URL at INFO; that must not carry the key."""
    get_settings().nasa_firms_map_key = FIRMS_KEY
    try:
        caplog.set_level(logging.INFO)
        logging.getLogger("httpx").info('HTTP Request: %s %s "%s"', "GET", f"https://firms.example/api/area/csv/{FIRMS_KEY}/VIIRS/world/1", "HTTP/1.1 200 OK")
        assert FIRMS_KEY not in caplog.text and REDACTED in caplog.text
    finally:
        get_settings().nasa_firms_map_key = "test-map-key"


def _firms_failure(kind: str, seen: list):
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        if kind == "401":
            return httpx.Response(401, text="unauthorized")
        if kind == "timeout":
            raise httpx.ConnectTimeout(f"timed out for {request.url}", request=request)
        raise httpx.ConnectError(f"cannot connect to {request.url}", request=request)
    return handler


@pytest.mark.parametrize("kind,reason", [("401", "upstream_auth_rejected"), ("timeout", "upstream_timeout"),
                                          ("connect", "upstream_unreachable")])
def test_firms_key_never_appears_in_logs_or_api_responses(client, monkeypatch, caplog, kind, reason):
    settings = get_settings()
    monkeypatch.setattr(settings, "nasa_firms_map_key", FIRMS_KEY)
    monkeypatch.setattr(nasa_firms_connector, "fetch_firms_fire_data", _REAL_FETCH_FIRMS)
    seen: list[str] = []
    transport = httpx.MockTransport(_firms_failure(kind, seen))
    monkeypatch.setattr(sync_module.httpx, "AsyncClient", lambda **kw: _REAL_ASYNC_CLIENT(transport=transport, **kw))
    caplog.set_level(logging.DEBUG)

    sync = client.post("/api/data-sync", headers=ADMIN_HEADERS)
    health = client.get("/api/sync-health")
    audit = client.get("/api/sync-audit-log?source_id=nasa-firms")

    # Non-vacuous: the real connector ran and the key really was in the outbound URL.
    assert seen and FIRMS_KEY in seen[0]
    firms = next(r for r in sync.json()["results"] if r["source_id"] == "nasa-firms")
    assert firms["status"] == "failed" and firms["reason_code"] == reason

    assert FIRMS_KEY not in caplog.text
    for response in (sync, health, audit):
        assert FIRMS_KEY not in response.text
    assert "[nasa-firms] Fetch failed" in caplog.text  # the failure is still logged, just scrubbed
