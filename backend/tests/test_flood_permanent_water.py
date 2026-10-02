"""Permanent-water filter: synthetic rasters with known permanent water, no network."""
import numpy as np
import pytest
from affine import Affine
from rasterio.crs import CRS

from app.config import get_settings
from app.flood import capture, permanent_water
from app.flood.capture import _filter_permanent, _finish
from app.flood.permanent_water import apply_permanent_water, permanent_mask, resolve_threshold
from app.flood.processing import aoi_from_point
from app.flood.stac import SceneRef

PIXEL = 100.0  # m2: 10 m pixels, 1 ha = 100 pixels
UTM = CRS.from_epsg(32651)
LAT, LNG = 15.1, 120.825


def _scene():
    from datetime import datetime, timezone
    return SceneRef("s1-rtc-pc", "S1_SYNTH", datetime(2026, 9, 19, tzinfo=timezone.utc), {"vv": "x"})


def synthetic():
    """100x100 px (1 km box). River: cols 0-19, every row (20 ha, occurrence 100).
    Flood block: rows 40-79 x cols 50-89 (16 ha, occurrence 5). Bank speck: col 25,
    rows 0-29 (0.3 ha, occurrence 0), which is under the 0.5 ha speck limit once
    separated from the river."""
    mask = np.zeros((100, 100), dtype=bool)
    occ = np.zeros((100, 100), dtype=np.float32)
    mask[:, :20] = True
    occ[:, :20] = 100
    mask[40:80, 50:90] = True
    occ[40:80, 50:90] = 5
    mask[:30, 25] = True
    return mask, occ


def test_known_permanent_water_is_subtracted():
    mask, occ = synthetic()
    flood, stats = apply_permanent_water(mask, occ, PIXEL, 75)
    assert stats["total_water_m2"] / 10_000 == pytest.approx(20 + 16 + 0.3)
    assert stats["permanent_excluded_m2"] / 10_000 == pytest.approx(20)
    # the 0.3 ha bank speck falls under the 0.5 ha limit; the flood block survives whole
    assert stats["flood_m2"] / 10_000 == pytest.approx(16)
    assert not (flood & (occ >= 75)).any()
    assert flood[40:80, 50:90].all()


def test_threshold_boundary_and_nodata():
    occ = np.array([[74, 75, 76, 255, np.nan, 100]], dtype=np.float32)
    assert permanent_mask(occ, 75).tolist() == [[False, True, True, False, False, True]]
    assert permanent_mask(occ, 90).tolist() == [[False, False, False, False, False, True]]


def test_a_higher_threshold_keeps_more_water_as_flood():
    mask, occ = synthetic()
    occ[:, :20] = 80  # a seasonal river: wet 80% of the time
    _, at_75 = apply_permanent_water(mask, occ, PIXEL, 75)
    _, at_90 = apply_permanent_water(mask, occ, PIXEL, 90)
    assert at_75["permanent_excluded_m2"] / 10_000 == pytest.approx(20)
    assert at_90["permanent_excluded_m2"] == 0
    assert at_90["flood_m2"] > at_75["flood_m2"]


def test_threshold_default_and_bounds(monkeypatch):
    assert get_settings().flood_permanent_water_threshold == 75
    assert resolve_threshold() == 75
    assert resolve_threshold(90) == 90
    for bad in (0, -5, 101, 1000):
        assert resolve_threshold(bad) == 75
    monkeypatch.setattr(get_settings(), "flood_permanent_water_threshold", 60)
    assert resolve_threshold() == 60


# --- through capture._finish, with a stubbed occurrence loader -----------------

def _grid():
    mask, occ = synthetic()
    transform = Affine(10, 0, 250_000, 0, -10, 1_670_000)
    aoi = aoi_from_point(LAT, LNG, 1.0)
    params = {"valid_fraction": 1.0, "algorithm": "stub"}
    return mask, occ, transform, aoi, params


def test_finish_excludes_permanent_water_and_records_it(monkeypatch):
    mask, occ, transform, aoi, params = _grid()
    monkeypatch.setattr(capture, "_load_occurrence", lambda *a: occ)
    result = _finish(mask, params, transform, UTM, PIXEL, aoi, _scene())
    assert result.total_water_ha == pytest.approx(36.3)
    assert result.flood_ha == pytest.approx(16)
    assert result.water_area_m2 / 10_000 == pytest.approx(16)  # the stored geometry is the flood only
    assert result.method["permanent_water"] == {
        "status": "applied", "source": "jrc-gsw-occurrence", "threshold": 75.0, "excluded_ha": 20.0}
    assert result.polygon_count == 1


@pytest.mark.parametrize("failure", [
    OSError("jrc down"),
    LookupError("no JRC occurrence tile covers this point"),
])
def test_a_failed_jrc_fetch_keeps_the_current_behaviour_and_marks_unfiltered(monkeypatch, failure):
    mask, occ, transform, aoi, params = _grid()

    def boom(*_a):
        raise failure

    monkeypatch.setattr(capture, "_load_occurrence", boom)
    result = _finish(mask, params, transform, UTM, PIXEL, aoi, _scene())
    assert result.flood_ha is None
    assert result.total_water_ha == pytest.approx(36.3)
    assert result.water_area_m2 / 10_000 == pytest.approx(36.3)  # same area as before this feature
    assert result.method["permanent_water"]["status"] == "unfiltered"
    assert result.method["permanent_water"]["reason"] == type(failure).__name__


def test_all_nodata_occurrence_is_treated_as_unfiltered(monkeypatch):
    mask, _, transform, aoi, params = _grid()
    monkeypatch.setattr(capture, "_load_occurrence", lambda *a: np.full(mask.shape, np.nan, dtype=np.float32))
    _, info, flood_m2 = _filter_permanent(mask, transform, UTM, PIXEL, aoi)
    assert flood_m2 is None and info["status"] == "unfiltered"


# --- the real reader: a GeoTIFF in EPSG:4326 at 30 m, resampled onto a UTM grid -----

def test_read_occurrence_clips_and_resamples_onto_the_capture_grid(tmp_path):
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import transform as warp_transform

    # capture grid: 1 km box of 10 m UTM pixels around the point
    xs, ys = warp_transform("EPSG:4326", UTM, [LNG], [LAT])
    transform = Affine(10, 0, xs[0] - 500, 0, -10, ys[0] + 500)
    # JRC-like tile: 0.01 deg square around the point at ~30 m; west half permanent (100), east half 0
    res = 0.00027
    west, north = LNG - 0.005, LAT + 0.005
    n = int(0.01 / res)
    data = np.zeros((n, n), dtype=np.uint8)
    data[:, : n // 2] = 100
    data[:3, :] = 255  # a no-data strip along the north edge
    path = tmp_path / "occurrence.tif"
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="uint8", crs="EPSG:4326",
                       transform=from_origin(west, north, res, res), nodata=255) as dst:
        dst.write(data, 1)

    out = permanent_water.read_occurrence(str(path), (100, 100), transform, UTM)
    assert out.shape == (100, 100)
    assert np.isnan(out[:3]).all()  # the no-data strip (~90 m) reaches the box's northern rows
    assert np.isfinite(out[15:]).all()
    assert np.nanmean(out[15:, :40]) == 100 and np.nanmean(out[15:, 60:]) == 0
    assert permanent_mask(out, 75)[15:, :40].all() and not permanent_mask(out, 75)[:, 60:].any()


def test_read_occurrence_outside_the_tile_is_all_nodata(tmp_path):
    import rasterio
    from rasterio.transform import from_origin

    path = tmp_path / "far.tif"
    with rasterio.open(path, "w", driver="GTiff", height=10, width=10, count=1, dtype="uint8", crs="EPSG:4326",
                       transform=from_origin(10.0, 10.0, 0.001, 0.001), nodata=255) as dst:
        dst.write(np.full((10, 10), 100, dtype=np.uint8), 1)
    out = permanent_water.read_occurrence(str(path), (50, 50), Affine(10, 0, 250_000, 0, -10, 1_670_000), UTM)
    assert np.isnan(out).all()
