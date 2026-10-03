"""
Run a sync job for a specific source.
Called by the scheduler or manually triggered from the admin API.
Sync failures do NOT crash the app — last successful dataset is preserved.
"""
from __future__ import annotations
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from ...config import get_settings
from ...redaction import redact_secrets
from ...repositories.sync_health_repo import get_sync_health_repo
from ..registry.sources_registry import RiskSource, get_enabled_sources, get_source_by_id
from .credentials import missing_credentials
from .reason_codes import classify_error
from .source_sync_health import is_due, record_sync_success, record_sync_failure
from .sync_audit_log import log_sync_attempt

logger = logging.getLogger(__name__)

# Only these registry entries have real connector implementations (see
# _dispatch_connector below). Looping every enabled+auto_sync_enabled source
# would record unwired ones (e.g. noaa-nws-api, hdx) as a false-positive
# "success, 0 records" the moment _dispatch_connector's fallback returns [].
# Keep this in lockstep with the `if source_id == ...` branches below.
WIRED_SOURCE_IDS = {"gdacs", "nasa-eonet", "usgs-earthquake", "reliefweb", "nasa-firms"}


async def _persist_events(source_id: str, records: list[dict]) -> None:
    """Write normalized events to hazard_events (Postgres when configured); FIRMS
    detections go to fire_detections. Providers with neither are a no-op."""
    if source_id == "nasa-firms":
        # FIRMS rows are detections, not events: they go to fire_detections (wildfire score).
        from ...repositories.fire_repo import get_fire_repo
        from ...services.wildfire_scoring import parse_firms_record
        detections = [d for d in (parse_firms_record(r) for r in records) if d is not None]
        await get_fire_repo().upsert_many(detections)
        return
    from ...repositories.hazard_event_repo import get_hazard_event_repo
    from ..event_intelligence import NORMALIZERS, normalize_records
    if source_id not in NORMALIZERS:
        return
    accepted, _rejected = normalize_records(source_id, records, datetime.now(timezone.utc))
    await get_hazard_event_repo().upsert_many(accepted)


async def run_source_sync(source_id: str, http_client: Any) -> dict:
    """
    Run sync for a single source. Returns a result dict.
    Never raises — errors are caught, logged, and recorded.
    """
    source = get_source_by_id(source_id)
    if not source:
        return {"source_id": source_id, "status": "error", "error": "Source not found in registry"}
    if not source.enabled:
        return {"source_id": source_id, "status": "skipped", "reason": "Source disabled"}
    if not source.auto_sync_enabled:
        return {"source_id": source_id, "status": "skipped", "reason": "Auto-sync disabled — manual grounding only"}

    if missing_credentials(source_id):
        logger.warning("[sync] %s skipped: required credential not configured", source_id)
        return {"source_id": source_id, "status": "skipped", "reason": "not_configured"}

    start = time.monotonic()
    try:
        records = await _dispatch_connector(source_id, http_client)
        await _persist_events(source_id, records)
        # Current-event ingestion is feature-gated and retains its own
        # normalized cache. The legacy sync result remains intact for source
        # health/audit compatibility even when the feature is disabled.
        from ..event_intelligence import get_event_intelligence_service
        service = get_event_intelligence_service()
        if source_id in service.enabled_providers():
            service.ingest(source_id, records)
        duration_ms = int((time.monotonic() - start) * 1000)
        await record_sync_success(source_id, len(records))
        await log_sync_attempt(source_id, "success", len(records), duration_ms=duration_ms)
        if source_id == "nasa-firms":
            await _maybe_backfill_firms(http_client)
        return {
            "source_id": source_id,
            "status": "success",
            "records_synced": len(records),
            "duration_ms": duration_ms,
        }
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        # Full detail stays in server logs; only a closed reason code is stored or returned.
        reason = classify_error(exc)
        await record_sync_failure(source_id, reason)
        await log_sync_attempt(source_id, "failed", error=reason, duration_ms=duration_ms)
        logger.error("[sync] %s failed (%s): %s", source_id, reason, redact_secrets(exc))
        return {"source_id": source_id, "status": "failed", "reason_code": reason}


async def _maybe_backfill_firms(http_client: Any) -> None:
    """Self-healing: a single day's sync takes MIN_HISTORY_DAYS to build up enough
    history to score a zero honestly. When the recorded history (sync_health's
    first_successful_sync_at — see record_sync_success) is still shorter than that,
    reach back using FIRMS's own maximum per-request range (10 days, same range
    scripts/backfill_firms.py uses for a manual backfill) so a fresh deploy or a
    long gap in syncing does not take a week to recover. Upserts are idempotent
    (fire_repo.upsert_many), so running this on every sync while history is short
    is safe — it just re-confirms rows already stored."""
    from ...services.wildfire_scoring import MIN_HISTORY_DAYS

    health = await get_sync_health_repo().get("nasa-firms")
    first_ok = health.get("first_successful_sync_at")
    if not first_ok:
        return
    first_ok_dt = datetime.fromisoformat(first_ok) if isinstance(first_ok, str) else first_ok
    if first_ok_dt.tzinfo is None:
        first_ok_dt = first_ok_dt.replace(tzinfo=timezone.utc)
    history_days = (datetime.now(timezone.utc) - first_ok_dt).total_seconds() / 86_400
    if history_days >= MIN_HISTORY_DAYS:
        return

    settings = get_settings()
    if not settings.nasa_firms_map_key:
        return
    from ..connectors.nasa_firms_connector import MAX_RANGE, fetch_firms_fire_data
    from ...repositories.fire_repo import get_fire_repo
    from ...services.wildfire_scoring import parse_firms_record
    try:
        records = await fetch_firms_fire_data(
            http_client, map_key=settings.nasa_firms_map_key, area_url=settings.nasa_firms_area, days=MAX_RANGE,
        )
    except Exception as exc:
        logger.warning("[sync] nasa-firms self-healing backfill failed (%s)", type(exc).__name__)
        return
    detections = [d for d in (parse_firms_record(r) for r in records) if d is not None]
    stored = await get_fire_repo().upsert_many(detections)
    logger.info("[sync] nasa-firms self-healing backfill: history %.1fd < %dd, fetched %d days, stored %d",
                history_days, MIN_HISTORY_DAYS, MAX_RANGE, stored)


async def _dispatch_connector(source_id: str, http_client: Any) -> list[dict]:
    """Route to the appropriate connector."""
    if source_id == "gdacs":
        from ..connectors.gdacs_connector import fetch_gdacs_events
        return await fetch_gdacs_events(http_client)
    if source_id == "nasa-eonet":
        from ..connectors.nasa_eonet_connector import fetch_eonet_events
        return await fetch_eonet_events(http_client)
    if source_id == "usgs-earthquake":
        from ..connectors.usgs_earthquake_connector import fetch_usgs_earthquakes
        return await fetch_usgs_earthquakes(http_client)
    if source_id == "reliefweb":
        from ..connectors.reliefweb_connector import fetch_reliefweb_disasters
        return await fetch_reliefweb_disasters(http_client)
    if source_id == "nasa-firms":
        from ..connectors.nasa_firms_connector import fetch_firms_fire_data
        settings = get_settings()
        # 2 days, not 1: a run near UTC midnight must not miss detections from just
        # before the rollover. Upserts are idempotent, so the one-day overlap just
        # re-confirms rows already stored.
        return await fetch_firms_fire_data(
            http_client, map_key=settings.nasa_firms_map_key, area_url=settings.nasa_firms_area, days=2,
        )

    logger.warning("[sync] No connector found for %s — skipping", source_id)
    return []


async def run_all_wired_sources(force: bool = False) -> dict:
    """Sync every enabled, auto-sync-eligible, WIRED source that is due. Shared
    by the cron-triggered endpoint and the RBAC-gated manual admin trigger, so
    the two never diverge in behavior.

    A source is "due" once its own sync_frequency_minutes has elapsed since its
    last successful sync (or it has never synced), so the cron can tick faster
    than the slowest source without hammering providers. Manual admin triggers
    pass force=True to sync everything regardless. Sequential — a handful of
    fast public API calls, no need for concurrency."""
    targets = [
        s for s in get_enabled_sources()
        if s.id in WIRED_SOURCE_IDS and s.auto_sync_enabled
    ]
    all_health = await get_sync_health_repo().get_all()
    now = datetime.now(timezone.utc)
    results = []
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
        for source in targets:
            if not force and not is_due(all_health.get(source.id, {}), source, now):
                results.append({"source_id": source.id, "status": "skipped", "reason": "not_due"})
                continue
            results.append(await run_source_sync(source.id, client))

    return {
        "triggered_at": now.isoformat(),
        "forced": force,
        "sources_synced": [r["source_id"] for r in results if r["status"] in ("success", "failed")],
        "sources_skipped": [r["source_id"] for r in results if r["status"] == "skipped"],
        "results": results,
    }
