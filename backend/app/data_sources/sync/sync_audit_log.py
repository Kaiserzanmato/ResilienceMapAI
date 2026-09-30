"""Append-only sync audit log — records every sync attempt.

Storage lives in app/repositories/audit_log_repo.py — in-memory by default,
Postgres-backed when DATABASE_URL is set.
"""
from __future__ import annotations
from typing import Optional

from ...repositories.audit_log_repo import get_audit_log_repo
from .reason_codes import REASON_LABELS, safe_reason


async def log_sync_attempt(
    source_id: str,
    status: str,
    records_synced: int = 0,
    error: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    await get_audit_log_repo().log(source_id, status, records_synced, error, duration_ms)


async def get_audit_log(source_id: Optional[str] = None, limit: int = 100) -> list[dict]:
    entries = await get_audit_log_repo().get(source_id=source_id, limit=limit)
    sanitized = []
    for entry in entries:
        reason = safe_reason(entry.get("error"))
        sanitized.append({**entry, "reason_code": reason, "error": REASON_LABELS.get(reason or "")})
    return sanitized
