"""Scene search with mocked catalogs: no network."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.flood import stac

NOW = datetime(2026, 10, 1, 4, 0, tzinfo=timezone.utc)


def _asset(href, **extra):
    return SimpleNamespace(href=href, extra_fields=extra)


def _item(item_id, days_ago, assets, cloud=None):
    return SimpleNamespace(
        id=item_id, datetime=NOW - timedelta(days=days_ago), assets=assets,
        properties={"eo:cloud_cover": cloud} if cloud is not None else {},
    )


class _Catalog:
    def __init__(self, items=None, error=None):
        self.items, self.error, self.calls = items or [], error, []

    def search(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(items=lambda: iter(self.items))


def _patch(monkeypatch, pc=None, e84=None):
    pc, e84 = pc or _Catalog(), e84 or _Catalog()
    monkeypatch.setattr(stac, "_open_pc_catalog", lambda: pc)
    monkeypatch.setattr(stac, "_open_earth_search", lambda: e84)
    return pc, e84


def test_newest_sentinel1_scenes_come_first_and_only_rtc_is_queried(monkeypatch):
    pc, _ = _patch(monkeypatch, pc=_Catalog([
        _item("old", 9, {"vv": _asset("https://pc/old_vv.tif?sig")}),
        _item("newest", 1, {"vv": _asset("https://pc/newest_vv.tif?sig")}),
        _item("mid", 4, {"vv": _asset("https://pc/mid_vv.tif?sig")}),
        _item("no-vv", 0, {"vh": _asset("https://pc/x_vh.tif")}),
    ]))
    scenes = stac.find_s1_scenes(14.93, 120.85, 12, NOW)
    assert [s.scene_id for s in scenes] == ["newest", "mid"]
    assert scenes[0].source == "s1-rtc-pc" and scenes[0].assets == {"vv": "https://pc/newest_vv.tif?sig"}
    call = pc.calls[0]
    assert call["collections"] == ["sentinel-1-rtc"]          # never the requester-pays GRD collection
    assert call["intersects"] == {"type": "Point", "coordinates": [120.85, 14.93]}
    assert call["datetime"] == "2026-09-19T04:00:00Z/2026-10-01T04:00:00Z"  # last 12 days


def test_sentinel2_fallback_filters_cloud_and_reads_scale_offset(monkeypatch):
    _, e84 = _patch(monkeypatch, e84=_Catalog([
        _item("S2A_1", 2, {"green": _asset("https://e84/g.tif", **{"raster:bands": [{"scale": 0.0001, "offset": -0.1}]}),
                           "nir": _asset("https://e84/n.tif"), "scl": _asset("https://e84/s.tif")}, cloud=12.5),
        _item("S2A_incomplete", 1, {"green": _asset("https://e84/g.tif")}, cloud=3),
    ]))
    scenes = stac.find_s2_scenes(14.93, 120.85, 12, NOW)
    assert [s.scene_id for s in scenes] == ["S2A_1"]
    scene = scenes[0]
    assert scene.source == "s2-l2a-e84" and set(scene.assets) == {"green", "nir", "scl"}
    assert scene.scale_offset["green"] == (0.0001, -0.1)
    assert scene.scale_offset["nir"] == (0.0001, -0.1)        # default when the asset has no raster:bands
    assert scene.cloud_cover == 12.5
    assert e84.calls[0]["collections"] == ["sentinel-2-l2a"]
    assert e84.calls[0]["query"] == {"eo:cloud_cover": {"lt": 40}}


def test_find_scenes_orders_radar_before_optical(monkeypatch):
    _patch(monkeypatch,
           pc=_Catalog([_item("S1", 1, {"vv": _asset("https://pc/vv.tif")})]),
           e84=_Catalog([_item("S2", 0, {"green": _asset("g"), "nir": _asset("n"), "scl": _asset("s")}, cloud=5)]))
    assert [s.source for s in stac.find_scenes(14.93, 120.85, 12, NOW)] == ["s1-rtc-pc", "s2-l2a-e84"]


def test_no_scenes_is_an_empty_list_not_an_error(monkeypatch):
    _patch(monkeypatch)
    assert stac.find_scenes(14.93, 120.85, 12, NOW) == []


def test_one_catalog_failing_does_not_hide_the_other(monkeypatch):
    _patch(monkeypatch, pc=_Catalog(error=RuntimeError("PC down")),
           e84=_Catalog([_item("S2", 0, {"green": _asset("g"), "nir": _asset("n"), "scl": _asset("s")}, cloud=5)]))
    assert [s.scene_id for s in stac.find_scenes(14.93, 120.85, 12, NOW)] == ["S2"]


def test_both_catalogs_failing_raises_so_the_job_can_retry(monkeypatch):
    _patch(monkeypatch, pc=_Catalog(error=RuntimeError("PC down")), e84=_Catalog(error=RuntimeError("E84 down")))
    with pytest.raises(RuntimeError, match="PC down"):
        stac.find_scenes(14.93, 120.85, 12, NOW)
