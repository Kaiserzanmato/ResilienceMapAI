"""Flood-capture worker: claims jobs from the database and processes them one
at a time.

* One capture at a time per process (a Semaphore(1)) because a capture reads
  imagery into memory and the free Render instance has 512 MB.
* Blocking raster/STAC work runs in asyncio.to_thread so the event loop (and
  the API) stays responsive while a capture runs.
* Jobs are claimed with FOR UPDATE SKIP LOCKED and a lease, so an instance that
  sleeps or dies mid-job loses the lease and the job is picked up again by the
  next drain (the cron endpoint) or by another instance. At most
  FLOOD_MAX_ATTEMPTS attempts; then the job is failed with a reason code.
* A scene already processed for the same source + scene id + AOI cell is reused
  (cache hit) instead of being read again.

The raster stack is imported lazily, inside the thread that needs it.
"""
from __future__ import annotations

import asyncio
import logging
import time
import weakref
from typing import Any

from ..config import get_settings
from ..repositories.flood_repo import FloodRepo, get_flood_repo
from .reasons import PERMANENT, classify
from .stac import SceneRef

logger = logging.getLogger(__name__)

_semaphores: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = weakref.WeakKeyDictionary()


def _semaphore() -> asyncio.Semaphore:
    """The process-wide capture lock (one per event loop, so a fresh loop in a
    test never inherits a semaphore bound to a closed one)."""
    loop = asyncio.get_running_loop()
    sem = _semaphores.get(loop)
    if sem is None:
        sem = _semaphores[loop] = asyncio.Semaphore(1)
    return sem


# --- blocking helpers, run in threads; tests replace these -----------------

def _make_aoi(lat: float, lng: float, size_km: float) -> Any:
    from .processing import aoi_from_point

    return aoi_from_point(lat, lng, size_km)


def _find_scenes(lat: float, lng: float, days: int) -> list[SceneRef]:
    from .stac import find_scenes

    return find_scenes(lat, lng, days)


def _capture(scene: SceneRef, aoi: Any) -> Any:
    from .capture import capture_extent

    return capture_extent(scene, aoi)


class _Stage(Exception):
    """Carries the stage (search or capture) a failure happened in."""

    def __init__(self, stage: str, cause: BaseException) -> None:
        super().__init__(stage)
        self.stage = stage
        self.cause = cause


async def _run(job: dict[str, Any], repo: FloodRepo) -> dict[str, Any]:
    settings = get_settings()
    flag = await repo.get_flag(job["flag_id"])
    if flag is None:
        await repo.finish_job(job["id"], "failed", reason_code="flag_missing")
        return {"job_id": job["id"], "status": "failed", "reason_code": "flag_missing"}

    lat, lng = float(flag["lat"]), float(flag["lng"])
    try:
        aoi = await asyncio.to_thread(_make_aoi, lat, lng, settings.flood_aoi_km)
    except Exception as exc:
        raise _Stage("capture", exc) from exc
    try:
        scenes = await asyncio.to_thread(_find_scenes, lat, lng, settings.flood_scene_window_days)
    except Exception as exc:
        raise _Stage("search", exc) from exc
    if not scenes:
        await repo.finish_job(job["id"], "no_scene", reason_code="no_recent_scene")
        return {"job_id": job["id"], "status": "no_scene", "reason_code": "no_recent_scene"}

    for scene in scenes:
        cached = await repo.find_extent(scene.source, scene.scene_id, aoi.tile_key)
        # An extent without a flood_ha predates the permanent-water filter or could
        # not fetch JRC; it is recaptured (and upserted) rather than reused.
        if cached and cached.get("flood_ha") is not None:
            await repo.finish_job(job["id"], "done", extent_id=cached["id"])
            return {"job_id": job["id"], "status": "done", "extent_id": cached["id"], "cache_hit": True}
        try:
            result = await asyncio.to_thread(_capture, scene, aoi)
        except Exception as exc:
            if type(exc).__name__ == "NoUsableData":
                logger.info("[flood] job=%s scene=%s unusable, trying the next scene", job["id"], scene.scene_id)
                continue
            raise _Stage("capture", exc) from exc
        extent_id = await repo.save_extent(
            source=scene.source, scene_id=scene.scene_id, acquired_at=scene.acquired_at, tile_key=aoi.tile_key,
            aoi=aoi.polygon, geom=result.geometry, water_area_m2=result.water_area_m2, method=result.method,
            total_water_ha=result.total_water_ha, flood_ha=result.flood_ha,
        )
        await repo.finish_job(job["id"], "done", extent_id=extent_id)
        return {"job_id": job["id"], "status": "done", "extent_id": extent_id, "cache_hit": False,
                "water_area_m2": result.water_area_m2, "polygon_count": result.polygon_count}

    await repo.finish_job(job["id"], "no_scene", reason_code="no_usable_scene")
    return {"job_id": job["id"], "status": "no_scene", "reason_code": "no_usable_scene"}


async def process_claimed_job(job: dict[str, Any], repo: FloodRepo | None = None) -> dict[str, Any]:
    """Process one already-claimed job. Never raises: a failure is recorded on
    the job as a closed reason code (the raw exception goes to the server log
    only) and the job is re-queued or failed."""
    repo = repo or get_flood_repo()
    settings = get_settings()
    async with _semaphore():
        try:
            return await _run(job, repo)
        except Exception as exc:
            stage = exc.stage if isinstance(exc, _Stage) else "capture"
            cause = exc.cause if isinstance(exc, _Stage) else exc
            reason = classify(cause, stage)
            logger.warning("[flood] job=%s attempt=%s failed (%s): %s", job["id"], job.get("attempts"), reason,
                           type(cause).__name__)
            if reason in PERMANENT:
                await repo.finish_job(job["id"], "failed", reason_code=reason)
                status = "failed"
            else:
                status = await repo.retry_or_fail_job(job["id"], reason, settings.flood_max_attempts)
            return {"job_id": job["id"], "status": status, "reason_code": reason}


async def run_job_now(job_id: int) -> None:
    """Best-effort immediate run for a freshly created job (a FastAPI background
    task). If it cannot claim the job, or the instance is stopped first, the
    job simply stays queued for the next drain."""
    try:
        repo = get_flood_repo()
        settings = get_settings()
        job = await repo.claim_job(job_id=job_id, lease_seconds=settings.flood_lease_seconds,
                                   max_attempts=settings.flood_max_attempts)
        if job:
            await process_claimed_job(job, repo)
    except Exception as exc:
        logger.warning("[flood] inline run for job=%s did not finish: %s", job_id, type(exc).__name__)


async def drain_queue(budget_s: float | None = None, max_jobs: int = 20) -> dict[str, Any]:
    """Process unfinished jobs until the time budget or max_jobs is reached.
    Called by the cron endpoint. Jobs run one after another; the budget is
    checked before each claim, so a drain overruns by at most one job."""
    settings = get_settings()
    repo = get_flood_repo()
    budget = settings.flood_cron_budget_seconds if budget_s is None else budget_s
    deadline = time.monotonic() + budget
    exhausted = await repo.fail_exhausted(settings.flood_max_attempts)
    outcomes: list[dict[str, Any]] = []
    while len(outcomes) < max_jobs and time.monotonic() < deadline:
        job = await repo.claim_job(lease_seconds=settings.flood_lease_seconds,
                                   max_attempts=settings.flood_max_attempts)
        if job is None:
            break
        outcomes.append(await process_claimed_job(job, repo))
    counts: dict[str, int] = {}
    for outcome in outcomes:
        counts[outcome["status"]] = counts.get(outcome["status"], 0) + 1
    return {"processed": len(outcomes), "by_status": counts, "expired_failed": exhausted}
