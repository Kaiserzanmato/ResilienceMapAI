"""Resolve an ISO alpha-2 country code from a coordinate, server-side.

Uses the bundled Natural Earth 110m boundaries (see
backend/scripts/build_country_boundaries.py). The 110m coastline is coarse, so a
point just off the drawn coast falls back to the nearest boundary vertex within
COAST_TOLERANCE_DEG; anything farther (open ocean) resolves to None.
"""
import json
from functools import lru_cache
from pathlib import Path

BOUNDARIES_PATH = Path(__file__).parents[1] / "data" / "country_boundaries.json"
COAST_TOLERANCE_DEG = 0.35

Ring = list[list[float]]


@lru_cache
def _boundaries() -> dict[str, list[dict]]:
    with BOUNDARIES_PATH.open(encoding="utf-8") as file:
        raw = json.load(file)
    prepared: dict[str, list[dict]] = {}
    for code, polygons in raw.items():
        prepared[code] = []
        for rings in polygons:
            xs = [p[0] for p in rings[0]]
            ys = [p[1] for p in rings[0]]
            prepared[code].append({"rings": rings, "bbox": (min(xs), min(ys), max(xs), max(ys))})
    return prepared


def _in_ring(lng: float, lat: float, ring: Ring) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def country_for_point(lat: float, lng: float) -> str | None:
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    boundaries = _boundaries()
    for code, polygons in boundaries.items():
        for polygon in polygons:
            min_x, min_y, max_x, max_y = polygon["bbox"]
            if not (min_x <= lng <= max_x and min_y <= lat <= max_y):
                continue
            outer, *holes = polygon["rings"]
            if _in_ring(lng, lat, outer) and not any(_in_ring(lng, lat, hole) for hole in holes):
                return code
    best_code, best_distance = None, COAST_TOLERANCE_DEG ** 2
    for code, polygons in boundaries.items():
        for polygon in polygons:
            min_x, min_y, max_x, max_y = polygon["bbox"]
            if not (min_x - COAST_TOLERANCE_DEG <= lng <= max_x + COAST_TOLERANCE_DEG
                    and min_y - COAST_TOLERANCE_DEG <= lat <= max_y + COAST_TOLERANCE_DEG):
                continue
            for x, y in polygon["rings"][0]:
                distance = (x - lng) ** 2 + (y - lat) ** 2
                if distance < best_distance:
                    best_code, best_distance = code, distance
    return best_code
