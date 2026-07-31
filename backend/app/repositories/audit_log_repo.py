"""Sync audit log repository — in-memory (default) or Postgres-backed (when
DATABASE_URL is set). Replaces the module-level `_audit_log` list that
previously lived directly in app/data_sources/sync/sync_audit_log.py."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from sqlalchemy import desc, select

from ..db import database_configured, get_sessionmaker
from ..models import SyncAuditLogRow

logger = logging.getLogger(__name__)

# In-memory log is capped to bound memory use; Postgres has no such cap this
# phase (volume is small: a handful of wired sources at a 15-minute cadence).
_IN_MEMORY_CAP = 1000


class AuditLogRepo(ABC):
    @abstractmethod
    async def log(
        self, source_id: str, status: str, records_synced: int = 0,
        error: Optional[str] = None, duration_ms: Optional[int] = None,
    ) -> None: ...

    @abstractmethod
    async def get(self, source_id: Optional[str] = None, limit: int = 100) -> list[dict]: ...


class InMemoryAuditLogRepo(AuditLogRepo):
    def __init__(self) -> None:
        self._log: list[dict] = []

    async def log(
        self, source_id: str, status: str, records_synced: int = 0,
        error: Optional[str] = None, duration_ms: Optional[int] = None,
    ) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_id": source_id,
            "status": status,
            "records_synced": records_synced,
            "error": error,
            "duration_ms": duration_ms,
        }
        self._log.append(entry)
        if len(self._log) > _IN_MEMORY_CAP:
            self._log.pop(0)
        logger.info("[sync-audit] %s", entry)

    async def get(self, source_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        entries = self._log if not source_id else [e for e in self._log if e["source_id"] == source_id]
        return list(reversed(entries[-limit:]))


class PostgresAuditLogRepo(AuditLogRepo):
    async def log(
        self, source_id: str, status: str, records_synced: int = 0,
        error: Optional[str] = None, duration_ms: Optional[int] = None,
    ) -> None:
        entry = SyncAuditLogRow(
            timestamp=datetime.now(timezone.utc), source_id=source_id, status=status,
            records_synced=records_synced, error=error, duration_ms=duration_ms,
        )
        async with get_sessionmaker()() as session:
            session.add(entry)
            await session.commit()
        logger.info("[sync-audit] source_id=%s status=%s records=%d", source_id, status, records_synced)

    async def get(self, source_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        stmt = select(SyncAuditLogRow).order_by(desc(SyncAuditLogRow.id)).limit(limit)
        if source_id:
            stmt = stmt.where(SyncAuditLogRow.source_id == source_id)
        async with get_sessionmaker()() as session:
            result = await session.execute(stmt)
            return [
                {
                    "timestamp": row.timestamp.isoformat(),
                    "source_id": row.source_id,
                    "status": row.status,
                    "records_synced": row.records_synced,
                    "error": row.error,
                    "duration_ms": row.duration_ms,
                }
                for row in result.scalars()
            ]


@lru_cache()
def get_audit_log_repo() -> AuditLogRepo:
    return PostgresAuditLogRepo() if database_configured() else InMemoryAuditLogRepo()
