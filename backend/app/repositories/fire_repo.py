"""Persistence for FIRMS active-fire detections. Postgres (`fire_detections`, a
geography point with a GiST index, queried with ST_DWithin) when DATABASE_URL is set,
otherwise an in-memory store with the same behaviour, so tests and local dev need no
database. Same pattern as flood_repo / hazard_event_repo.

Upserts on (source, acq_at, latitude, longitude), so the 6-hourly sync, which downloads
overlapping days, never duplicates a detection. Rows older than RETENTION_DAYS are pruned.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Iterable

from sqlalchemy import text

from ..db import database_configured, get_sessionmaker
from ..services.volcano_scoring import haversine_km
from ..services.wildfire_scoring import RETENTION_DAYS, FireContext, FireDetection, NearbyFire

MAX_NEARBY = 2000  # a cap on rows pulled for one point; a 10 km circle never needs more


def _now() -> datetime:
    return datetime.now(timezone.utc)


class FireRepo(ABC):
    @abstractmethod
    async def upsert_many(self, detections: Iterable[FireDetection]) -> int:
        """Store detections; returns how many were given. Also prunes old rows."""

    @abstractmethod
    async def context(self, lat: float, lng: float, radius_km: float, since: datetime) -> FireContext:
        """Detections within radius_km and at or after `since`, plus the table's span."""


class InMemoryFireRepo(FireRepo):
    def __init__(self) -> None:
        self.rows: dict[tuple, tuple[FireDetection, datetime]] = {}

    def clear(self) -> None:
        self.rows.clear()

    async def upsert_many(self, detections):
        now = _now()
        count = 0
        for d in detections:
            self.rows[(d.source, d.acq_at, d.latitude, d.longitude)] = (d, now)
            count += 1
        cutoff = now - timedelta(days=RETENTION_DAYS)
        for key in [k for k in self.rows if k[1] < cutoff]:
            del self.rows[key]
        return count

    async def context(self, lat, lng, radius_km, since):
        nearby = [
            NearbyFire(dist, d.acq_at, d.confidence, d.frp)
            for d, _ in self.rows.values()
            if d.acq_at >= since and (dist := haversine_km(lat, lng, d.latitude, d.longitude)) <= radius_km
        ]
        latest = max((ingested for _, ingested in self.rows.values()), default=None)
        earliest = min((d.acq_at for d, _ in self.rows.values()), default=None)
        return FireContext(sorted(nearby, key=lambda f: f.distance_km)[:MAX_NEARBY], latest, earliest)


UPSERT = text("""
    INSERT INTO fire_detections (source, latitude, longitude, geog, acq_at, satellite, instrument, confidence, frp, daynight)
    VALUES (:source, :lat, :lng, ST_SetSRID(ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)), 4326)::geography,
            :acq_at, :satellite, :instrument, :confidence, :frp, :daynight)
    ON CONFLICT (source, acq_at, latitude, longitude) DO UPDATE SET
        confidence = EXCLUDED.confidence, frp = EXCLUDED.frp, ingested_at = now()
""")

NEARBY = text("""
    SELECT ST_Distance(geog, ST_SetSRID(ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)), 4326)::geography) / 1000.0 AS distance_km,
           acq_at, confidence, frp
    FROM fire_detections
    WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)), 4326)::geography, :radius_m)
      AND acq_at >= :since
    ORDER BY distance_km
    LIMIT :limit
""")

SPAN = text("SELECT max(ingested_at) AS latest, min(acq_at) AS earliest FROM fire_detections")
PRUNE = text("DELETE FROM fire_detections WHERE acq_at < :cutoff")


class PostgresFireRepo(FireRepo):
    async def upsert_many(self, detections):
        rows = [{"source": d.source, "lat": d.latitude, "lng": d.longitude, "acq_at": d.acq_at, "satellite": d.satellite,
                 "instrument": d.instrument, "confidence": d.confidence, "frp": d.frp, "daynight": d.daynight}
                for d in detections]
        async with get_sessionmaker()() as session:
            for start in range(0, len(rows), 1000):  # batches keep each statement list modest
                await session.execute(UPSERT, rows[start:start + 1000])
            await session.execute(PRUNE, {"cutoff": _now() - timedelta(days=RETENTION_DAYS)})
            await session.commit()
        return len(rows)

    async def context(self, lat, lng, radius_km, since):
        async with get_sessionmaker()() as session:
            rows = (await session.execute(NEARBY, {"lat": lat, "lng": lng, "radius_m": radius_km * 1000.0,
                                                   "since": since, "limit": MAX_NEARBY})).mappings().all()
            span = (await session.execute(SPAN)).mappings().one()
        nearby = [NearbyFire(float(r["distance_km"]), r["acq_at"], r["confidence"], r["frp"]) for r in rows]
        return FireContext(nearby, span["latest"], span["earliest"])


@lru_cache()
def get_fire_repo() -> FireRepo:
    return PostgresFireRepo() if database_configured() else InMemoryFireRepo()
