"""Track and expose sync health status per source."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
import logging

from ..registry.sources_registry import SOURCE_REGISTRY, RiskSource

logger = logging.getLogger(__name__)

# In-memory sync health store (replace with DB in production)
_sync_health: dict[str, dict] = {}


def record_sync_success(source_id: str, records_synced: int = 0) -> None:
    now = datetime.utcnow()
    _sync_health[source_id] = {
        "last_sync_at": now.isoformat(),
        "last_successful_sync_at": now.isoformat(),
        "last_sync_status": "success",
        "records_synced": records_synced,
        "error": None,
    }
    logger.info("[sync-health] %s — success (%d records)", source_id, records_synced)


def record_sync_failure(source_id: str, error: str) -> None:
    now = datetime.utcnow()
    prev = _sync_health.get(source_id, {})
    _sync_health[source_id] = {
        "last_sync_at": now.isoformat(),
        "last_successful_sync_at": prev.get("last_successful_sync_at"),
        "last_sync_status": "failed",
        "records_synced": prev.get("records_synced", 0),
        "error": error,
    }
    logger.warning("[sync-health] %s — FAILED: %s", source_id, error)


def is_source_stale(source: RiskSource) -> bool:
    if not source.auto_sync_enabled or not source.sync_frequency_minutes:
        return False
    health = _sync_health.get(source.id, {})
    last_ok = health.get("last_successful_sync_at")
    if not last_ok:
        return True
    last_ok_dt = datetime.fromisoformat(last_ok)
    threshold = timedelta(minutes=source.sync_frequency_minutes * 3)
    return datetime.utcnow() - last_ok_dt > threshold


def get_sync_health_report() -> list[dict]:
    report = []
    for source in SOURCE_REGISTRY:
        health = _sync_health.get(source.id, {})
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
            "is_stale": is_source_stale(source),
            "source_url": source.url,
            "docs_url": source.docs_url,
            "requires_api_key": source.requires_api_key,
            "requires_registration": source.requires_registration,
            "license_notes": source.license_notes,
        })
    return report
