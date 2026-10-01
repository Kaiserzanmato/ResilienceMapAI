"""Flood processing on synthetic data: no network, no real scenes."""
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform as warp_transform
from shapely.geometry import shape

from app.flood import capture
from app.flood.capture import NoUsableData, ReadTooLarge, capture_extent
from app.flood.processing import (
    AreaTooLarge, MAX_AOI_KM2, aoi_from_point, majority_filter_3x3, ndwi_water_mask, otsu_threshold,
    pixel_area_m2, polygonize, sar_water_mask, snap_center, to_db,
)
from app.flood.stac import S1_SOURCE, S2_SOURCE, SceneRef

from datetime import datetime, timezone

LAT, LNG = 14.93, 120.85  # Candaba floodplain, Luzon
UTM = "EPSG:32651"


def _noise(shape_, scale=0.3, seed=1):
    return np.random.default_rng(seed).normal(0, scale, shape_).astype(np.float32)


# ------------------------------------------------------------------ AOI

def test_aoi_is_a_5km_box_containing_the_point():
    aoi = aoi_from_point(LAT, LNG)
    west, south, east, north = aoi.bbox
    assert west < LNG < east and south < LAT < north
    assert (north - south) * 111_320 == pytest.approx(5000, rel=0.01)
    assert aoi.area_km2 == 25
    ring = aoi.polygon["coordinates"][0]
    assert ring[0] == ring[-1] and len(ring) == 5


def test_nearby_points_share_a_tile_key_and_distant_ones_do_not():
    assert aoi_from_point(LAT, LNG).tile_key == aoi_from_point(LAT + 0.004, LNG - 0.004).tile_key
    assert aoi_from_point(LAT, LNG).tile_key != aoi_from_point(LAT + 0.2, LNG).tile_key
    assert snap_center(LAT, LNG) == snap_center(LAT + 0.002, LNG + 0.002)


def test_area_over_100_km2_is_refused():
    assert aoi_from_point(LAT, LNG, size_km=10).area_km2 == MAX_AOI_KM2  # exactly at the cap is fine
    with pytest.raises(AreaTooLarge):
        aoi_from_point(LAT, LNG, size_km=10.5)
    with pytest.raises(ValueError):
        aoi_from_point(95, 0)


# -------------------------------------------------------- SAR water mask

def _scene_db(water_db=-24.0, land_db=-8.0, size=200):
    db = land_db + _noise((size, size))
    db[60:140, 50:150] = water_db + _noise((80, 100), seed=2)
    return db


def test_sar_mask_finds_the_water_block_and_uses_otsu_inside_the_clamp():
    mask, params = sar_water_mask(_scene_db(water_db=-20.0, land_db=-12.0), pixel_area=100.0)
    assert mask[60:140, 50:150].mean() > 0.97
    assert mask.sum() == pytest.approx(80 * 100, rel=0.05)
    assert params["threshold_source"] == "otsu" and -23 <= params["threshold_db"] <= -15


def test_sar_threshold_is_clamped_to_minus_23_and_minus_15():
    # Otsu lands near -16 for -24 / -8 dB; push it outside the clamp both ways.
    _, high = sar_water_mask(_scene_db(water_db=-9.0, land_db=-3.0))
    assert high["threshold_db"] == -15.0 and high["threshold_source"] == "otsu-clamped"
    _, low = sar_water_mask(_scene_db(water_db=-34.0, land_db=-27.0))
    assert low["threshold_db"] == -23.0 and low["threshold_source"] == "otsu-clamped"


def test_sar_falls_back_to_minus_18_when_there_is_nothing_to_separate():
    mask, params = sar_water_mask(np.full((50, 50), -10.0, dtype=np.float32))
    assert params["threshold_db"] == -18.0 and params["threshold_source"] == "fallback"
    assert not mask.any()
    mask, params = sar_water_mask(np.full((5, 5), np.nan, dtype=np.float32))
    assert params["threshold_source"] == "fallback" and not mask.any()


def test_specks_under_half_a_hectare_are_dropped_but_a_real_body_stays():
    db = np.full((120, 120), -8.0, dtype=np.float32)
    db[10:14, 10:14] = -25.0      # 16 px = 0.16 ha at 10 m: a speck
    db[40:100, 40:100] = -25.0    # 3600 px = 36 ha: a lake
    mask, _ = sar_water_mask(db, pixel_area=100.0)
    assert not mask[10:14, 10:14].any()
    assert mask[41:99, 41:99].all()  # the 3x3 median rounds the corners, not the body


def test_3x3_median_removes_isolated_pixels():
    m = np.zeros((9, 9), dtype=bool)
    m[4, 4] = True
    m[0:3, 0:3] = True
    out = majority_filter_3x3(m)
    assert not out[4, 4] and out[1, 1]


def test_to_db_marks_non_positive_values_invalid():
    out = to_db(np.array([1.0, 0.1, 0.0, -5.0, np.nan], dtype=np.float32))
    assert out[0] == pytest.approx(0.0) and out[1] == pytest.approx(-10.0)
    assert np.isnan(out[2:]).all()


def test_otsu_needs_enough_data():
    assert otsu_threshold(np.array([1.0, 2.0])) is None
    assert otsu_threshold(np.full(500, -10.0)) is None


# --------------------------------------------------------- NDWI water mask

def test_ndwi_excludes_cloud_shadow_and_nodata_instead_of_calling_them_land():
    green = np.full((100, 100), 0.10, dtype=np.float32)
    nir = np.full((100, 100), 0.30, dtype=np.float32)
    green[20:80, 20:80], nir[20:80, 20:80] = 0.15, 0.05      # water
    scl = np.full((100, 100), 4, dtype=np.uint8)
    scl[20:80, 20:80] = 6
    scl[0:30, 60:100] = 9                                    # cloud over part of the water
    green[0:30, 60:100] = 0.5                                # bright cloud that would read as water
    nir[0:30, 60:100] = 0.1
    scl[90:100, 0:10] = 3                                    # shadow
    mask, params = ndwi_water_mask(green, nir, scl, pixel_area=100.0)
    assert mask[31:79, 21:59].all()
    assert not mask[0:20, 60:100].any()                      # cloud is never water
    assert not mask[90:100, 0:10].any()
    assert params["valid_fraction"] < 1.0


# ------------------------------------------------------------- polygonize

def _utm_grid(size=200):
    x, y = warp_transform("EPSG:4326", UTM, [LNG], [LAT])
    return from_origin(x[0] - size * 5, y[0] + size * 5, 10, 10)


def test_polygonize_returns_a_valid_multipolygon_in_wgs84():
    transform = _utm_grid()
    mask = np.zeros((200, 200), dtype=bool)
    mask[20:60, 20:80] = True
    mask[120:150, 100:170] = True
    geom, area, count = polygonize(mask, transform, UTM, pixel_area=100.0)
    assert geom["type"] == "MultiPolygon" and count == 2
    assert area == pytest.approx((40 * 60 + 30 * 70) * 100)
    poly = shape(geom)
    assert poly.is_valid
    minx, miny, maxx, maxy = poly.bounds
    assert 120.5 < minx < maxx < 121.2 and 14.5 < miny < maxy < 15.3
    assert polygonize(np.zeros((10, 10), dtype=bool), transform, UTM, 100.0) == (None, 0.0, 0)


def test_pixel_area_uses_the_metric_grid():
    with rasterio.Env():
        assert pixel_area_m2(_utm_grid(), rasterio.crs.CRS.from_string(UTM), LAT) == pytest.approx(100.0)


# ----------------------------------------------- windowed reads (synthetic COGs)

def _write(path, array, transform, nodata=-32768.0, crs=UTM, dtype="float32"):
    with rasterio.open(path, "w", driver="GTiff", height=array.shape[0], width=array.shape[1], count=1,
                       dtype=dtype, crs=crs, transform=transform, nodata=nodata) as ds:
        ds.write(array.astype(dtype), 1)


def _s1_scene(tmp_path, lin):
    path = tmp_path / "vv.tif"
    _write(path, lin, _utm_grid(size=lin.shape[0]), nodata=-32768.0)
    return SceneRef(S1_SOURCE, "S1A_TEST", datetime(2026, 9, 28, tzinfo=timezone.utc), {"vv": str(path)})


def _linear_scene(size=1000, water_box=(450, 520, 430, 560)):
    lin = np.full((size, size), 0.12, dtype=np.float32) + _noise((size, size), 0.01, seed=3)
    r0, r1, c0, c1 = water_box
    lin[r0:r1, c0:c1] = 0.004 + np.abs(_noise((r1 - r0, c1 - c0), 0.0005, seed=4))
    return lin


def test_capture_reads_only_the_aoi_and_returns_the_water(tmp_path):
    scene = _s1_scene(tmp_path, _linear_scene())
    aoi = aoi_from_point(LAT, LNG)
    result = capture_extent(scene, aoi)
    assert result.geometry["type"] == "MultiPolygon" and result.polygon_count >= 1
    assert result.water_area_m2 == pytest.approx(70 * 130 * 100, rel=0.1)
    assert result.method["algorithm"] == "sar-otsu-vv" and result.method["source"] == S1_SOURCE
    # ~5 km at 10 m is 500 px a side; the 10 km raster was never read whole
    assert result.method["window_px"][0] <= 510 and result.method["window_px"][1] <= 510


def test_capture_with_no_valid_pixels_raises_no_usable_data(tmp_path):
    scene = _s1_scene(tmp_path, np.full((1000, 1000), -32768.0, dtype=np.float32))
    with pytest.raises(NoUsableData):
        capture_extent(scene, aoi_from_point(LAT, LNG))


def test_capture_outside_the_scene_raises_no_usable_data(tmp_path):
    scene = _s1_scene(tmp_path, _linear_scene())
    with pytest.raises(NoUsableData):
        capture_extent(scene, aoi_from_point(LAT + 1.0, LNG))


def test_a_window_over_the_read_cap_is_refused(tmp_path, monkeypatch):
    scene = _s1_scene(tmp_path, _linear_scene())
    monkeypatch.setattr(capture, "MAX_WINDOW_PIXELS", 10_000)
    with pytest.raises(ReadTooLarge):
        capture_extent(scene, aoi_from_point(LAT, LNG))


def test_sentinel2_capture_uses_ndwi_with_the_20m_scl_layer(tmp_path):
    size = 1000
    transform = _utm_grid(size=size)
    green = np.full((size, size), 2000, dtype=np.float32)
    nir = np.full((size, size), 4000, dtype=np.float32)
    green[450:520, 430:560], nir[450:520, 430:560] = 2500, 1500
    scl = np.full((size // 2, size // 2), 4, dtype=np.float32)
    paths = {}
    for name, array, tf in (("green", green, transform), ("nir", nir, transform),
                            ("scl", scl, from_origin(transform.c, transform.f, 20, 20))):
        paths[name] = str(tmp_path / f"{name}.tif")
        _write(paths[name], array, tf, nodata=0.0, dtype="uint16" if name != "scl" else "uint8")
    scene = SceneRef(S2_SOURCE, "S2B_TEST", datetime(2026, 9, 27, tzinfo=timezone.utc), paths,
                     {"green": (0.0001, -0.1), "nir": (0.0001, -0.1)}, cloud_cover=5.0)
    result = capture_extent(scene, aoi_from_point(LAT, LNG))
    assert result.method["algorithm"] == "s2-ndwi-scl"
    assert result.water_area_m2 == pytest.approx(70 * 130 * 100, rel=0.1)
    assert result.geometry["type"] == "MultiPolygon"


def test_a_dropped_network_read_is_retried_once_before_the_job_fails(tmp_path, monkeypatch):
    from rasterio.errors import RasterioIOError

    scene = _s1_scene(tmp_path, _linear_scene())
    real, calls = capture._read_window_once, []

    def flaky(href, bbox, out_shape):
        calls.append(href)
        if len(calls) == 1:
            raise RasterioIOError("Read failed. See previous exception for details.")
        return real(href, bbox, out_shape)

    monkeypatch.setattr(capture, "_read_window_once", flaky)
    monkeypatch.setattr(capture, "READ_RETRY_DELAY_S", 0)
    assert capture_extent(scene, aoi_from_point(LAT, LNG)).geometry is not None and len(calls) == 2

    calls.clear()
    monkeypatch.setattr(capture, "_read_window_once", lambda *a: (_ for _ in ()).throw(RasterioIOError("down")))
    with pytest.raises(RasterioIOError):  # still fails after the second attempt, for the worker to retry later
        capture_extent(scene, aoi_from_point(LAT, LNG))
