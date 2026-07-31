"""Shareable-report repository — in-memory (default) or Postgres-backed
(when DATABASE_URL is set). Replaces the module-level `_REPORT_STORE` dict
that previously lived directly in app/services/exporters.py."""
from __future__ import annotations

import secrets
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from sqlalchemy import select

from ..db import database_configured, get_sessionmaker
from ..models import ReportRow


class ReportRepo(ABC):
    @abstractmethod
    async def store(self, payload: dict) -> str: ...

    @abstractmethod
    async def get(self, report_id: str) -> Optional[dict]: ...

    @abstractmethod
    async def list(self) -> list[dict]: ...


class InMemoryReportRepo(ReportRepo):
    def __init__(self) -> None:
        self._reports: dict[str, dict] = {}

    async def store(self, payload: dict) -> str:
        report_id = secrets.token_urlsafe(8)
        payload = dict(payload)
        payload["id"] = report_id
        payload["created_at"] = datetime.now(timezone.utc).isoformat()
        self._reports[report_id] = payload
        return report_id

    async def get(self, report_id: str) -> Optional[dict]:
        return self._reports.get(report_id)

    async def list(self) -> list[dict]:
        return sorted(self._reports.values(), key=lambda r: r["created_at"], reverse=True)


class PostgresReportRepo(ReportRepo):
    async def store(self, payload: dict) -> str:
        report_id = secrets.token_urlsafe(8)
        now = datetime.now(timezone.utc)
        row = ReportRow(id=report_id, payload=payload, created_at=now)
        async with get_sessionmaker()() as session:
            session.add(row)
            await session.commit()
        return report_id

    async def get(self, report_id: str) -> Optional[dict]:
        async with get_sessionmaker()() as session:
            row = await session.get(ReportRow, report_id)
            return _row_to_dict(row) if row else None

    async def list(self) -> list[dict]:
        async with get_sessionmaker()() as session:
            result = await session.execute(select(ReportRow).order_by(ReportRow.created_at.desc()))
            return [_row_to_dict(row) for row in result.scalars()]


def _row_to_dict(row: ReportRow) -> dict:
    payload = dict(row.payload)
    payload["id"] = row.id
    payload["created_at"] = row.created_at.isoformat()
    return payload


@lru_cache()
def get_report_repo() -> ReportRepo:
    return PostgresReportRepo() if database_configured() else InMemoryReportRepo()
