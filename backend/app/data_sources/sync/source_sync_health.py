"""Track and expose sync health status per source.

Storage lives in app/repositories/sync_health_repo.py — in-memory by default,
Postgres-backed when DATABASE_URL is set. This module keeps the same public
functions callers already use, now async since the Postgres path is async.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from ...repositories.sync_health_repo import get_sync_health_repo
from ..registry.sources_registry import SOURCE_REGISTRY, RiskSource
from .credentials import missing_credentials
from .reason_codes import REASON_LABELS, safe_reason


async def record_sync_success(source_id: str, records_synced: int = 0) -> None:
    await get_sync_health_repo().record_success(source_id, records_synced)


async def record_sync_failure(source_id: str, error: str) -> None:
    await get_sync_health_repo().record_failure(source_id, error)


def _is_stale(health: dict, source: RiskSource) -> bool:
    if not source.auto_sync_enabled or not source.sync_frequency_minutes:
        return False
    last_ok = health.get("last_successful_sync_at")
    if not last_ok:
        return True
    last_ok_dt = datetime.fromisoformat(last_ok)
    if last_ok_dt.tzinfo is None:
        last_ok_dt = last_ok_dt.replace(tzinfo=timezone.utc)
    threshold = timedelta(minutes=source.sync_frequency_minutes * 3)
    return datetime.now(timezone.utc) - last_ok_dt > threshold


def is_due(health: dict, source: RiskSource, now: datetime | None = None) -> bool:
    """True when the source's own sync frequency has elapsed since its last
    successful sync (or it never synced). Distinct from staleness, which only
    trips after 3x the frequency and is what the UI flags."""
    if not source.sync_frequency_minutes:
        return True
    last_ok = health.get("last_successful_sync_at")
    if not last_ok:
        return True
    last_ok_dt = datetime.fromisoformat(last_ok)
    if last_ok_dt.tzinfo is None:
        last_ok_dt = last_ok_dt.replace(tzinfo=timezone.utc)
    return (now or datetime.now(timezone.utc)) - last_ok_dt >= timedelta(minutes=source.sync_frequency_minutes)


async def get_data_version() -> str:
    """Newest successful sync timestamp across all sources, or "static" before
    the first sync. Used as the cache validator for data-derived responses."""
    all_health = await get_sync_health_repo().get_all()
    times = [h["last_successful_sync_at"] for h in all_health.values() if h.get("last_successful_sync_at")]
    return max(times) if times else "static"


async def is_source_stale(source: RiskSource) -> bool:
    health = await get_sync_health_repo().get(source.id)
    return _is_stale(health, source)


async def get_sync_health_report() -> list[dict]:
    all_health = await get_sync_health_repo().get_all()
    report = []
    for source in SOURCE_REGISTRY:
        health = all_health.get(source.id, {})
        # A wired source missing its credential is skipped by the runner; report that
        # plainly rather than as "never synced" / "stale".
        not_configured = source.auto_sync_enabled and missing_credentials(source.id)
        report.append({
            "source_id": source.id,
            "source_name": source.name,
            "organization": source.organization,
            "coverage": source.coverage,
            "domains": source.domains,
            "access_type": source.access_type,
            "trust_level": int(source.trust_level),
            "confidence_category": source.confidence_category,
            "enabled": source.enabled,
            "auto_sync_enabled": source.auto_sync_enabled,
            "sync_frequency_minutes": source.sync_frequency_minutes,
            "last_sync_at": health.get("last_sync_at"),
            "last_successful_sync_at": health.get("last_successful_sync_at"),
            "last_sync_status": "not_configured" if not_configured else health.get(
                "last_sync_status", "disabled" if not source.auto_sync_enabled else "never"),
            "records_synced": health.get("records_synced", 0),
            # Closed vocabulary only — legacy raw strings map to "unknown_error".
            "reason_code": "not_configured" if not_configured else safe_reason(health.get("error")),
            "error": REASON_LABELS.get("not_configured" if not_configured else (safe_reason(health.get("error")) or "")),
            "is_stale": False if not_configured else _is_stale(health, source),
            "source_url": source.url,
            "docs_url": source.docs_url,
            "requires_api_key": source.requires_api_key,
            "requires_registration": source.requires_registration,
            "license_notes": source.license_notes,
        })
    return report
