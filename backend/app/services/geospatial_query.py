"""Geospatial helpers: zone GeoJSON generation, heatmap points, gazetteer search."""
import math
import time
from typing import Dict, List

import httpx

from ..config import get_settings
from ..data.sample_hazards import GAZETTEER, HAZARD_KEYS, HAZARD_ZONES
from .risk_scoring import level_for_score

_GEOCODE_CACHE: dict[str, tuple[float, List[Dict]]] = {}


def _circle_polygon(lat: float, lng: float, radius_km: float, points: int = 32) -> List[List[float]]:
    """Approximate a geodesic circle as a polygon ring ([lng, lat] pairs)."""
    coords = []
    lat_r = math.radians(lat)
    for i in range(points + 1):
        theta = 2 * math.pi * i / points
        dlat = (radius_km / 111.32) * math.cos(theta)
        dlng = (radius_km / (111.32 * max(math.cos(lat_r), 0.01))) * math.sin(theta)
        coords.append([round(lng + dlng, 5), round(lat + dlat, 5)])
    return coords


def hazard_layer_geojson(hazard: str = "overall") -> Dict:
    """GeoJSON FeatureCollection of risk zones colored for one hazard layer."""
    features = []
    for zone in HAZARD_ZONES:
        if hazard == "overall":
            scored = list(zone["hazards"].values())
            score = round(0.65 * max(scored) + 0.35 * (sum(scored) / len(scored)))
        else:
            score = zone["hazards"].get(hazard, 0)
        lvl = level_for_score(score)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon",
                         "coordinates": [_circle_polygon(zone["lat"], zone["lng"], zone["radius_km"])]},
            "properties": {
                "id": zone["id"], "name": zone["name"], "country": zone["country"],
                "hazard": hazard, "score": score, "level": lvl["level"],
                "color": lvl["color"], "population": zone["population"],
                "lat": zone["lat"], "lng": zone["lng"],
            },
        })
    return {"type": "FeatureCollection", "features": features}


def heatmap_points(hazard: str = "overall") -> Dict:
    """Weighted points for the MapLibre heatmap layer."""
    features = []
    for zone in HAZARD_ZONES:
        if hazard == "overall":
            scored = list(zone["hazards"].values())
            score = round(0.65 * max(scored) + 0.35 * (sum(scored) / len(scored)))
        else:
            score = zone["hazards"].get(hazard, 0)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [zone["lng"], zone["lat"]]},
            "properties": {"weight": score / 100, "name": zone["name"], "score": score},
        })
    return {"type": "FeatureCollection", "features": features}


def search_locations(query: str, limit: int = 8) -> List[Dict]:
    q = query.strip().lower()
    if not q:
        return []
    starts, contains = [], []
    for place in GAZETTEER:
        name = place["name"].lower()
        if name.startswith(q):
            starts.append(place)
        elif q in name or q in place["country"].lower():
            contains.append(place)
    return (starts + contains)[:limit]


async def search_locations_global(query: str, limit: int = 8) -> List[Dict]:
    """Use Geoapify, then LocationIQ, with bounded local fallback."""
    settings = get_settings()
    normalized = query.strip()
    if len(normalized) < settings.geocoder_min_query_length:
        return []
    max_results = min(max(1, limit), settings.geocoder_max_results)
    cache_key = f"{normalized.lower()}:{max_results}"
    cached = _GEOCODE_CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    providers = [settings.geocoder_provider, "locationiq", "photon"]
    for provider in dict.fromkeys(providers):
        results = await _search_provider(provider, normalized, max_results, settings)
        if results:
            _GEOCODE_CACHE[cache_key] = (time.monotonic() + settings.geocoder_cache_ttl_seconds, results)
            return results
    if settings.geocoder_enable_fallback:
        return search_locations(query, limit)


async def _search_provider(provider: str, query: str, limit: int, settings) -> List[Dict]:
    try:
        async with httpx.AsyncClient(timeout=settings.geocoder_timeout_seconds) as client:
            if provider == "geoapify" and settings.geoapify_api_key:
                response = await client.get(settings.geoapify_base_url, params={"text": query, "limit": limit, "apiKey": settings.geoapify_api_key})
                response.raise_for_status()
                return [_normalized_geoapify(item) for item in response.json().get("features", []) if _normalized_geoapify(item)]
            if provider == "locationiq" and settings.locationiq_access_token:
                response = await client.get(settings.locationiq_base_url, params={"q": query, "limit": limit, "format": "json", "key": settings.locationiq_access_token})
                response.raise_for_status()
                return [_normalized_locationiq(item) for item in response.json() if _normalized_locationiq(item)]
            if provider != "photon" or not settings.photon_url:
                return []
            response = await client.get(f"{settings.photon_url}/api", params={"q": query, "limit": limit})
        response.raise_for_status()
        results = []
        for feature in response.json().get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            results.append({
                "provider": "photon", "external_id": props.get("osm_id"),
                "name": props.get("name") or props.get("city") or props.get("country") or "Unknown location",
                "formatted_address": props.get("name") or props.get("label"),
                "country_code": (props.get("countrycode") or "").upper() or None,
                "admin_levels": {"region": props.get("state"), "city": props.get("city")},
                "latitude": coords[1], "longitude": coords[0], "geometry_type": feature.get("geometry", {}).get("type", "Point").lower(),
                "bounding_box": None, "confidence": "medium",
                # Backwards-compatible client aliases.
                "lat": coords[1], "lng": coords[0], "country": props.get("country"), "countryAlpha2": (props.get("countrycode") or "").upper() or None,
            })
        return results[:limit]
    except (httpx.HTTPError, ValueError, TypeError):
        return []


def _base_result(provider: str, name: str, lat: float, lng: float, country: str | None, country_code: str | None, address: str | None, region: str | None, city: str | None, external_id: str | None = None) -> Dict:
    return {"provider": provider, "external_id": external_id, "name": name, "formatted_address": address or name, "country_code": country_code.upper() if country_code else None, "admin_levels": {"region": region, "city": city}, "latitude": lat, "longitude": lng, "geometry_type": "point", "bounding_box": None, "confidence": "medium", "lat": lat, "lng": lng, "country": country, "countryAlpha2": country_code.upper() if country_code else None}


def _normalized_geoapify(feature: Dict) -> Dict | None:
    props = feature.get("properties", {})
    try:
        return _base_result("geoapify", props.get("name") or props.get("formatted") or "Unknown location", float(props["lat"]), float(props["lon"]), props.get("country"), props.get("country_code"), props.get("formatted"), props.get("state"), props.get("city"), props.get("place_id"))
    except (KeyError, TypeError, ValueError):
        return None


def _normalized_locationiq(item: Dict) -> Dict | None:
    address = item.get("address", {})
    try:
        return _base_result("locationiq", item.get("name") or item.get("display_name") or "Unknown location", float(item["lat"]), float(item["lon"]), address.get("country"), address.get("country_code"), item.get("display_name"), address.get("state"), address.get("city") or address.get("town"), item.get("place_id"))
    except (KeyError, TypeError, ValueError):
        return None


def available_layers() -> List[Dict]:
    return [{"key": "overall", "label": "Overall Risk"}] + [
        {"key": k, "label": label}
        for k, label in [
            ("flood", "Flood"), ("earthquake", "Earthquake"),
            ("tropical_cyclone", "Tropical Cyclone"), ("volcano", "Volcano"),
            ("landslide", "Landslide"), ("storm_surge", "Storm Surge"),
        ] if k in HAZARD_KEYS
    ]
