"""Wildfire score from FIRMS detections: weights, windows, coverage and honest no-data."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.config import get_settings
from app.repositories.fire_repo import InMemoryFireRepo, get_fire_repo
from app.services import wildfire_scoring as ws
from app.services.global_assessment import assess_location, load_fire_context

NOW = datetime(2026, 10, 2, 6, 0, tzinfo=timezone.utc)
BBOX = "116,4,127,22"  # a Philippines box
PH = (13.14, 123.74)   # near Legazpi


def fire(km, days, conf="h", frp=50.0):
    return ws.NearbyFire(km, NOW - timedelta(days=days), conf, frp)


def ctx(*fires, ingest_hours=1.0, history_days=20.0):
    return ws.FireContext(list(fires), NOW - timedelta(hours=ingest_hours), NOW - timedelta(days=history_days))


def assess(c, lat=PH[0], lng=PH[1], area=BBOX):
    return ws.assess_wildfire(c, lat, lng, area, NOW)


# ---- parsing
def test_parse_firms_row():
    row = {"latitude": "13.5", "longitude": "123.4", "acq_date": "2026-10-01", "acq_time": "537", "satellite": "N",
           "instrument": "VIIRS", "confidence": "n", "frp": "7.3", "daynight": "D"}
    d = ws.parse_firms_record(row)
    assert d.acq_at == datetime(2026, 10, 1, 5, 37, tzinfo=timezone.utc)
    assert (d.confidence, d.frp, d.daynight) == ("n", 7.3, "D")


@pytest.mark.parametrize("bad", [
    {}, {"latitude": "x", "longitude": "1", "acq_date": "2026-10-01", "acq_time": "0100"},
    {"latitude": "95", "longitude": "1", "acq_date": "2026-10-01", "acq_time": "0100"},
    {"latitude": "1", "longitude": "1", "acq_date": "nope", "acq_time": "0100"},
])
def test_unusable_rows_are_dropped(bad):
    assert ws.parse_firms_record(bad) is None


# ---- weights and bands
def test_confidence_and_frp_weights():
    assert [ws.confidence_weight(c) for c in ("l", "n", "h", "high", None)] == [0.3, 0.7, 1.0, 1.0, 0.5]
    assert ws.confidence_weight("85") == 0.85 and ws.confidence_weight("zzz") == 0.5
    assert ws.frp_weight(0) == 0.5 and ws.frp_weight(50) == 1.0 and ws.frp_weight(500) == 1.0 and ws.frp_weight(None) == 0.5


def test_recency_windows():
    assert ws.detection_weight("h", 50, 3) == 1.0
    assert ws.detection_weight("h", 50, 7) == 1.0
    assert ws.detection_weight("h", 50, 10) == pytest.approx(0.4)
    assert ws.detection_weight("h", 50, 31) == 0.0


def test_score_grows_with_detections_and_is_bounded():
    one = assess(ctx(fire(2, 1)))["score"]
    five = assess(ctx(*[fire(2, 1) for _ in range(5)]))["score"]
    twenty = assess(ctx(*[fire(2, 1) for _ in range(20)]))["score"]
    assert 10 <= one <= 20 < five < twenty <= 100
    assert twenty > 90


def test_old_low_confidence_weak_fires_count_for_less():
    strong = assess(ctx(fire(2, 1, "h", 60)))["score"]
    weak = assess(ctx(fire(2, 1, "l", 2)))["score"]
    old = assess(ctx(fire(2, 20, "h", 60)))["score"]
    assert weak < strong and old < strong


def test_evidence_counts_nearest_and_last_seen():
    r = assess(ctx(fire(3.2, 2), fire(1.4, 5), fire(8, 15), fire(12, 1), fire(2, 40)))
    assert (r["count_7d"], r["count_30d"], r["nearest_km"]) == (2, 3, 1.4)  # 12 km is outside the radius, 40 d outside the window
    assert r["last_seen"].startswith("2026-09-30")
    assert r["radius_km"] == 10.0


# ---- honest no-data
def test_no_context_is_unavailable_not_zero():
    r = assess(None)
    assert r["score"] is None and r["coverage_status"] == "unavailable"


def test_outside_the_ingested_area_is_out_of_coverage():
    r = assess(ctx(), lat=35.7, lng=139.7)
    assert r["score"] is None and r["coverage_status"] == "out_of_coverage" and r["reason_code"] == "outside_firms_area"


def test_stale_data_is_not_scored():
    r = assess(ctx(fire(1, 1), ingest_hours=72))
    assert r["score"] is None and r["coverage_status"] == "stale" and r["reason_code"] == "fire_data_stale"
    assert assess(ws.FireContext([], None, None))["reason_code"] == "fire_data_stale"  # nothing ever ingested


def test_no_detections_is_zero_only_with_enough_history():
    ok = assess(ctx(history_days=20))
    assert ok["score"] == 0 and ok["count_30d"] == 0 and ok["history_days"] == 20.0
    short = assess(ctx(history_days=2))
    assert short["score"] is None and short["reason_code"] == "fire_history_too_short"
    # a fire is a fire, even with a short history
    assert assess(ctx(fire(1, 0.5), history_days=1))["score"] > 0


def test_area_parsing():
    assert ws.firms_covers(0, 0, "world") and ws.firms_covers(0, 0, "")
    assert ws.firms_covers(13, 123, BBOX) and not ws.firms_covers(35, 139, BBOX)
    assert not ws.firms_covers(13, 123, "garbage")


def test_note_states_evidence_and_label():
    note = ws.wildfire_note(assess(ctx(fire(3.2, 2), fire(1.4, 5))))
    assert "2 detections within 10 km in the last 7 days" in note and "nearest 1.4 km" in note and "last seen 2026-09-30" in note
    assert "satellite-observed active fire, not an official hazard map" in note and "agricultural" in note
    none = ws.wildfire_note(assess(ctx()))
    assert none.startswith("No fire detections within 10 km")


# ---- repository and the assessment
def run(coro):
    return asyncio.run(coro)


def test_in_memory_repo_dedupes_prunes_and_filters():
    repo = InMemoryFireRepo()
    d = ws.FireDetection(13.14, 123.74, NOW - timedelta(days=1), "N", "h", 20.0, "D")
    far = ws.FireDetection(20.0, 100.0, NOW - timedelta(days=1), "N", "h", 20.0, "D")
    old = ws.FireDetection(13.14, 123.75, NOW - timedelta(days=60), "N", "h", 20.0, "D")
    run(repo.upsert_many([d, d, far, old]))  # the duplicate collapses, the 60 day row is pruned
    assert len(repo.rows) == 2
    context = run(repo.context(13.14, 123.74, 10.0, NOW - timedelta(days=30)))
    assert [round(f.distance_km, 1) for f in context.nearby] == [0.0]
    assert context.earliest_acq == d.acq_at and context.latest_ingest is not None
    assert run(InMemoryFireRepo().context(0, 0, 10.0, NOW)).latest_ingest is None


def test_assessment_scores_wildfire_from_stored_detections(monkeypatch):
    monkeypatch.setattr(get_settings(), "nasa_firms_area", BBOX)
    repo = get_fire_repo()
    now = datetime.now(timezone.utc)
    rows = [ws.FireDetection(13.15, 123.75, now - timedelta(hours=h), "N", "h", 30.0, "D") for h in (5, 30, 60)]
    rows.append(ws.FireDetection(13.0, 123.0, now - timedelta(days=12), "N", "n", 5.0, "N"))  # too far
    rows.append(ws.FireDetection(14.0, 121.0, now - timedelta(days=15), "N", "h", 5.0, "N"))  # history anchor, far away
    run(repo.upsert_many(rows))
    fire_ctx = run(load_fire_context(*PH))
    hazard = assess_location(*PH, "Legazpi", "PH", fire=fire_ctx)["hazards"]["wildfire"]
    assert hazard["score"] and hazard["coverage_status"] == "available" and hazard["reason_code"] == "satellite_active_fire"
    assert "3 detections within 10 km" in hazard["note"]
    assert "not an official hazard map" in hazard["note"]
    assert hazard["evidence"][0]["details"]["count_7d"] == 3
    summary = assess_location(*PH, "Legazpi", "PH", fire=fire_ctx)["multi_hazard_summary"]
    assert summary["components_available"] >= 2  # earthquake and wildfire (volcanic is off by default)


def test_assessment_without_fire_data_keeps_wildfire_no_data():
    for kwargs in ({}, {"fire": None}):
        hazard = assess_location(14.5995, 120.9842, "Manila", "PH", **kwargs)["hazards"]["wildfire"]
        assert hazard["score"] is None and "note" not in hazard
    far = ws.FireContext([], datetime.now(timezone.utc), datetime.now(timezone.utc) - timedelta(days=1))
    assert assess_location(14.5995, 120.9842, "Manila", "PH", fire=far)["hazards"]["wildfire"]["score"] is None  # history too short


def test_a_broken_store_never_breaks_the_assessment(monkeypatch):
    class Broken(InMemoryFireRepo):
        async def context(self, *a, **k):
            raise RuntimeError("relation fire_detections does not exist")

    monkeypatch.setattr("app.repositories.fire_repo.get_fire_repo", lambda: Broken())
    assert run(load_fire_context(*PH)) is None


def test_it_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "enable_wildfire_scoring", False)
    assert run(load_fire_context(*PH)) is None


def test_the_firms_sync_stores_detections_instead_of_dropping_them():
    from app.data_sources.sync.run_source_sync import _persist_events

    records = [
        {"latitude": "13.15", "longitude": "123.75", "acq_date": "2026-10-01", "acq_time": "0530", "satellite": "N",
         "instrument": "VIIRS", "confidence": "h", "frp": "12.5", "daynight": "D"},
        {"latitude": "13.15", "longitude": "123.75", "acq_date": "2026-10-01", "acq_time": "0530", "satellite": "N",
         "instrument": "VIIRS", "confidence": "h", "frp": "12.5", "daynight": "D"},  # a repeat from the overlapping download
        {"latitude": "bad", "longitude": "1", "acq_date": "2026-10-01", "acq_time": "0530"},
    ]
    run(_persist_events("nasa-firms", records))
    assert len(get_fire_repo().rows) == 1


def test_backfill_chunks_cover_the_window_exactly():
    import importlib.util
    from datetime import date
    from pathlib import Path

    spec = importlib.util.spec_from_file_location("backfill_firms", Path(__file__).parents[1] / "scripts" / "backfill_firms.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    pieces = mod.chunks(30, date(2026, 10, 2))
    assert [size for _, size in pieces] == [10, 10, 10]
    assert pieces[0][0] == date(2026, 9, 3) and pieces[-1][0] == date(2026, 9, 23)
    assert sum(size for _, size in mod.chunks(25, date(2026, 10, 2))) == 25
    assert mod.parse_csv("latitude,longitude\n1,2\n3,4\nbad")[0] == {"latitude": "1", "longitude": "2"}
