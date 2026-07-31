"""Uploaded-dataset-metadata repository — in-memory (default) or
Postgres-backed (when DATABASE_URL is set). Replaces the module-level
`_uploaded_datasets` list that previously lived directly in app/main.py."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy import select

from ..db import database_configured, get_sessionmaker
from ..models import UploadedDatasetRow


class DatasetRepo(ABC):
    @abstractmethod
    async def add(self, meta: dict) -> dict: ...

    @abstractmethod
    async def list(self) -> list[dict]: ...


class InMemoryDatasetRepo(DatasetRepo):
    def __init__(self) -> None:
        self._datasets: list[dict] = []

    async def add(self, meta: dict) -> dict:
        entry = dict(meta)
        entry.update({
            "id": f"ds-up-{len(self._datasets) + 1}",
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "status": "pending_review",
        })
        self._datasets.append(entry)
        return entry

    async def list(self) -> list[dict]:
        return list(self._datasets)


class PostgresDatasetRepo(DatasetRepo):
    async def add(self, meta: dict) -> dict:
        now = datetime.now(timezone.utc)
        async with get_sessionmaker()() as session:
            count_result = await session.execute(select(UploadedDatasetRow))
            next_id = f"ds-up-{len(count_result.scalars().all()) + 1}"
            row = UploadedDatasetRow(
                id=next_id,
                name=meta["name"], agency=meta["agency"], category=meta["category"],
                url=meta["url"], confidence=meta.get("confidence", "Medium"),
                records=meta.get("records", 0), status="pending_review", created_at=now,
            )
            session.add(row)
            await session.commit()
        return {
            "name": row.name, "agency": row.agency, "category": row.category,
            "url": row.url, "confidence": row.confidence, "records": row.records,
            "id": row.id, "updated": now.strftime("%Y-%m-%d"), "status": row.status,
        }

    async def list(self) -> list[dict]:
        async with get_sessionmaker()() as session:
            result = await session.execute(select(UploadedDatasetRow))
            return [
                {
                    "id": row.id, "name": row.name, "agency": row.agency,
                    "category": row.category, "url": row.url, "confidence": row.confidence,
                    "records": row.records, "status": row.status,
                    "updated": row.created_at.strftime("%Y-%m-%d"),
                }
                for row in result.scalars()
            ]


@lru_cache()
def get_dataset_repo() -> DatasetRepo:
    return PostgresDatasetRepo() if database_configured() else InMemoryDatasetRepo()
