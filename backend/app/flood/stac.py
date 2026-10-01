"""Find recent Sentinel scenes over a point.

Sentinel-1 radar first (it sees through cloud, which is what a flood needs):
the Planetary Computer `sentinel-1-rtc` collection, VV band. Sentinel-2 is the
fallback: Element 84 Earth Search `sentinel-2-l2a` (green, NIR and the scene
classification layer), under 40% cloud. `sentinel-1-grd` is deliberately not
used: it is requester-pays on Planetary Computer.

pystac-client and planetary-computer are imported inside the functions that
need them, so importing this module never needs the network or those packages.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

PC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1"
S1_COLLECTION = "sentinel-1-rtc"
S2_COLLECTION = "sentinel-2-l2a"
S1_SOURCE = "s1-rtc-pc"
S2_SOURCE = "s2-l2a-e84"
MAX_S2_CLOUD_PERCENT = 40
CANDIDATES_PER_SOURCE = 2


@dataclass(frozen=True)
class SceneRef:
    source: str  # s1-rtc-pc | s2-l2a-e84
    scene_id: str
    acquired_at: datetime
    assets: dict[str, str] = field(default_factory=dict)  # band -> signed/public href
    scale_offset: dict[str, tuple[float, float]] = field(default_factory=dict)  # band -> (scale, offset)
    cloud_cover: float | None = None


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _window(days: int, now: datetime | None = None) -> str:
    end = _utc(now)
    return f"{(end - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')}/{end.strftime('%Y-%m-%dT%H:%M:%SZ')}"


def _open_pc_catalog() -> Any:
    import planetary_computer
    from pystac_client import Client

    return Client.open(PC_STAC_URL, modifier=planetary_computer.sign_inplace)


def _open_earth_search() -> Any:
    from pystac_client import Client

    return Client.open(EARTH_SEARCH_URL)


def _newest(catalog: Any, collection: str, lat: float, lng: float, days: int, now: datetime | None,
            query: dict | None = None, limit: int = 10) -> list[Any]:
    kwargs: dict[str, Any] = dict(
        collections=[collection],
        intersects={"type": "Point", "coordinates": [lng, lat]},
        datetime=_window(days, now),
        max_items=limit,
    )
    if query:
        kwargs["query"] = query
    items = list(catalog.search(**kwargs).items())
    return sorted(items, key=lambda i: _utc(i.datetime), reverse=True)


def find_s1_scenes(lat: float, lng: float, days: int = 12, now: datetime | None = None,
                   limit: int = CANDIDATES_PER_SOURCE) -> list[SceneRef]:
    scenes = []
    for item in _newest(_open_pc_catalog(), S1_COLLECTION, lat, lng, days, now):
        vv = item.assets.get("vv")
        if vv is None:
            continue
        scenes.append(SceneRef(source=S1_SOURCE, scene_id=item.id, acquired_at=_utc(item.datetime),
                               assets={"vv": vv.href}))
        if len(scenes) >= limit:
            break
    return scenes


def _scale_offset(asset: Any, default: tuple[float, float]) -> tuple[float, float]:
    bands = (asset.extra_fields or {}).get("raster:bands") or []
    if bands and "scale" in bands[0]:
        return float(bands[0]["scale"]), float(bands[0].get("offset", 0.0))
    return default


def find_s2_scenes(lat: float, lng: float, days: int = 12, now: datetime | None = None,
                   limit: int = CANDIDATES_PER_SOURCE) -> list[SceneRef]:
    # Reflectance scale 1e-4 with the -0.1 offset used since processing baseline 04.00.
    default = (0.0001, -0.1)
    scenes = []
    for item in _newest(_open_earth_search(), S2_COLLECTION, lat, lng, days, now,
                        query={"eo:cloud_cover": {"lt": MAX_S2_CLOUD_PERCENT}}):
        green, nir, scl = (item.assets.get(k) for k in ("green", "nir", "scl"))
        if not (green and nir and scl):
            continue
        scenes.append(SceneRef(
            source=S2_SOURCE, scene_id=item.id, acquired_at=_utc(item.datetime),
            assets={"green": green.href, "nir": nir.href, "scl": scl.href},
            scale_offset={"green": _scale_offset(green, default), "nir": _scale_offset(nir, default)},
            cloud_cover=item.properties.get("eo:cloud_cover"),
        ))
        if len(scenes) >= limit:
            break
    return scenes


def find_scenes(lat: float, lng: float, days: int = 12, now: datetime | None = None) -> list[SceneRef]:
    """Candidate scenes, best first: the newest Sentinel-1 scenes, then the newest
    low-cloud Sentinel-2 scenes. The worker tries them in order. A failure to
    search one catalog does not hide the other's scenes, but if both fail the
    error from the first is raised so the job records a search failure."""
    scenes: list[SceneRef] = []
    first_error: Exception | None = None
    for finder in (find_s1_scenes, find_s2_scenes):
        try:
            scenes.extend(finder(lat, lng, days, now))
        except Exception as exc:  # one catalog being down must not hide the other
            first_error = first_error or exc
    if not scenes and first_error is not None:
        raise first_error
    return scenes
