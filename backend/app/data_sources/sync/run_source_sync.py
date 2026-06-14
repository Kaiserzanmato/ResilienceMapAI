"""
Run a sync job for a specific source.
Called by the scheduler or manually triggered from the admin API.
Sync failures do NOT crash the app — last successful dataset is preserved.
"""
from __future__ import annotations
import logging
import time
from typing import Any

from ..registry.sources_registry import get_source_by_id
from .source_sync_health import record_sync_success, record_sync_failure
from .sync_audit_log import log_sync_attempt

logger = logging.getLogger(__name__)


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

    start = time.monotonic()
    try:
        records = await _dispatch_connector(source_id, http_client)
        duration_ms = int((time.monotonic() - start) * 1000)
        record_sync_success(source_id, len(records))
        log_sync_attempt(source_id, "success", len(records), duration_ms=duration_ms)
        return {
            "source_id": source_id,
            "status": "success",
            "records_synced": len(records),
            "duration_ms": duration_ms,
        }
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        err = str(exc)
        record_sync_failure(source_id, err)
        log_sync_attempt(source_id, "failed", error=err, duration_ms=duration_ms)
        logger.error("[sync] %s failed: %s", source_id, err)
        return {"source_id": source_id, "status": "failed", "error": err}


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

    logger.warning("[sync] No connector found for %s — skipping", source_id)
    return []
