"""Track and expose sync health status per source.

Storage lives in app/repositories/sync_health_repo.py — in-memory by default,
Postgres-backed when DATABASE_URL is set. This module keeps the same public
functions callers already use, now async since the Postgres path is async.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

from ...repositories.sync_health_repo import get_sync_health_repo
from ..registry.sources_registry import SOURCE_REGISTRY, RiskSource


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


async def is_source_stale(source: RiskSource) -> bool:
    health = await get_sync_health_repo().get(source.id)
    return _is_stale(health, source)


async def get_sync_health_report() -> list[dict]:
    all_health = await get_sync_health_repo().get_all()
    report = []
    for source in SOURCE_REGISTRY:
        health = all_health.get(source.id, {})
        report.append({
            "source_id": source.id,
            "source_name": source.name,
            "organization": source.organization,
            "coverage": source.coverage,
            "domains": source.domains,
            "access_type": source.access_type,
            "trust_level": source.trust_level,
            "confidence_category": source.confidence_category,
            "enabled": source.enabled,
            "auto_sync_enabled": source.auto_sync_enabled,
            "sync_frequency_minutes": source.sync_frequency_minutes,
            "last_sync_at": health.get("last_sync_at"),
            "last_successful_sync_at": health.get("last_successful_sync_at"),
            "last_sync_status": health.get("last_sync_status", "disabled" if not source.auto_sync_enabled else "never"),
            "records_synced": health.get("records_synced", 0),
            "error": health.get("error"),
            "is_stale": _is_stale(health, source),
            "source_url": source.url,
            "docs_url": source.docs_url,
            "requires_api_key": source.requires_api_key,
            "requires_registration": source.requires_registration,
            "license_notes": source.license_notes,
        })
    return report
