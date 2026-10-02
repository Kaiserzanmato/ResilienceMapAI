"""Flood worker: serialisation, leases, retries, cache hits. Stubbed scenes and
captures, in-memory repo, no network."""
import asyncio
import threading
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.flood import worker
from app.flood.capture import NoUsableData, ReadTooLarge
from app.flood.reasons import REASON_LABELS
from app.flood.stac import SceneRef
from app.repositories.flood_repo import get_flood_repo

SQUARE = {"type": "MultiPolygon", "coordinates": [[[[120.8, 14.9], [120.9, 14.9], [120.9, 14.95], [120.8, 14.95], [120.8, 14.9]]]]}
NOW = datetime(2026, 9, 29, tzinfo=timezone.utc)


def _scene(scene_id="S1A_TEST", source="s1-rtc-pc"):
    return SceneRef(source, scene_id, NOW, {"vv": "x"})


def _ok(*_args):
    return SimpleNamespace(geometry=SQUARE, water_area_m2=100_000.0, polygon_count=1, method={"algorithm": "stub"},
                           total_water_ha=10.0, flood_ha=10.0)


@pytest.fixture
def stubs(monkeypatch):
    state = SimpleNamespace(scenes=[_scene()], capture=_ok, calls=[])

    def find(lat, lng, days):
        if isinstance(state.scenes, Exception):
            raise state.scenes
        return state.scenes

    def capture(scene, aoi):
        state.calls.append((scene.scene_id, aoi.tile_key))
        return state.capture(scene, aoi)

    monkeypatch.setattr(worker, "_find_scenes", find)
    monkeypatch.setattr(worker, "_capture", capture)
    return state


async def _job(lat=14.93, lng=120.85):
    repo = get_flood_repo()
    flag = await repo.create_flag(lat, lng, None, None, "hash")
    return await repo.create_job(flag["id"])


async def _claim(job_id=None):
    s = get_settings()
    return await get_flood_repo().claim_job(job_id=job_id, lease_seconds=s.flood_lease_seconds,
                                            max_attempts=s.flood_max_attempts)


# ------------------------------------------------------- one at a time

async def test_captures_run_one_at_a_time(stubs):
    active, peak, lock = 0, 0, threading.Lock()

    def slow(scene, aoi):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05)
        with lock:
            active -= 1
        return _ok()

    stubs.capture = slow
    jobs = [await _claim((await _job(lat=10.0 + i, lng=100.0 + i))["id"]) for i in range(4)]
    results = await asyncio.gather(*(worker.process_claimed_job(j) for j in jobs))
    assert [r["status"] for r in results] == ["done"] * 4
    assert peak == 1 and len(stubs.calls) == 4


# ------------------------------------------------------------ leases

async def test_a_live_lease_is_not_reclaimed_but_an_expired_one_is(stubs):
    repo = get_flood_repo()
    job = await _job()
    first = await _claim(job["id"])
    assert first["attempts"] == 1 and repo.jobs[job["id"]]["status"] == "running"
    assert await _claim() is None                       # lease still live: someone is working on it
    repo.jobs[job["id"]]["lease_until"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    again = await _claim()
    assert again["id"] == job["id"] and again["attempts"] == 2


async def test_a_job_whose_lease_expired_with_no_attempts_left_is_failed(stubs):
    repo = get_flood_repo()
    job = await _job()
    repo.jobs[job["id"]].update(status="running", attempts=3,
                                lease_until=datetime.now(timezone.utc) - timedelta(seconds=1))
    assert await _claim() is None
    assert await repo.fail_exhausted(3) == 1
    assert repo.jobs[job["id"]]["status"] == "failed" and repo.jobs[job["id"]]["reason_code"] == "lease_expired"


async def test_drain_reclaims_a_job_orphaned_by_a_dead_instance(stubs):
    repo = get_flood_repo()
    job = await _job()
    repo.jobs[job["id"]].update(status="running", attempts=1,
                                lease_until=datetime.now(timezone.utc) - timedelta(minutes=10))
    summary = await worker.drain_queue(budget_s=5)
    assert summary["processed"] == 1 and repo.jobs[job["id"]]["status"] == "done"
    assert repo.jobs[job["id"]]["attempts"] == 2


# ----------------------------------------------------- attempts limit

async def test_three_failed_attempts_then_failed_with_a_closed_reason_code(stubs):
    def boom(scene, aoi):
        raise OSError("HTTP 403 for https://blob.example/vv.tif?sig=SECRET-SAS-TOKEN")

    stubs.capture = boom
    repo = get_flood_repo()
    job = await _job()
    statuses = []
    for _ in range(3):
        claimed = await _claim(job["id"])
        statuses.append((await worker.process_claimed_job(claimed))["status"])
        repo.jobs[job["id"]]["lease_until"] = None      # skip the retry delay
    assert statuses == ["queued", "queued", "failed"]
    final = repo.jobs[job["id"]]
    assert final["attempts"] == 3 and final["reason_code"] == "raster_read_failed"
    assert final["reason_code"] in REASON_LABELS
    assert "SECRET" not in str(final) and "blob.example" not in str(final)
    assert await _claim() is None                        # nothing left to claim


async def test_a_failed_attempt_is_not_retried_straight_away(stubs):
    stubs.capture = lambda scene, aoi: (_ for _ in ()).throw(OSError("flaky"))
    job = await _job()
    await worker.process_claimed_job(await _claim(job["id"]))
    assert await _claim() is None                        # backing off
    summary = await worker.drain_queue(budget_s=5)
    assert summary["processed"] == 0                     # one drain cannot burn every attempt


async def test_a_permanent_failure_is_not_retried(stubs):
    def too_big(scene, aoi):
        raise ReadTooLarge("5000x5000 px exceeds the read cap")

    stubs.capture = too_big
    job = await _job()
    result = await worker.process_claimed_job(await _claim(job["id"]))
    assert result == {"job_id": job["id"], "status": "failed", "reason_code": "read_too_large"}
    assert get_flood_repo().jobs[job["id"]]["attempts"] == 1


async def test_a_catalog_search_failure_is_retried_with_its_own_reason(stubs):
    stubs.scenes = RuntimeError("catalog down")
    job = await _job()
    result = await worker.process_claimed_job(await _claim(job["id"]))
    assert result["status"] == "queued" and result["reason_code"] == "scene_search_failed"


async def test_a_job_whose_flag_vanished_fails_permanently(stubs):
    job = await _job()
    del get_flood_repo().flags[job["flag_id"]]
    result = await worker.process_claimed_job(await _claim(job["id"]))
    assert result["reason_code"] == "flag_missing" and result["status"] == "failed"


# -------------------------------------------------------- cache hit

async def test_a_second_flag_in_the_same_cell_reuses_the_extent(stubs):
    first = await _job(lat=14.930, lng=120.850)
    second = await _job(lat=14.934, lng=120.846)         # same 0.025 degree cell, same scene
    r1 = await worker.process_claimed_job(await _claim(first["id"]))
    r2 = await worker.process_claimed_job(await _claim(second["id"]))
    assert r1["status"] == r2["status"] == "done" and r1["cache_hit"] is False and r2["cache_hit"] is True
    assert r1["extent_id"] == r2["extent_id"] and len(stubs.calls) == 1
    assert len(get_flood_repo().extents) == 1


async def test_a_newer_scene_over_the_same_cell_is_processed_again(stubs):
    await worker.process_claimed_job(await _claim((await _job())["id"]))
    stubs.scenes = [_scene("S1A_NEWER")]
    result = await worker.process_claimed_job(await _claim((await _job())["id"]))
    assert result["cache_hit"] is False and len(stubs.calls) == 2 and len(get_flood_repo().extents) == 2


# ------------------------------------------------------ scene outcomes

async def test_no_scene_in_the_window_is_a_clean_outcome_not_a_failure(stubs):
    stubs.scenes = []
    job = await _job()
    result = await worker.process_claimed_job(await _claim(job["id"]))
    assert result["status"] == "no_scene" and result["reason_code"] == "no_recent_scene"
    assert get_flood_repo().jobs[job["id"]]["attempts"] == 1


async def test_an_unusable_first_scene_falls_through_to_the_next(stubs):
    stubs.scenes = [_scene("S1_PARTIAL"), _scene("S2_CLEAR", "s2-l2a-e84")]

    def pick(scene, aoi):
        if scene.scene_id == "S1_PARTIAL":
            raise NoUsableData("only 3% of the AOI has valid pixels")
        return _ok()

    stubs.capture = pick
    result = await worker.process_claimed_job(await _claim((await _job())["id"]))
    assert result["status"] == "done"
    assert [c[0] for c in stubs.calls] == ["S1_PARTIAL", "S2_CLEAR"]
    extent = next(iter(get_flood_repo().extents.values()))
    assert extent["scene_id"] == "S2_CLEAR" and extent["source"] == "s2-l2a-e84"


async def test_all_scenes_unusable_ends_as_no_scene(stubs):
    def nothing(scene, aoi):
        raise NoUsableData("cloud")

    stubs.capture = nothing
    result = await worker.process_claimed_job(await _claim((await _job())["id"]))
    assert result["status"] == "no_scene" and result["reason_code"] == "no_usable_scene"


# ------------------------------------------------------------ drain

async def test_drain_stops_at_max_jobs_and_at_the_budget(stubs):
    for i in range(5):
        await _job(lat=10.0 + i, lng=100.0 + i)
    assert (await worker.drain_queue(budget_s=5, max_jobs=2))["processed"] == 2
    assert (await worker.drain_queue(budget_s=0, max_jobs=20))["processed"] == 0
    rest = await worker.drain_queue(budget_s=5, max_jobs=20)
    assert rest["processed"] == 3 and rest["by_status"] == {"done": 3}


async def test_run_job_now_never_raises_even_if_the_repo_breaks(monkeypatch):
    def broken():
        raise RuntimeError("db down")

    monkeypatch.setattr(worker, "get_flood_repo", broken)
    await worker.run_job_now(1)  # must not raise: a background task failure would be silent anyway


async def test_an_extent_without_flood_ha_is_recaptured_not_reused(stubs):
    """A pre-0007 extent, or one whose JRC fetch failed, has flood_ha NULL: the next
    flag in the same cell re-runs the capture so it can pick up the filter."""
    stubs.capture = lambda *_a: SimpleNamespace(
        geometry=SQUARE, water_area_m2=100_000.0, polygon_count=1, method={}, total_water_ha=10.0, flood_ha=None)
    first = await _job(lat=14.930, lng=120.850)
    second = await _job(lat=14.934, lng=120.846)
    r1 = await worker.process_claimed_job(await _claim(first["id"]))
    stubs.capture = _ok  # JRC is back
    r2 = await worker.process_claimed_job(await _claim(second["id"]))
    assert r1["cache_hit"] is False and r2["cache_hit"] is False and len(stubs.calls) == 2
    assert r1["extent_id"] == r2["extent_id"]  # upserted in place
    assert (await get_flood_repo().find_extent("s1-rtc-pc", "S1A_TEST", stubs.calls[0][1]))["flood_ha"] == 10.0
