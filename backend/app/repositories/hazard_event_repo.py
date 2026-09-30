"""Persistence for events synced from wired providers — Postgres (`hazard_events`,
PostGIS point) when DATABASE_URL is set, otherwise a bounded in-memory store.

Upserts on `citation_url` (the provider's source URL, or a stable urn built from
the namespaced event id when the provider has none), so repeated syncs update a
record instead of duplicating it. `source_tier` is the canonical TrustTier
(normalizers take it from the registry, so tier 5 only ever means user upload).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from sqlalchemy import text

from ..data_sources.event_intelligence import NormalizedEvent
from ..data_sources.registry.sources_registry import get_source_by_id
from ..db import database_configured, get_sessionmaker

MAX_IN_MEMORY = 5000

# hazard_events.severity_level is a non-null integer: 0 = unknown, 1 (low) .. 4 (extreme).
_SEVERITY_LEVELS = {
    "green": 1, "observed": 1, "minor": 1, "low": 1,
    "yellow": 2, "moderate": 2,
    "orange": 3, "significant": 3, "high": 3,
    "red": 4, "severe": 4, "extreme": 4, "critical": 4,
}

UPSERT_SYNCED_EVENT = text("""
    INSERT INTO hazard_events (
        event_type, source_agency, location_name, severity_level, summary,
        citation_url, geom, updated_at, provider, source_tier, retrieved_at
    )
    VALUES (
        :event_type, :source_agency, :location_name, :severity_level, :summary,
        :citation_url,
        CASE WHEN CAST(:lng AS float8) IS NULL OR CAST(:lat AS float8) IS NULL THEN NULL
             ELSE ST_SetSRID(ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)), 4326) END,
        :updated_at, :provider, :source_tier, :retrieved_at
    )
    ON CONFLICT (citation_url) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        location_name = EXCLUDED.location_name,
        severity_level = EXCLUDED.severity_level,
        summary = EXCLUDED.summary,
        geom = EXCLUDED.geom,
        updated_at = EXCLUDED.updated_at,
        provider = EXCLUDED.provider,
        source_tier = EXCLUDED.source_tier,
        retrieved_at = EXCLUDED.retrieved_at;
""")


def severity_level(severity: str | None) -> int:
    return _SEVERITY_LEVELS.get((severity or "").strip().lower(), 0)


def event_row(event: NormalizedEvent) -> dict[str, Any]:
    source = get_source_by_id(event.provider)
    place = ", ".join(event.admin_regions or event.countries)
    return {
        "event_type": event.hazard_type,
        "source_agency": source.organization if source else event.provider,
        "location_name": place or "Unknown",
        "severity_level": severity_level(event.severity),
        "summary": (event.description or event.title)[:2000],
        "citation_url": str(event.source_url) if event.source_url else f"urn:resiliencemap:{event.event_id}",
        "lat": event.latitude,
        "lng": event.longitude,
        "updated_at": event.updated_at or event.retrieved_at,
        "provider": event.provider,
        "source_tier": event.source_tier,
        "retrieved_at": event.retrieved_at,
    }


class HazardEventRepo(ABC):
    @abstractmethod
    async def upsert_many(self, events: list[NormalizedEvent]) -> int:
        """Insert or update events; returns how many were written."""


class InMemoryHazardEventRepo(HazardEventRepo):
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    async def upsert_many(self, events: list[NormalizedEvent]) -> int:
        for event in events:
            row = event_row(event)
            self.rows[row["citation_url"]] = row
        while len(self.rows) > MAX_IN_MEMORY:
            self.rows.pop(next(iter(self.rows)))
        return len(events)


class PostgresHazardEventRepo(HazardEventRepo):
    async def upsert_many(self, events: list[NormalizedEvent]) -> int:
        if not events:
            return 0
        # Duplicate citation URLs inside one batch would make ON CONFLICT touch a row twice.
        rows = list({row["citation_url"]: row for row in map(event_row, events)}.values())
        async with get_sessionmaker()() as session:
            await session.execute(UPSERT_SYNCED_EVENT, rows)
            await session.commit()
        return len(rows)


@lru_cache()
def get_hazard_event_repo() -> HazardEventRepo:
    return PostgresHazardEventRepo() if database_configured() else InMemoryHazardEventRepo()
