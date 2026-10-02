"""Volcanic score from distance to the nearest Philippine volcano.

The volcano list is NOT in this repository. The Smithsonian GVP list was considered and
rejected: its terms allow personal, educational and non-commercial use only and require
written permission for commercial use or publication, and this repository is public. The
loader therefore reads a file named by VOLCANO_DATA_FILE (expected: a PHIVOLCS-sourced
list whose terms allow this use) and, when that is unset, missing or invalid, the hazard
stays no-data. Scoring is also off by default (ENABLE_VOLCANIC_SCORING=false).

File format (JSON):
    {"source": {"name": "...", "url": "https://...", "retrieved": "YYYY-MM-DD", "licence_note": "..."},
     "volcanoes": [{"name": "...", "latitude": 13.257, "longitude": 123.685,
                    "status": "active" | "potentially active", "last_eruption_year": 2026 or null}]}

Scoring uses PHIVOLCS-danger-zone-style distance bands (a 6 km permanent danger zone, an
extended zone to 10 km, then ash/lahar exposure further out), not their legal boundaries,
which are set per volcano and per alert level. A potentially active volcano counts for half.
The result is a distance-to-volcano indicator, not a forecast: it says nothing about the
current alert level, which PHIVOLCS publishes only as bulletins (no reliable machine-readable
feed), so the row links to them.

Coverage is the Philippines only. Elsewhere the hazard stays no-data.
"""
from __future__ import annotations

import json
import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..config import get_settings

logger = logging.getLogger(__name__)

COVERAGE_COUNTRY = "PH"
STATUSES = ("active", "potentially active")

# (max distance km, score, label) for an active volcano; the first band that fits wins.
BANDS: tuple[tuple[float, int, str], ...] = (
    (6.0, 90, "within the 6 km permanent-danger-zone distance"),
    (10.0, 75, "within 10 km (extended danger zone distance)"),
    (30.0, 45, "within 30 km (ashfall, lahar and pyroclastic-flow exposure)"),
    (100.0, 15, "within 100 km (ashfall possible in a large eruption)"),
)
FAR_SCORE = 0  # in the Philippines but beyond the last band
POTENTIALLY_ACTIVE_FACTOR = 0.5
PHIVOLCS_URL = "https://www.phivolcs.dost.gov.ph/"
LABEL = "distance to the nearest volcano, not an official hazard map or a forecast"


def _validate(data: Any) -> dict[str, Any] | None:
    """The data if it has the expected shape, else None (never a half-valid list)."""
    try:
        source, rows = data["source"], data["volcanoes"]
        if not (source.get("name") and source.get("url")) or not rows:
            return None
        for v in rows:
            if (not v["name"] or v["status"] not in STATUSES or not -90 <= float(v["latitude"]) <= 90
                    or not -180 <= float(v["longitude"]) <= 180):
                return None
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    return data


@lru_cache
def _load(path: str) -> dict[str, Any] | None:
    try:
        with Path(path).open(encoding="utf-8") as file:
            data = _validate(json.load(file))
    except (OSError, ValueError):
        data = None
    if data is None:
        logger.warning("[volcano] VOLCANO_DATA_FILE is missing or invalid; Volcanic Activity stays no-data")
    return data


def volcano_data() -> dict[str, Any] | None:
    """The configured volcano list, or None when none is configured or it is invalid."""
    path = get_settings().volcano_data_file
    return _load(path) if path else None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(a))


def band_score(distance_km: float, status: str) -> tuple[int, str]:
    """Score and band label for one volcano at this distance."""
    factor = 1.0 if status == "active" else POTENTIALLY_ACTIVE_FACTOR
    for limit, score, label in BANDS:
        if distance_km <= limit:
            return round(score * factor), label
    return FAR_SCORE, "beyond 100 km"


def nearest_volcanoes(lat: float, lng: float, volcanoes: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """All volcanoes with distance, nearest first."""
    if volcanoes is None:
        data = volcano_data()
        volcanoes = data["volcanoes"] if data else []
    rows = volcanoes
    out = [{**v, "distance_km": haversine_km(lat, lng, v["latitude"], v["longitude"])} for v in rows]
    return sorted(out, key=lambda v: v["distance_km"])


def score_volcano(lat: float, lng: float, country_code: str | None,
                  volcanoes: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    """The score and its evidence, or None when the point is outside coverage
    (not in the Philippines): the caller keeps the hazard as no-data."""
    if (country_code or "").upper() != COVERAGE_COUNTRY:
        return None
    ranked = nearest_volcanoes(lat, lng, volcanoes)
    if not ranked:
        return None
    # The driving volcano is the one with the highest band score, ties to the nearer.
    scored = [(band_score(v["distance_km"], v["status"]), v) for v in ranked]
    (score, band), driver = max(scored, key=lambda item: (item[0][0], -item[1]["distance_km"]))
    nearest = ranked[0]
    nearest_active = next((v for v in ranked if v["status"] == "active"), None)
    return {
        "score": score,
        "band": band,
        "driver": driver,
        "nearest": nearest,
        "nearest_active": nearest_active,
        "volcanoes_in_30km": [v["name"] for v in ranked if v["distance_km"] <= 30.0],
    }


def volcano_note(result: dict[str, Any]) -> str:
    d = result["driver"]
    status = "an active" if d["status"] == "active" else "a potentially active"
    last = f", last eruption {d['last_eruption_year']}" if d.get("last_eruption_year") is not None else ", no dated eruption"
    nearby = result["volcanoes_in_30km"]
    extra = f" Also within 30 km: {', '.join(n for n in nearby if n != d['name'])}." if len(nearby) > 1 else ""
    return (
        f"{d['name']} is {status} volcano {d['distance_km']:.1f} km away{last}; {result['band']}.{extra} "
        f"Scored from {LABEL}. The current PHIVOLCS alert level is not live here: see PHIVOLCS volcano bulletins."
    )
