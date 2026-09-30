"""Uploaded-dataset-metadata repository — in-memory (default) or
Postgres-backed (when DATABASE_URL is set). Replaces the module-level
`_uploaded_datasets` list that previously lived directly in app/main.py.

Uploads are tier 5 (user upload) and start as `pending`. Only `approved` rows
may influence scoring or AI grounding; use `list(approved_only=True)` for those
consumers.
"""
from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from sqlalchemy import select

from ..data_sources.registry.sources_registry import TrustTier
from ..db import database_configured, get_sessionmaker
from ..models import UploadedDatasetRow

REVIEW_DECISIONS = {"approved", "rejected"}
# Legacy `status` values are kept for the admin table's existing colour coding.
_STATUS_FOR_REVIEW = {"pending": "pending_review", "approved": "active", "rejected": "rejected"}


def dataset_checksum(meta: dict) -> str:
    """Stable SHA-256 over the descriptive fields, so later edits are detectable."""
    canonical = {k: meta.get(k) for k in ("name", "agency", "category", "url", "records", "license")}
    return hashlib.sha256(json.dumps(canonical, sort_keys=True, default=str).encode()).hexdigest()


def _public(entry: dict) -> dict:
    return {**entry, "status": _STATUS_FOR_REVIEW.get(entry["review_status"], entry["review_status"])}


class DatasetRepo(ABC):
    @abstractmethod
    async def add(self, meta: dict, created_by: Optional[str] = None) -> dict: ...

    @abstractmethod
    async def list(self, approved_only: bool = False) -> list[dict]: ...

    @abstractmethod
    async def review(self, dataset_id: str, decision: str, reviewer: Optional[str] = None) -> Optional[dict]:
        """Approve or reject a dataset. Returns None if it doesn't exist."""


class InMemoryDatasetRepo(DatasetRepo):
    def __init__(self) -> None:
        self._datasets: list[dict] = []

    async def add(self, meta: dict, created_by: Optional[str] = None) -> dict:
        entry = {
            "name": meta["name"], "agency": meta["agency"], "category": meta["category"],
            "url": meta["url"], "confidence": meta.get("confidence", "Medium"),
            "records": meta.get("records", 0), "license": meta.get("license"),
            "id": f"ds-up-{len(self._datasets) + 1}",
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "trust_level": int(TrustTier.USER_UPLOAD),
            "review_status": "pending",
            "last_verified_at": None,
            "checksum": dataset_checksum(meta),
            "created_by": created_by,
        }
        self._datasets.append(entry)
        return _public(entry)

    async def list(self, approved_only: bool = False) -> list[dict]:
        return [_public(d) for d in self._datasets if not approved_only or d["review_status"] == "approved"]

    async def review(self, dataset_id: str, decision: str, reviewer: Optional[str] = None) -> Optional[dict]:
        entry = next((d for d in self._datasets if d["id"] == dataset_id), None)
        if entry is None:
            return None
        entry["review_status"] = decision
        entry["last_verified_at"] = datetime.now(timezone.utc).isoformat() if decision == "approved" else None
        return _public(entry)


def _row_to_dict(row: UploadedDatasetRow) -> dict:
    return _public({
        "id": row.id, "name": row.name, "agency": row.agency, "category": row.category,
        "url": row.url, "confidence": row.confidence, "records": row.records,
        "license": row.license, "trust_level": row.trust_level,
        "review_status": row.review_status,
        "last_verified_at": row.last_verified_at.isoformat() if row.last_verified_at else None,
        "checksum": row.checksum, "created_by": row.created_by,
        "updated": row.created_at.strftime("%Y-%m-%d"),
    })


class PostgresDatasetRepo(DatasetRepo):
    async def add(self, meta: dict, created_by: Optional[str] = None) -> dict:
        now = datetime.now(timezone.utc)
        async with get_sessionmaker()() as session:
            count_result = await session.execute(select(UploadedDatasetRow))
            next_id = f"ds-up-{len(count_result.scalars().all()) + 1}"
            row = UploadedDatasetRow(
                id=next_id,
                name=meta["name"], agency=meta["agency"], category=meta["category"],
                url=meta["url"], confidence=meta.get("confidence", "Medium"),
                records=meta.get("records", 0), status="pending_review", created_at=now,
                trust_level=int(TrustTier.USER_UPLOAD), review_status="pending",
                license=meta.get("license"), checksum=dataset_checksum(meta), created_by=created_by,
            )
            session.add(row)
            await session.commit()
            return _row_to_dict(row)

    async def list(self, approved_only: bool = False) -> list[dict]:
        async with get_sessionmaker()() as session:
            query = select(UploadedDatasetRow)
            if approved_only:
                query = query.where(UploadedDatasetRow.review_status == "approved")
            result = await session.execute(query)
            return [_row_to_dict(row) for row in result.scalars()]

    async def review(self, dataset_id: str, decision: str, reviewer: Optional[str] = None) -> Optional[dict]:
        async with get_sessionmaker()() as session:
            row = await session.get(UploadedDatasetRow, dataset_id)
            if row is None:
                return None
            row.review_status = decision
            row.status = _STATUS_FOR_REVIEW[decision]
            row.last_verified_at = datetime.now(timezone.utc) if decision == "approved" else None
            await session.commit()
            return _row_to_dict(row)


@lru_cache()
def get_dataset_repo() -> DatasetRepo:
    return PostgresDatasetRepo() if database_configured() else InMemoryDatasetRepo()
