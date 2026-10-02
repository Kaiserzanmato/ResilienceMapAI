"""Wildfire score from NASA FIRMS (VIIRS) active-fire detections near a point.

Pure functions; the detections come from app/repositories/fire_repo.py. A detection
within RADIUS_KM counts with weight
    recency x confidence x FRP
where recency is 1.0 for the last 7 days and 0.4 for days 8 to 30, confidence is
VIIRS l/n/h = 0.3/0.7/1.0 (a 0-100 number is divided by 100; unknown 0.5), and the FRP
(fire radiative power, MW) weight is 0.5 + 0.5 x min(1, FRP / 50). The weights add up
to `raw`, and score = 100 x (1 - exp(-raw / 6)): one strong recent detection is Low
(about 15), a handful is Medium, a dozen or more is High.

This is satellite-observed active fire, not a wildfire hazard map: FIRMS also sees
agricultural and prescribed burning, and a detection is a hot pixel, not an
assessed risk. Honest no-data: the row is scored only when the point is inside the
area FIRMS is ingested for, the data is fresh, and, for a zero, when there is at
least MIN_HISTORY_DAYS of history (otherwise "no detections" would just mean "we
have not been looking long enough").
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

RADIUS_KM = 10.0
RECENT_DAYS = 7
WINDOW_DAYS = 30
OLDER_WEIGHT = 0.4
SCORE_SCALE = 6.0
FRP_FULL_MW = 50.0
MIN_HISTORY_DAYS = 7
MAX_DATA_AGE_HOURS = 48  # newest ingest older than this = stale
RETENTION_DAYS = WINDOW_DAYS + 5
LABEL = "satellite-observed active fire, not an official hazard map"
_CONFIDENCE = {"l": 0.3, "low": 0.3, "n": 0.7, "nominal": 0.7, "h": 1.0, "high": 1.0}


@dataclass(frozen=True)
class FireDetection:
    latitude: float
    longitude: float
    acq_at: datetime
    satellite: str
    confidence: str | None
    frp: float | None
    daynight: str | None
    instrument: str | None = None
    source: str = "VIIRS_SNPP_NRT"


def _float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def parse_firms_record(record: dict[str, Any]) -> FireDetection | None:
    """One FIRMS CSV row (as the connector returns it) to a detection, or None when
    it has no usable position or time. acq_time is HHMM in UTC."""
    lat, lng = _float(record.get("latitude")), _float(record.get("longitude"))
    if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    date, time = str(record.get("acq_date") or "").strip(), str(record.get("acq_time") or "").strip().zfill(4)
    try:
        acq_at = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    confidence = (str(record.get("confidence") or "").strip().lower() or None)
    return FireDetection(
        latitude=lat, longitude=lng, acq_at=acq_at, satellite=str(record.get("satellite") or "N").strip() or "N",
        confidence=confidence, frp=_float(record.get("frp")), daynight=(str(record.get("daynight") or "").strip() or None),
        instrument=(str(record.get("instrument") or "").strip() or None),
    )


def confidence_weight(confidence: str | None) -> float:
    if confidence is None:
        return 0.5
    if confidence in _CONFIDENCE:
        return _CONFIDENCE[confidence]
    number = _float(confidence)
    return min(1.0, max(0.0, number / 100.0)) if number is not None else 0.5


def frp_weight(frp: float | None) -> float:
    if frp is None or frp < 0:
        return 0.5
    return 0.5 + 0.5 * min(1.0, frp / FRP_FULL_MW)


def detection_weight(confidence: str | None, frp: float | None, age_days: float) -> float:
    if age_days > WINDOW_DAYS:
        return 0.0
    recency = 1.0 if age_days <= RECENT_DAYS else OLDER_WEIGHT
    return recency * confidence_weight(confidence) * frp_weight(frp)


def score_from_weight(raw: float) -> int:
    return round(100 * (1 - math.exp(-max(0.0, raw) / SCORE_SCALE)))


@dataclass(frozen=True)
class NearbyFire:
    """A detection already filtered to the search radius, with its distance."""
    distance_km: float
    acq_at: datetime
    confidence: str | None
    frp: float | None


@dataclass(frozen=True)
class FireContext:
    """What the repository knows: detections near the point and the data's own span."""
    nearby: list[NearbyFire]
    latest_ingest: datetime | None  # when the newest row was stored
    earliest_acq: datetime | None   # oldest detection in the table (history start)


def firms_covers(lat: float, lng: float, area: str) -> bool:
    """Whether the configured NASA_FIRMS_AREA ('world' or 'west,south,east,north') includes the point."""
    area = (area or "").strip().lower()
    if area in ("", "world"):
        return True
    try:
        west, south, east, north = (float(part) for part in area.split(","))
    except ValueError:
        return False
    return south <= lat <= north and (west <= lng <= east if west <= east else (lng >= west or lng <= east))


def assess_wildfire(ctx: FireContext | None, lat: float, lng: float, area: str,
                    now: datetime | None = None) -> dict[str, Any]:
    """Score and evidence, or a no-data result with a closed coverage_status and reason_code.
    Keys: score (int|None), coverage_status, reason_code, and, when scored, evidence fields."""
    now = now or datetime.now(timezone.utc)
    if ctx is None:
        return {"score": None, "coverage_status": "unavailable", "reason_code": "fire_data_unavailable"}
    if not firms_covers(lat, lng, area):
        return {"score": None, "coverage_status": "out_of_coverage", "reason_code": "outside_firms_area"}
    if ctx.latest_ingest is None or now - ctx.latest_ingest > timedelta(hours=MAX_DATA_AGE_HOURS):
        return {"score": None, "coverage_status": "stale", "reason_code": "fire_data_stale"}

    weighted, count_7, count_30, nearest, last_seen = 0.0, 0, 0, None, None
    for fire in ctx.nearby:
        age = (now - fire.acq_at).total_seconds() / 86_400
        if age < 0 or age > WINDOW_DAYS or fire.distance_km > RADIUS_KM:
            continue
        weighted += detection_weight(fire.confidence, fire.frp, age)
        count_30 += 1
        count_7 += age <= RECENT_DAYS
        nearest = fire.distance_km if nearest is None else min(nearest, fire.distance_km)
        last_seen = fire.acq_at if last_seen is None else max(last_seen, fire.acq_at)

    history_days = None if ctx.earliest_acq is None else max(0.0, (now - ctx.earliest_acq).total_seconds() / 86_400)
    evidence = {
        "radius_km": RADIUS_KM, "count_7d": count_7, "count_30d": count_30,
        "nearest_km": None if nearest is None else round(nearest, 1),
        "last_seen": None if last_seen is None else last_seen.isoformat(),
        "history_days": None if history_days is None else round(history_days, 1),
    }
    if count_30 == 0 and (history_days is None or history_days < MIN_HISTORY_DAYS):
        return {"score": None, "coverage_status": "stale", "reason_code": "fire_history_too_short", **evidence}
    return {"score": score_from_weight(weighted), "coverage_status": "available", "reason_code": "satellite_active_fire", **evidence}


def wildfire_note(result: dict[str, Any]) -> str:
    r = int(result["radius_km"])
    if result["count_30d"] == 0:
        return (f"No fire detections within {r} km in the last {WINDOW_DAYS} days "
                f"(detection history: {result['history_days']:.0f} days). Scored from {LABEL}.")
    last = (result["last_seen"] or "")[:10]
    return (f"{result['count_7d']} detection{'s' if result['count_7d'] != 1 else ''} within {r} km in the last {RECENT_DAYS} days, "
            f"{result['count_30d']} in {WINDOW_DAYS}; nearest {result['nearest_km']} km, last seen {last}. "
            f"Includes agricultural burning. Scored from {LABEL}.")
