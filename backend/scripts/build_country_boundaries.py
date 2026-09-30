"""Build backend/app/data/country_boundaries.json from the frontend's Natural Earth 110m TopoJSON.

Run from the repo root:  python backend/scripts/build_country_boundaries.py
The output maps ISO alpha-2 codes to polygon rings so the API can resolve a
country server-side without extra dependencies.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOPO = ROOT / "frontend" / "components" / "globe" / "countries-110m.json"
REGISTRY = ROOT / "frontend" / "lib" / "locations" / "country-registry.ts"
OUT = ROOT / "backend" / "app" / "data" / "country_boundaries.json"


def decode_arcs(topology: dict) -> list[list[tuple[float, float]]]:
    sx, sy = topology["transform"]["scale"]
    tx, ty = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((round(x * sx + tx, 3), round(y * sy + ty, 3)))
        arcs.append(points)
    return arcs


def ring_points(arcs: list, indexes: list[int]) -> list[tuple[float, float]]:
    ring: list[tuple[float, float]] = []
    for index in indexes:
        points = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
        ring.extend(points[1:] if ring else points)
    return ring


def main() -> None:
    topology = json.loads(TOPO.read_text(encoding="utf-8"))
    numeric_to_alpha2 = {
        numeric: alpha2
        for alpha2, numeric in re.findall(r'alpha2: "(\w\w)", alpha3: "\w+", numeric: "(\d+)"', REGISTRY.read_text(encoding="utf-8"))
    }
    arcs = decode_arcs(topology)
    countries: dict[str, list] = {}
    for geometry in topology["objects"]["countries"]["geometries"]:
        alpha2 = numeric_to_alpha2.get(str(geometry.get("id", "")).zfill(3))
        if not alpha2:
            continue
        polygons = geometry["arcs"] if geometry["type"] == "MultiPolygon" else [geometry["arcs"]]
        countries.setdefault(alpha2, []).extend(
            [[ring_points(arcs, ring) for ring in polygon] for polygon in polygons]
        )
    OUT.write_text(json.dumps(countries, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({len(countries)} countries, {OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
