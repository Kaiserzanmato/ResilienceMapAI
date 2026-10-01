"""Persistence for flood auto-capture: user flags, satellite-derived extents and
the capture job queue. Postgres (raw SQL, PostGIS) when DATABASE_URL is set,
otherwise an in-memory store with the same behaviour, so tests and local dev
need no database. Same pattern as hazard_event_repo.

Jobs live in the database, not in process memory, because the free Render
instance sleeps: a job claimed by an instance that then dies keeps a lease and
is reclaimed once the lease expires (see claim_job).
"""
from __future__ import annotations

import itertools
import json
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

from sqlalchemy import text

from ..db import database_configured, get_sessionmaker

MAX_FEATURES = 500
Bbox = tuple[float, float, float, float]  # west, south, east, north


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Any) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


def _coords_bbox(geometry: dict[str, Any]) -> Bbox:
    xs: list[float] = []
    ys: list[float] = []

    def walk(node: Any) -> None:
        if node and isinstance(node[0], (int, float)):
            xs.append(node[0])
            ys.append(node[1])
        else:
            for child in node:
                walk(child)

    walk(geometry["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def _intersects(box: Bbox, other: Bbox | None) -> bool:
    if other is None:
        return True
    return not (box[2] < other[0] or box[0] > other[2] or box[3] < other[1] or box[1] > other[3])


def extent_summary(extent: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": extent["id"], "source": extent["source"], "scene_id": extent["scene_id"],
        "acquired_at": _iso(extent["acquired_at"]), "water_area_m2": extent["water_area_m2"],
    }


class FloodRepo(ABC):
    @abstractmethod
    async def create_flag(self, lat: float, lng: float, note: str | None, observed_at: datetime | None,
                          client_hash: str) -> dict[str, Any]: ...

    @abstractmethod
    async def count_recent_flags(self, client_hash: str, within_seconds: int = 3600) -> int: ...

    @abstractmethod
    async def get_flag(self, flag_id: int) -> dict[str, Any] | None: ...

    @abstractmethod
    async def create_job(self, flag_id: int) -> dict[str, Any]: ...

    @abstractmethod
    async def get_job(self, job_id: int) -> dict[str, Any] | None:
        """The job with an `extent` summary (or None) once it has captured one."""

    @abstractmethod
    async def claim_job(self, *, job_id: int | None = None, lease_seconds: int = 300,
                        max_attempts: int = 3) -> dict[str, Any] | None:
        """Atomically take one claimable job (queued and past its retry delay, or
        running with an expired lease) and lease it. Never returns a job that has
        used max_attempts."""

    @abstractmethod
    async def fail_exhausted(self, max_attempts: int = 3) -> int:
        """Mark jobs whose last lease expired with no attempts left as failed."""

    @abstractmethod
    async def retry_or_fail_job(self, job_id: int, reason_code: str, max_attempts: int = 3,
                                retry_delay_seconds: int = 60) -> str:
        """Re-queue after a failed attempt (not claimable again for retry_delay_seconds,
        so one drain cannot burn every attempt back to back), or fail it once
        attempts are used up."""

    @abstractmethod
    async def finish_job(self, job_id: int, status: str, extent_id: int | None = None,
                         reason_code: str | None = None) -> None: ...

    @abstractmethod
    async def find_extent(self, source: str, scene_id: str, tile_key: str) -> dict[str, Any] | None: ...

    @abstractmethod
    async def save_extent(self, *, source: str, scene_id: str, acquired_at: datetime, tile_key: str,
                          aoi: dict[str, Any], geom: dict[str, Any] | None, water_area_m2: float,
                          method: dict[str, Any], source_tier: int = 3) -> int: ...

    @abstractmethod
    async def list_extents(self, bbox: Bbox | None, since: datetime | None,
                           limit: int = MAX_FEATURES) -> tuple[list[dict[str, Any]], bool]:
        """GeoJSON features (newest first) and whether more existed than `limit`."""

    @abstractmethod
    async def extents_version(self) -> str: ...

    @abstractmethod
    async def list_flags(self, bbox: Bbox | None, limit: int = MAX_FEATURES) -> tuple[list[dict[str, Any]], bool]: ...

    @abstractmethod
    async def tile(self, z: int, x: int, y: int) -> bytes | None:
        """A Mapbox vector tile of the extents, or None when unsupported."""


class InMemoryFloodRepo(FloodRepo):
    def __init__(self) -> None:
        self.flags: dict[int, dict[str, Any]] = {}
        self.jobs: dict[int, dict[str, Any]] = {}
        self.extents: dict[int, dict[str, Any]] = {}
        self._flag_ids = itertools.count(1)
        self._job_ids = itertools.count(1)
        self._extent_ids = itertools.count(1)

    def clear(self) -> None:
        for store in (self.flags, self.jobs, self.extents):
            store.clear()
        self._flag_ids = itertools.count(1)
        self._job_ids = itertools.count(1)
        self._extent_ids = itertools.count(1)

    async def create_flag(self, lat, lng, note, observed_at, client_hash):
        flag = {"id": next(self._flag_ids), "lat": lat, "lng": lng, "note": note, "observed_at": observed_at,
                "client_hash": client_hash, "status": "open", "review_status": "unreviewed", "created_at": _now()}
        self.flags[flag["id"]] = flag
        return dict(flag)

    async def count_recent_flags(self, client_hash, within_seconds=3600):
        cutoff = _now() - timedelta(seconds=within_seconds)
        return sum(1 for f in self.flags.values() if f["client_hash"] == client_hash and f["created_at"] > cutoff)

    async def get_flag(self, flag_id):
        flag = self.flags.get(flag_id)
        return dict(flag) if flag else None

    async def create_job(self, flag_id):
        job = {"id": next(self._job_ids), "flag_id": flag_id, "status": "queued", "attempts": 0,
               "lease_until": None, "reason_code": None, "extent_id": None,
               "created_at": _now(), "updated_at": _now()}
        self.jobs[job["id"]] = job
        return dict(job)

    async def get_job(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            return None
        extent = self.extents.get(job["extent_id"]) if job["extent_id"] else None
        return {**job, "extent": extent_summary(extent) if extent else None}

    async def claim_job(self, *, job_id=None, lease_seconds=300, max_attempts=3):
        now = _now()
        for job in sorted(self.jobs.values(), key=lambda j: (j["created_at"], j["id"])):
            if job_id is not None and job["id"] != job_id:
                continue
            delayed = job["lease_until"] is not None and job["lease_until"] >= now
            claimable = (job["status"] == "queued" and not delayed) or (
                job["status"] == "running" and job["lease_until"] is not None and job["lease_until"] < now)
            if claimable and job["attempts"] < max_attempts:
                job.update(status="running", attempts=job["attempts"] + 1,
                           lease_until=now + timedelta(seconds=lease_seconds), updated_at=now)
                return dict(job)
        return None

    async def fail_exhausted(self, max_attempts=3):
        now = _now()
        count = 0
        for job in self.jobs.values():
            if (job["status"] == "running" and job["lease_until"] is not None
                    and job["lease_until"] < now and job["attempts"] >= max_attempts):
                job.update(status="failed", reason_code="lease_expired", lease_until=None, updated_at=now)
                count += 1
        return count

    async def retry_or_fail_job(self, job_id, reason_code, max_attempts=3, retry_delay_seconds=60):
        job = self.jobs[job_id]
        failed = job["attempts"] >= max_attempts
        job.update(status="failed" if failed else "queued", reason_code=reason_code, updated_at=_now(),
                   lease_until=None if failed else _now() + timedelta(seconds=retry_delay_seconds))
        return job["status"]

    async def finish_job(self, job_id, status, extent_id=None, reason_code=None):
        self.jobs[job_id].update(status=status, extent_id=extent_id, reason_code=reason_code,
                                 lease_until=None, updated_at=_now())

    async def find_extent(self, source, scene_id, tile_key):
        for extent in self.extents.values():
            if (extent["source"], extent["scene_id"], extent["tile_key"]) == (source, scene_id, tile_key):
                return dict(extent)
        return None

    async def save_extent(self, *, source, scene_id, acquired_at, tile_key, aoi, geom, water_area_m2,
                          method, source_tier=3):
        existing = await self.find_extent(source, scene_id, tile_key)
        extent_id = existing["id"] if existing else next(self._extent_ids)
        self.extents[extent_id] = {
            "id": extent_id, "source": source, "scene_id": scene_id, "acquired_at": acquired_at,
            "tile_key": tile_key, "aoi": aoi, "geom": geom, "water_area_m2": water_area_m2,
            "method": method, "source_tier": source_tier, "processed_at": _now(),
        }
        return extent_id

    async def list_extents(self, bbox, since, limit=MAX_FEATURES):
        rows = [e for e in self.extents.values()
                if e["geom"] is not None
                and _intersects(_coords_bbox(e["geom"]), bbox)
                and (since is None or e["acquired_at"] >= since)]
        rows.sort(key=lambda e: (e["acquired_at"], e["id"]), reverse=True)
        features = [{
            "type": "Feature", "geometry": e["geom"],
            "properties": {**extent_summary(e), "source_tier": e["source_tier"], "method": e["method"]},
        } for e in rows[:limit]]
        return features, len(rows) > limit

    async def extents_version(self):
        newest = max((e["processed_at"] for e in self.extents.values()), default=None)
        return f"{_iso(newest) or '0'}:{len(self.extents)}"

    async def list_flags(self, bbox, limit=MAX_FEATURES):
        rows = [f for f in self.flags.values() if f["review_status"] != "rejected"
                and _intersects((f["lng"], f["lat"], f["lng"], f["lat"]), bbox)]
        rows.sort(key=lambda f: (f["created_at"], f["id"]), reverse=True)
        features = [{
            "type": "Feature", "geometry": {"type": "Point", "coordinates": [f["lng"], f["lat"]]},
            "properties": {"id": f["id"], "observed_at": _iso(f["observed_at"]),
                           "created_at": _iso(f["created_at"]), "status": f["status"],
                           "review_status": f["review_status"]},
        } for f in rows[:limit]]
        return features, len(rows) > limit

    async def tile(self, z, x, y):
        return None


class PostgresFloodRepo(FloodRepo):
    async def _one(self, sql: str, **params: Any) -> dict[str, Any] | None:
        async with get_sessionmaker()() as session:
            row = (await session.execute(text(sql), params)).mappings().first()
            await session.commit()
            return dict(row) if row else None

    async def create_flag(self, lat, lng, note, observed_at, client_hash):
        return await self._one("""
            INSERT INTO flood_flags (geom, note, observed_at, client_hash)
            VALUES (ST_SetSRID(ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8)), 4326), :note, :observed_at, :client_hash)
            RETURNING id, status, review_status, created_at, CAST(:lat AS float8) AS lat, CAST(:lng AS float8) AS lng
        """, lat=lat, lng=lng, note=note, observed_at=observed_at, client_hash=client_hash)

    async def count_recent_flags(self, client_hash, within_seconds=3600):
        row = await self._one("""
            SELECT count(*) AS n FROM flood_flags
            WHERE client_hash = :client_hash AND created_at > now() - make_interval(secs => CAST(:secs AS float8))
        """, client_hash=client_hash, secs=within_seconds)
        return int(row["n"]) if row else 0

    async def get_flag(self, flag_id):
        return await self._one("""
            SELECT id, ST_Y(geom) AS lat, ST_X(geom) AS lng, note, observed_at, status, review_status, created_at
            FROM flood_flags WHERE id = :id
        """, id=flag_id)

    async def create_job(self, flag_id):
        return await self._one("""
            INSERT INTO flood_capture_jobs (flag_id) VALUES (:flag_id)
            RETURNING id, flag_id, status, attempts, lease_until, reason_code, extent_id, created_at, updated_at
        """, flag_id=flag_id)

    async def get_job(self, job_id):
        row = await self._one("""
            SELECT j.id, j.flag_id, j.status, j.attempts, j.reason_code, j.extent_id, j.created_at, j.updated_at,
                   e.source AS e_source, e.scene_id AS e_scene_id, e.acquired_at AS e_acquired_at,
                   e.water_area_m2 AS e_water_area_m2
            FROM flood_capture_jobs j LEFT JOIN flood_extents e ON e.id = j.extent_id
            WHERE j.id = :id
        """, id=job_id)
        if not row:
            return None
        extent = None
        if row["extent_id"] is not None:
            extent = {"id": row["extent_id"], "source": row["e_source"], "scene_id": row["e_scene_id"],
                      "acquired_at": _iso(row["e_acquired_at"]), "water_area_m2": row["e_water_area_m2"]}
        for key in ("e_source", "e_scene_id", "e_acquired_at", "e_water_area_m2"):
            row.pop(key)
        return {**row, "extent": extent}

    async def claim_job(self, *, job_id=None, lease_seconds=300, max_attempts=3):
        # FOR UPDATE SKIP LOCKED lets concurrent workers (cron + an inline run on
        # another instance) each take a different job and never the same one.
        return await self._one("""
            WITH next AS (
                SELECT id FROM flood_capture_jobs
                WHERE (CAST(:job_id AS bigint) IS NULL OR id = CAST(:job_id AS bigint))
                  AND attempts < :max_attempts
                  AND ((status = 'queued' AND (lease_until IS NULL OR lease_until < now()))
                       OR (status = 'running' AND lease_until < now()))
                ORDER BY created_at, id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE flood_capture_jobs j
               SET status = 'running', attempts = j.attempts + 1,
                   lease_until = now() + make_interval(secs => CAST(:lease AS float8)), updated_at = now()
              FROM next WHERE j.id = next.id
            RETURNING j.id, j.flag_id, j.attempts
        """, job_id=job_id, lease=lease_seconds, max_attempts=max_attempts)

    async def fail_exhausted(self, max_attempts=3):
        async with get_sessionmaker()() as session:
            result = await session.execute(text("""
                UPDATE flood_capture_jobs
                   SET status = 'failed', reason_code = 'lease_expired', lease_until = NULL, updated_at = now()
                 WHERE status = 'running' AND lease_until < now() AND attempts >= :max_attempts
            """), {"max_attempts": max_attempts})
            await session.commit()
            return result.rowcount or 0

    async def retry_or_fail_job(self, job_id, reason_code, max_attempts=3, retry_delay_seconds=60):
        # On a retry, lease_until doubles as "not claimable before" (see claim_job).
        row = await self._one("""
            UPDATE flood_capture_jobs
               SET status = CASE WHEN attempts >= :max_attempts THEN 'failed' ELSE 'queued' END,
                   reason_code = :reason, updated_at = now(),
                   lease_until = CASE WHEN attempts >= :max_attempts THEN NULL
                                      ELSE now() + make_interval(secs => CAST(:delay AS float8)) END
             WHERE id = :id RETURNING status
        """, id=job_id, reason=reason_code, max_attempts=max_attempts, delay=retry_delay_seconds)
        return row["status"] if row else "failed"

    async def finish_job(self, job_id, status, extent_id=None, reason_code=None):
        await self._one("""
            UPDATE flood_capture_jobs
               SET status = :status, extent_id = :extent_id, reason_code = :reason,
                   lease_until = NULL, updated_at = now()
             WHERE id = :id RETURNING id
        """, id=job_id, status=status, extent_id=extent_id, reason=reason_code)

    async def find_extent(self, source, scene_id, tile_key):
        return await self._one("""
            SELECT id, source, scene_id, acquired_at, tile_key, water_area_m2, source_tier
            FROM flood_extents WHERE source = :source AND scene_id = :scene_id AND tile_key = :tile_key
        """, source=source, scene_id=scene_id, tile_key=tile_key)

    async def save_extent(self, *, source, scene_id, acquired_at, tile_key, aoi, geom, water_area_m2,
                          method, source_tier=3):
        row = await self._one("""
            INSERT INTO flood_extents (source, scene_id, acquired_at, tile_key, aoi, geom, water_area_m2, method, source_tier)
            VALUES (:source, :scene_id, :acquired_at, :tile_key,
                    ST_SetSRID(ST_GeomFromGeoJSON(:aoi), 4326),
                    CASE WHEN CAST(:geom AS text) IS NULL THEN NULL
                         ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)) END,
                    :water_area_m2, CAST(:method AS jsonb), :source_tier)
            ON CONFLICT (source, scene_id, tile_key) DO UPDATE SET
                geom = EXCLUDED.geom, water_area_m2 = EXCLUDED.water_area_m2,
                method = EXCLUDED.method, processed_at = now()
            RETURNING id
        """, source=source, scene_id=scene_id, acquired_at=acquired_at, tile_key=tile_key,
            aoi=json.dumps(aoi), geom=json.dumps(geom) if geom else None, water_area_m2=water_area_m2,
            method=json.dumps(method), source_tier=source_tier)
        return int(row["id"])

    async def list_extents(self, bbox, since, limit=MAX_FEATURES):
        where, params = ["e.geom IS NOT NULL"], {"limit": limit + 1}
        if bbox:
            where.append("e.geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)")
            params.update(w=bbox[0], s=bbox[1], e=bbox[2], n=bbox[3])
        if since:
            where.append("e.acquired_at >= :since")
            params["since"] = since
        async with get_sessionmaker()() as session:
            rows = (await session.execute(text(f"""
                SELECT e.id, e.source, e.scene_id, e.acquired_at, e.water_area_m2, e.source_tier, e.method,
                       ST_AsGeoJSON(e.geom, 6) AS geom
                FROM flood_extents e WHERE {' AND '.join(where)}
                ORDER BY e.acquired_at DESC, e.id DESC LIMIT :limit
            """), params)).mappings().all()
        features = [{
            "type": "Feature", "geometry": json.loads(r["geom"]),
            "properties": {**extent_summary(r), "source_tier": r["source_tier"], "method": r["method"]},
        } for r in rows[:limit]]
        return features, len(rows) > limit

    async def extents_version(self):
        row = await self._one("SELECT COALESCE(max(processed_at)::text, '0') AS newest, count(*) AS n FROM flood_extents")
        return f"{row['newest']}:{row['n']}" if row else "0:0"

    async def list_flags(self, bbox, limit=MAX_FEATURES):
        where, params = ["review_status <> 'rejected'"], {"limit": limit + 1}
        if bbox:
            where.append("geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)")
            params.update(w=bbox[0], s=bbox[1], e=bbox[2], n=bbox[3])
        async with get_sessionmaker()() as session:
            rows = (await session.execute(text(f"""
                SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat, observed_at, created_at, status, review_status
                FROM flood_flags WHERE {' AND '.join(where)}
                ORDER BY created_at DESC, id DESC LIMIT :limit
            """), params)).mappings().all()
        features = [{
            "type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
            "properties": {"id": r["id"], "observed_at": _iso(r["observed_at"]), "created_at": _iso(r["created_at"]),
                           "status": r["status"], "review_status": r["review_status"]},
        } for r in rows[:limit]]
        return features, len(rows) > limit

    async def tile(self, z, x, y):
        async with get_sessionmaker()() as session:
            data = (await session.execute(text("""
                WITH bounds AS (SELECT ST_TileEnvelope(:z, :x, :y) AS env),
                mvt AS (
                    SELECT e.id, e.source, e.scene_id, e.acquired_at::text AS acquired_at, e.water_area_m2,
                           ST_AsMVTGeom(ST_Transform(e.geom, 3857), bounds.env, 4096, 64, true) AS geom
                    FROM flood_extents e, bounds
                    WHERE e.geom IS NOT NULL AND e.geom && ST_Transform(bounds.env, 4326)
                    ORDER BY e.acquired_at DESC LIMIT 500
                )
                SELECT ST_AsMVT(mvt.*, 'flood_extents', 4096, 'geom') FROM mvt WHERE geom IS NOT NULL
            """), {"z": z, "x": x, "y": y})).scalar()
        return bytes(data) if data else b""


@lru_cache()
def get_flood_repo() -> FloodRepo:
    return PostgresFloodRepo() if database_configured() else InMemoryFloodRepo()
