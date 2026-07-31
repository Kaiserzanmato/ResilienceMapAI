"""Append-only sync audit log — records every sync attempt.

Storage lives in app/repositories/audit_log_repo.py — in-memory by default,
Postgres-backed when DATABASE_URL is set.
"""
from __future__ import annotations
from typing import Optional

from ...repositories.audit_log_repo import get_audit_log_repo


async def log_sync_attempt(
    source_id: str,
    status: str,
    records_synced: int = 0,
    error: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    await get_audit_log_repo().log(source_id, status, records_synced, error, duration_ms)


async def get_audit_log(source_id: Optional[str] = None, limit: int = 100) -> list[dict]:
    return await get_audit_log_repo().get(source_id=source_id, limit=limit)
