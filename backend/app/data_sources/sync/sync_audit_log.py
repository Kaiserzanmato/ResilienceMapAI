"""Append-only sync audit log — records every sync attempt."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)

_audit_log: list[dict] = []


def log_sync_attempt(
    source_id: str,
    status: str,
    records_synced: int = 0,
    error: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "source_id": source_id,
        "status": status,
        "records_synced": records_synced,
        "error": error,
        "duration_ms": duration_ms,
    }
    _audit_log.append(entry)
    if len(_audit_log) > 1000:
        _audit_log.pop(0)
    logger.info("[sync-audit] %s", entry)


def get_audit_log(source_id: Optional[str] = None, limit: int = 100) -> list[dict]:
    entries = _audit_log if not source_id else [
        e for e in _audit_log if e["source_id"] == source_id
    ]
    return list(reversed(entries[-limit:]))
