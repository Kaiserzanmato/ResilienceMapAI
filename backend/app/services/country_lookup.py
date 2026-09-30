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

# Natural Earth 110m omits many small states (e.g. Singapore falls inside Malaysia),
# so these approximate bounding boxes are checked, in order, BEFORE the polygon
# lookup. (code, west, south, east, north). Keep identical to SMALL_COUNTRY_BOXES in
# frontend/lib/locations/point-to-country.ts (a test enforces it). They are coarse
# rectangles: near a shared border they can claim a sliver of a neighbour.
SMALL_COUNTRY_BOXES: tuple[tuple[str, float, float, float, float], ...] = (
    ("SG", 103.6, 1.15, 104.05, 1.47),
    ("HK", 113.83, 22.15, 114.43, 22.5),
    ("MO", 113.52, 22.1, 113.6, 22.217),
    ("BH", 50.35, 25.65, 50.85, 26.35),
    ("MT", 14.17, 35.78, 14.6, 36.09),
    ("MV", 72.55, -0.8, 73.8, 7.15),
    ("LU", 5.73, 49.44, 6.53, 50.19),
    ("AD", 1.41, 42.43, 1.79, 42.66),
    ("MC", 7.4, 43.72, 7.44, 43.76),
    ("LI", 9.47, 47.05, 9.64, 47.27),
    ("SM", 12.4, 43.89, 12.52, 43.99),
    ("BN", 114.08, 4.0, 115.37, 5.05),
)

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
    for code, west, south, east, north in SMALL_COUNTRY_BOXES:
        if west <= lng <= east and south <= lat <= north:
            return code
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
