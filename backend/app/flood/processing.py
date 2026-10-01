"""Pure raster/vector functions for flood-extent capture.

Everything here works on in-memory arrays, so it is testable with synthetic
GeoTIFFs and no network. numpy/rasterio/shapely are imported at the top of this
module on purpose: nothing on the request path imports it (routes, repo and the
app start-up never do); only app/flood/capture.py and the worker's lazy imports
reach it, so the API still starts on a build that lacks the raster stack.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

METERS_PER_DEGREE = 111_320.0
MAX_AOI_KM2 = 100.0
DEFAULT_AOI_KM = 5.0
# Capture boxes are centred on a grid cell so two flags in the same cell share a
# tile_key and can reuse one processed extent (see worker cache hit).
SNAP_STEP_DEG = 0.025
MIN_WATER_AREA_M2 = 5_000.0  # 0.5 ha: smaller water specks are dropped
SAR_DB_CLAMP = (-23.0, -15.0)
SAR_DB_FALLBACK = -18.0
# Sentinel-2 SCL classes never trusted for water: no data, saturated, cloud
# shadow, cloud (medium/high), thin cirrus, snow/ice.
SCL_INVALID = (0, 1, 3, 8, 9, 10, 11)


class AreaTooLarge(ValueError):
    """The requested capture area exceeds MAX_AOI_KM2."""


@dataclass(frozen=True)
class Aoi:
    bbox: tuple[float, float, float, float]  # west, south, east, north (EPSG:4326)
    polygon: dict[str, Any]  # GeoJSON Polygon
    tile_key: str
    center: tuple[float, float]  # lat, lng of the snapped cell centre
    size_km: float

    @property
    def area_km2(self) -> float:
        return self.size_km * self.size_km


def snap_center(lat: float, lng: float, step: float = SNAP_STEP_DEG) -> tuple[float, float]:
    return round(round(lat / step) * step, 6), round(round(lng / step) * step, 6)


def aoi_from_point(lat: float, lng: float, size_km: float = DEFAULT_AOI_KM) -> Aoi:
    """Square capture box (default 5 km a side) around the grid cell holding the
    point. Raises AreaTooLarge above 100 km2 (a side above 10 km)."""
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("lat/lng out of range")
    if size_km <= 0:
        raise ValueError("size_km must be positive")
    if size_km * size_km > MAX_AOI_KM2:
        raise AreaTooLarge(f"capture area {size_km * size_km:.0f} km2 exceeds {MAX_AOI_KM2:.0f} km2")
    clat, clng = snap_center(lat, lng)
    half_m = size_km * 1000.0 / 2
    dlat = half_m / METERS_PER_DEGREE
    dlng = half_m / (METERS_PER_DEGREE * max(math.cos(math.radians(clat)), 0.01))
    west, east = max(-180.0, clng - dlng), min(180.0, clng + dlng)
    south, north = max(-90.0, clat - dlat), min(90.0, clat + dlat)
    ring = [[west, south], [east, south], [east, north], [west, north], [west, south]]
    return Aoi(
        bbox=(west, south, east, north),
        polygon={"type": "Polygon", "coordinates": [ring]},
        tile_key=f"{round(clat / SNAP_STEP_DEG)}_{round(clng / SNAP_STEP_DEG)}_{size_km:g}",
        center=(clat, clng),
        size_km=size_km,
    )


def pixel_area_m2(transform: Any, crs: Any, lat: float) -> float:
    """Ground area of one pixel. Sentinel COGs are in a metric UTM CRS; a
    geographic CRS is converted at the given latitude."""
    if crs is not None and getattr(crs, "is_projected", False):
        return abs(transform.a * transform.e)
    return (abs(transform.a) * METERS_PER_DEGREE * math.cos(math.radians(lat))) * (abs(transform.e) * METERS_PER_DEGREE)


def to_db(linear: np.ndarray) -> np.ndarray:
    """Linear backscatter power to dB; non-positive or non-finite becomes NaN."""
    lin = np.asarray(linear, dtype=np.float32)
    out = np.full(lin.shape, np.nan, dtype=np.float32)
    ok = np.isfinite(lin) & (lin > 0)
    out[ok] = 10.0 * np.log10(lin[ok])
    return out


def otsu_threshold(values: np.ndarray, lo: float = -35.0, hi: float = 5.0, bins: int = 256) -> float | None:
    """Otsu's threshold over a 1-D sample, or None when there is too little data
    or no separable classes (a flat histogram)."""
    vals = values[np.isfinite(values)]
    if vals.size < 100:
        return None
    hist, edges = np.histogram(np.clip(vals, lo, hi), bins=bins, range=(lo, hi))
    hist = hist.astype(np.float64)
    total = hist.sum()
    if total == 0 or np.count_nonzero(hist) < 2:
        return None
    centers = (edges[:-1] + edges[1:]) / 2
    weight_bg = np.cumsum(hist)
    weight_fg = total - weight_bg
    cum_mean = np.cumsum(hist * centers)
    with np.errstate(divide="ignore", invalid="ignore"):
        mean_bg = cum_mean / weight_bg
        mean_fg = (cum_mean[-1] - cum_mean) / weight_fg
        between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
    between = np.nan_to_num(between, nan=-1.0)
    if between.max() <= 0:
        return None
    return float(centers[int(np.argmax(between))])


def majority_filter_3x3(mask: np.ndarray) -> np.ndarray:
    """3x3 median of a boolean mask (a pixel stays water when at least 5 of its
    9 neighbours are). Built from nine shifted slices so memory stays at one
    small integer array."""
    padded = np.pad(mask.astype(np.uint8), 1, mode="edge")
    height, width = mask.shape
    total = np.zeros(mask.shape, dtype=np.uint8)
    for dy in range(3):
        for dx in range(3):
            total += padded[dy:dy + height, dx:dx + width]
    return total >= 5


def drop_small_regions(mask: np.ndarray, pixel_area: float, min_area_m2: float = MIN_WATER_AREA_M2) -> np.ndarray:
    """Remove water regions (and fill holes) smaller than min_area_m2 using
    GDAL's sieve filter, 8-connected."""
    from rasterio.features import sieve

    min_pixels = max(1, int(math.ceil(min_area_m2 / max(pixel_area, 1e-6))))
    if min_pixels <= 1 or not mask.any():
        return mask
    if min_pixels >= mask.size:  # sieve rejects this; no region can be that large
        return np.zeros_like(mask, dtype=bool)
    return sieve(mask.astype(np.uint8), size=min_pixels, connectivity=8).astype(bool)


def sar_water_mask(
    db: np.ndarray,
    valid: np.ndarray | None = None,
    pixel_area: float = 100.0,
    min_area_m2: float = MIN_WATER_AREA_M2,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Open water from Sentinel-1 VV backscatter in dB: pixels darker than an
    Otsu threshold clamped to -23..-15 dB (-18 dB when Otsu has nothing to
    separate), 3x3 median, specks under 0.5 ha dropped."""
    arr = np.asarray(db, dtype=np.float32)
    ok = np.isfinite(arr) if valid is None else (np.asarray(valid, dtype=bool) & np.isfinite(arr))
    otsu = otsu_threshold(arr[ok])
    if otsu is None:
        threshold, source = SAR_DB_FALLBACK, "fallback"
    else:
        threshold = float(np.clip(otsu, *SAR_DB_CLAMP))
        source = "otsu" if threshold == otsu else "otsu-clamped"
    mask = ok & (arr < threshold)
    mask = majority_filter_3x3(mask) & ok
    mask = drop_small_regions(mask, pixel_area, min_area_m2)
    return mask, {
        "algorithm": "sar-otsu-vv",
        "threshold_db": round(threshold, 2),
        "threshold_source": source,
        "otsu_db": None if otsu is None else round(otsu, 2),
        "valid_fraction": round(float(ok.mean()), 4) if ok.size else 0.0,
    }


def ndwi_water_mask(
    green: np.ndarray,
    nir: np.ndarray,
    scl: np.ndarray | None = None,
    pixel_area: float = 100.0,
    min_area_m2: float = MIN_WATER_AREA_M2,
    threshold: float = 0.0,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Open water from Sentinel-2 reflectance: NDWI = (G - NIR) / (G + NIR) above
    the threshold, with cloud, cloud shadow, cirrus, snow and no-data pixels
    (from the scene classification layer) excluded rather than called land."""
    g = np.asarray(green, dtype=np.float32)
    n = np.asarray(nir, dtype=np.float32)
    denom = g + n
    ok = np.isfinite(g) & np.isfinite(n) & (denom > 0)
    if scl is not None:
        ok &= ~np.isin(np.asarray(scl), SCL_INVALID)
    ndwi = np.full(g.shape, np.nan, dtype=np.float32)
    np.divide(g - n, denom, out=ndwi, where=ok)
    mask = ok & (ndwi > threshold)
    mask = majority_filter_3x3(mask) & ok
    mask = drop_small_regions(mask, pixel_area, min_area_m2)
    return mask, {
        "algorithm": "s2-ndwi-scl",
        "threshold": threshold,
        "valid_fraction": round(float(ok.mean()), 4) if ok.size else 0.0,
    }


def polygonize(
    mask: np.ndarray,
    transform: Any,
    crs: Any,
    pixel_area: float,
    simplify_m: float = 10.0,
) -> tuple[dict[str, Any] | None, float, int]:
    """Water mask to a valid GeoJSON MultiPolygon in EPSG:4326, simplified to
    about simplify_m metres. Returns (geometry or None, water_area_m2, polygons)."""
    from rasterio.features import shapes
    from rasterio.warp import transform_geom
    from shapely.geometry import MultiPolygon, Polygon, mapping, shape
    from shapely.ops import unary_union
    from shapely.validation import make_valid

    water_pixels = int(mask.sum())
    if water_pixels == 0:
        return None, 0.0, 0
    pieces = []
    for geom, value in shapes(mask.astype(np.uint8), mask=mask, transform=transform, connectivity=8):
        if value != 1:
            continue
        pieces.append(shape(transform_geom(crs, "EPSG:4326", geom, precision=7)))
    if not pieces:
        return None, 0.0, 0
    merged = make_valid(unary_union(pieces).simplify(simplify_m / METERS_PER_DEGREE, preserve_topology=True))
    parts: list[Polygon] = []
    for part in getattr(merged, "geoms", [merged]):
        if isinstance(part, Polygon) and not part.is_empty:
            parts.append(part)
        elif isinstance(part, MultiPolygon):
            parts.extend(p for p in part.geoms if not p.is_empty)
    if not parts:
        return None, 0.0, 0
    return mapping(MultiPolygon(parts)), water_pixels * pixel_area, len(parts)
