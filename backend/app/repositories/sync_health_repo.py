"""Sync health repository — in-memory (default) or Postgres-backed (when
DATABASE_URL is set). Replaces the module-level `_sync_health` dict that
previously lived directly in app/data_sources/sync/source_sync_health.py."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from sqlalchemy import select

from ..db import database_configured, get_sessionmaker
from ..models import SyncHealthRow

logger = logging.getLogger(__name__)


class SyncHealthRepo(ABC):
    @abstractmethod
    async def record_success(self, source_id: str, records_synced: int) -> None: ...

    @abstractmethod
    async def record_failure(self, source_id: str, error: str) -> None: ...

    @abstractmethod
    async def get(self, source_id: str) -> dict: ...

    @abstractmethod
    async def get_all(self) -> dict[str, dict]: ...


class InMemorySyncHealthRepo(SyncHealthRepo):
    def __init__(self) -> None:
        self._health: dict[str, dict] = {}

    async def record_success(self, source_id: str, records_synced: int) -> None:
        now = datetime.now(timezone.utc)
        self._health[source_id] = {
            "last_sync_at": now.isoformat(),
            "last_successful_sync_at": now.isoformat(),
            "last_sync_status": "success",
            "records_synced": records_synced,
            "error": None,
        }
        logger.info("[sync-health] %s — success (%d records)", source_id, records_synced)

    async def record_failure(self, source_id: str, error: str) -> None:
        now = datetime.now(timezone.utc)
        prev = self._health.get(source_id, {})
        self._health[source_id] = {
            "last_sync_at": now.isoformat(),
            "last_successful_sync_at": prev.get("last_successful_sync_at"),
            "last_sync_status": "failed",
            "records_synced": prev.get("records_synced", 0),
            "error": error,
        }
        logger.warning("[sync-health] %s — FAILED: %s", source_id, error)

    async def get(self, source_id: str) -> dict:
        return self._health.get(source_id, {})

    async def get_all(self) -> dict[str, dict]:
        return dict(self._health)


class PostgresSyncHealthRepo(SyncHealthRepo):
    async def record_success(self, source_id: str, records_synced: int) -> None:
        now = datetime.now(timezone.utc)
        async with get_sessionmaker()() as session:
            row = await session.get(SyncHealthRow, source_id)
            if row is None:
                row = SyncHealthRow(source_id=source_id)
                session.add(row)
            row.last_sync_at = now
            row.last_successful_sync_at = now
            row.last_sync_status = "success"
            row.records_synced = records_synced
            row.error = None
            await session.commit()
        logger.info("[sync-health] %s — success (%d records)", source_id, records_synced)

    async def record_failure(self, source_id: str, error: str) -> None:
        now = datetime.now(timezone.utc)
        async with get_sessionmaker()() as session:
            row = await session.get(SyncHealthRow, source_id)
            if row is None:
                row = SyncHealthRow(source_id=source_id, records_synced=0)
                session.add(row)
            row.last_sync_at = now
            row.last_sync_status = "failed"
            row.error = error
            await session.commit()
        logger.warning("[sync-health] %s — FAILED: %s", source_id, error)

    async def get(self, source_id: str) -> dict:
        async with get_sessionmaker()() as session:
            row = await session.get(SyncHealthRow, source_id)
            return _row_to_dict(row) if row else {}

    async def get_all(self) -> dict[str, dict]:
        async with get_sessionmaker()() as session:
            result = await session.execute(select(SyncHealthRow))
            return {row.source_id: _row_to_dict(row) for row in result.scalars()}


def _row_to_dict(row: SyncHealthRow) -> dict:
    return {
        "last_sync_at": row.last_sync_at.isoformat() if row.last_sync_at else None,
        "last_successful_sync_at": (
            row.last_successful_sync_at.isoformat() if row.last_successful_sync_at else None
        ),
        "last_sync_status": row.last_sync_status,
        "records_synced": row.records_synced,
        "error": row.error,
    }


@lru_cache()
def get_sync_health_repo() -> SyncHealthRepo:
    return PostgresSyncHealthRepo() if database_configured() else InMemorySyncHealthRepo()
