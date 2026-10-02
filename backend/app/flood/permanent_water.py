"""Permanent-water filter for flood extents.

A satellite water mask cannot tell a flood from a river, lake or fishpond that is
always there. The JRC Global Surface Water *occurrence* layer (30 m, 1984-2021)
gives, per pixel, the percentage of valid observations that saw water; pixels at
or above a threshold (default 75%) are treated as permanent and subtracted.

The occurrence COG comes from the Planetary Computer `jrc-gsw` collection (the
catalog the Sentinel-1 search already uses, so no new dependency). Everything
here is blocking and raster-stack only: it is imported lazily from capture.py.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from ..config import get_settings
from .processing import drop_small_regions

JRC_COLLECTION = "jrc-gsw"
JRC_ASSET = "occurrence"
JRC_SOURCE = "jrc-gsw-occurrence"
DEFAULT_THRESHOLD = 75.0
OCCURRENCE_MAX = 100  # JRC uses 255 (and anything above 100) for no data


def resolve_threshold(value: float | None = None) -> float:
    """The configured threshold, or the default when unset or outside 1..100."""
    raw = get_settings().flood_permanent_water_threshold if value is None else value
    return float(raw) if 1.0 <= raw <= 100.0 else DEFAULT_THRESHOLD


def permanent_mask(occurrence: np.ndarray, threshold: float) -> np.ndarray:
    """True where the occurrence is a valid value at or above the threshold."""
    occ = np.asarray(occurrence, dtype=np.float32)
    return np.isfinite(occ) & (occ <= OCCURRENCE_MAX) & (occ >= threshold)


def apply_permanent_water(
    mask: np.ndarray,
    occurrence: np.ndarray,
    pixel_area: float,
    threshold: float,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Subtract permanent water from a water mask on the same grid. Slivers the
    subtraction leaves along a river bank (under 0.5 ha) are dropped like any
    other water speck. Returns (flood mask, stats in m2)."""
    permanent = permanent_mask(occurrence, threshold)
    flood = drop_small_regions(mask & ~permanent, pixel_area)
    total_m2 = float(mask.sum()) * pixel_area
    flood_m2 = float(flood.sum()) * pixel_area
    return flood, {
        "total_water_m2": total_m2,
        "flood_m2": flood_m2,
        "permanent_excluded_m2": float((mask & permanent).sum()) * pixel_area,
    }


def find_occurrence_href(lat: float, lng: float) -> str:
    """Signed href of the JRC occurrence tile covering the point."""
    import planetary_computer
    from pystac_client import Client

    from .stac import PC_STAC_URL

    catalog = Client.open(PC_STAC_URL, modifier=planetary_computer.sign_inplace)
    items = list(catalog.search(collections=[JRC_COLLECTION],
                                intersects={"type": "Point", "coordinates": [lng, lat]}, max_items=1).items())
    if not items or JRC_ASSET not in items[0].assets:
        raise LookupError("no JRC occurrence tile covers this point")
    return items[0].assets[JRC_ASSET].href


def read_occurrence(href: str, shape: tuple[int, int], transform: Any, crs: Any) -> np.ndarray:
    """Occurrence resampled (nearest) onto the capture grid, i.e. clipped to the
    capture box. NaN where JRC has no data."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.errors import WindowError
    from rasterio.transform import array_bounds
    from rasterio.warp import reproject, transform_bounds
    from rasterio.windows import Window, from_bounds

    height, width = shape
    with rasterio.open(href) as ds:
        west, south, east, north = transform_bounds(crs, ds.crs, *array_bounds(height, width, transform), densify_pts=21)
        raw = from_bounds(west, south, east, north, transform=ds.transform)
        # pad a pixel so nearest resampling at the box edge always has a source pixel
        col, row = int(raw.col_off // 1) - 1, int(raw.row_off // 1) - 1
        win = Window(col, row, int(raw.width // 1) + 3, int(raw.height // 1) + 3)
        try:
            win = win.intersection(Window(0, 0, ds.width, ds.height))
        except WindowError:
            return np.full(shape, np.nan, dtype=np.float32)
        src = ds.read(1, window=win, masked=True)
        src_arr = np.ma.filled(src.astype(np.float32), np.nan)
        src_transform = ds.window_transform(win)
        out = np.full(shape, np.nan, dtype=np.float32)
        reproject(src_arr, out, src_transform=src_transform, src_crs=ds.crs, src_nodata=np.nan,
                  dst_transform=transform, dst_crs=crs, dst_nodata=np.nan, resampling=Resampling.nearest)
    return out
