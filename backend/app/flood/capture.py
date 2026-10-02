"""Read a scene over an AOI and turn it into a flood extent.

Windowed reads from cloud-optimised GeoTIFFs only: just the pixels inside the
AOI are fetched, never the whole scene, and a window larger than
MAX_WINDOW_PIXELS is refused. That cap plus GDAL_CACHEMAX=64 keeps a capture well
inside the 512 MB of a free Render instance (a 10 km box is ~1M pixels, so a
float32 band is ~4 MB).

This module is only imported from the worker, inside the thread that runs a
capture, so the API never needs the raster stack to start.
"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .processing import (
    Aoi, ndwi_water_mask, pixel_area_m2, polygonize, sar_water_mask, to_db,
)
from .stac import S1_SOURCE, S2_SOURCE, SceneRef

logger = logging.getLogger(__name__)

MAX_WINDOW_PIXELS = 4_000_000
MIN_VALID_FRACTION = 0.2
READ_ATTEMPTS = 2  # a dropped connection mid-read is common over /vsicurl; retry once before failing the job
READ_RETRY_DELAY_S = 1.0

GDAL_OPTIONS = {
    "GDAL_CACHEMAX": 64,  # MB
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
    "GDAL_HTTP_MAX_RETRY": 3,
    "GDAL_HTTP_RETRY_DELAY": 1,
    "GDAL_HTTP_TIMEOUT": 30,
}


class NoUsableData(Exception):
    """The AOI has too little valid data in this scene (outside the swath, or cloud)."""


class ReadTooLarge(Exception):
    """The AOI window would exceed MAX_WINDOW_PIXELS."""


@dataclass
class ExtentResult:
    geometry: dict[str, Any] | None  # GeoJSON MultiPolygon in EPSG:4326, None when no water
    water_area_m2: float
    polygon_count: int
    method: dict[str, Any] = field(default_factory=dict)
    total_water_ha: float = 0.0  # all open water the satellite saw in the box
    flood_ha: float | None = None  # total minus permanent water; None = the filter did not run (unfiltered)


def _window(ds: Any, bbox: tuple[float, float, float, float]) -> Any:
    from rasterio.errors import WindowError
    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds

    left, bottom, right, top = transform_bounds("EPSG:4326", ds.crs, *bbox, densify_pts=21)
    raw = from_bounds(left, bottom, right, top, transform=ds.transform)
    col, row = math.floor(raw.col_off), math.floor(raw.row_off)
    window = Window(col, row, math.ceil(raw.col_off + raw.width) - col, math.ceil(raw.row_off + raw.height) - row)
    try:
        window = window.intersection(Window(0, 0, ds.width, ds.height))
    except WindowError:
        raise NoUsableData("AOI is outside the scene") from None
    if window.width < 1 or window.height < 1:
        raise NoUsableData("AOI is outside the scene")
    if window.width * window.height > MAX_WINDOW_PIXELS:
        raise ReadTooLarge(f"{int(window.width)}x{int(window.height)} px exceeds the read cap")
    return window


def read_window(href: str, bbox: tuple[float, float, float, float],
                out_shape: tuple[int, int] | None = None) -> tuple[np.ndarray, Any, Any]:
    """Read band 1 inside bbox as float32 (NaN where masked). Returns
    (array, window transform, crs). out_shape resamples (nearest) to a reference
    grid, used to bring the 20 m SCL layer onto the 10 m bands. A failed
    network read is retried once."""
    from rasterio.errors import RasterioIOError

    for attempt in range(READ_ATTEMPTS):
        try:
            return _read_window_once(href, bbox, out_shape)
        except RasterioIOError:
            if attempt == READ_ATTEMPTS - 1:
                raise
            time.sleep(READ_RETRY_DELAY_S)
    raise AssertionError("unreachable")


def _read_window_once(href: str, bbox: tuple[float, float, float, float],
                      out_shape: tuple[int, int] | None) -> tuple[np.ndarray, Any, Any]:
    import rasterio
    from affine import Affine
    from rasterio.enums import Resampling

    with rasterio.open(href) as ds:
        window = _window(ds, bbox)
        kwargs: dict[str, Any] = {"window": window, "masked": True}
        if out_shape is not None:
            kwargs.update(out_shape=out_shape, resampling=Resampling.nearest)
        data = ds.read(1, **kwargs)
        transform = ds.window_transform(window)
        if out_shape is not None:
            transform = transform @ Affine.scale(window.width / out_shape[1], window.height / out_shape[0])
        array = np.ma.filled(data.astype(np.float32), np.nan)
        return array, transform, ds.crs


def _load_occurrence(lat: float, lng: float, shape: tuple[int, int], transform: Any, crs: Any) -> np.ndarray:
    """JRC occurrence on the capture grid. Tests replace this."""
    from .permanent_water import find_occurrence_href, read_occurrence

    return read_occurrence(find_occurrence_href(lat, lng), shape, transform, crs)


def _filter_permanent(mask: np.ndarray, transform: Any, crs: Any, pixel_area: float,
                      aoi: Aoi) -> tuple[np.ndarray, dict[str, Any], float | None]:
    """Subtract JRC permanent water. Any failure fetching the layer keeps the
    unfiltered mask and says so (flood area None, status "unfiltered")."""
    from .permanent_water import JRC_SOURCE, apply_permanent_water, resolve_threshold

    threshold = resolve_threshold()
    try:
        occurrence = _load_occurrence(aoi.center[0], aoi.center[1], mask.shape, transform, crs)
        if not np.isfinite(occurrence).any():
            raise LookupError("JRC occurrence has no data over the capture box")
        flood, stats = apply_permanent_water(mask, occurrence, pixel_area, threshold)
    except Exception as exc:
        logger.warning("[flood] permanent-water filter skipped (%s); extent left unfiltered", type(exc).__name__)
        return mask, {"status": "unfiltered", "reason": type(exc).__name__, "source": JRC_SOURCE,
                      "threshold": threshold}, None
    return flood, {"status": "applied", "source": JRC_SOURCE, "threshold": threshold,
                   "excluded_ha": round(stats["permanent_excluded_m2"] / 10_000, 2)}, stats["flood_m2"]


def _finish(mask: np.ndarray, params: dict[str, Any], transform: Any, crs: Any, pixel_area: float,
            aoi: Aoi, scene: SceneRef) -> ExtentResult:
    if params["valid_fraction"] < MIN_VALID_FRACTION:
        raise NoUsableData(f"only {params['valid_fraction']:.0%} of the AOI has valid pixels")
    total_m2 = float(mask.sum()) * pixel_area
    mask, permanent, flood_m2 = _filter_permanent(mask, transform, crs, pixel_area, aoi)
    geometry, area_m2, polygons = polygonize(mask, transform, crs, pixel_area)
    params = {
        **params,
        "source": scene.source,
        "aoi_km": aoi.size_km,
        "window_px": [int(mask.shape[1]), int(mask.shape[0])],
        "pixel_area_m2": round(pixel_area, 2),
        "permanent_water": permanent,
    }
    return ExtentResult(
        geometry=geometry, water_area_m2=area_m2, polygon_count=polygons, method=params,
        total_water_ha=total_m2 / 10_000, flood_ha=None if flood_m2 is None else flood_m2 / 10_000,
    )


def capture_extent(scene: SceneRef, aoi: Aoi) -> ExtentResult:
    """Blocking: run in a worker thread. Raises NoUsableData / ReadTooLarge or the
    raster library's own errors; the worker maps those to closed reason codes."""
    import rasterio

    with rasterio.Env(**GDAL_OPTIONS):
        lat = aoi.center[0]
        if scene.source == S1_SOURCE:
            linear, transform, crs = read_window(scene.assets["vv"], aoi.bbox)
            pixel_area = pixel_area_m2(transform, crs, lat)
            mask, params = sar_water_mask(to_db(linear), pixel_area=pixel_area)
            return _finish(mask, params, transform, crs, pixel_area, aoi, scene)
        if scene.source == S2_SOURCE:
            green_dn, transform, crs = read_window(scene.assets["green"], aoi.bbox)
            nir_dn, _, _ = read_window(scene.assets["nir"], aoi.bbox, out_shape=green_dn.shape)
            scl, _, _ = read_window(scene.assets["scl"], aoi.bbox, out_shape=green_dn.shape)
            (g_scale, g_off), (n_scale, n_off) = scene.scale_offset["green"], scene.scale_offset["nir"]
            green = green_dn * g_scale + g_off
            nir = nir_dn * n_scale + n_off
            pixel_area = pixel_area_m2(transform, crs, lat)
            mask, params = ndwi_water_mask(green, nir, np.nan_to_num(scl, nan=0).astype(np.uint8), pixel_area=pixel_area)
            return _finish(mask, params, transform, crs, pixel_area, aoi, scene)
    raise ValueError(f"unsupported scene source {scene.source!r}")
