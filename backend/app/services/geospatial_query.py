"""Geospatial helpers: zone GeoJSON generation, heatmap points, gazetteer search."""
import math
from typing import Dict, List

from ..data.sample_hazards import GAZETTEER, HAZARD_KEYS, HAZARD_ZONES
from .risk_scoring import level_for_score


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


def available_layers() -> List[Dict]:
    return [{"key": "overall", "label": "Overall Risk"}] + [
        {"key": k, "label": label}
        for k, label in [
            ("flood", "Flood"), ("earthquake", "Earthquake"),
            ("tropical_cyclone", "Tropical Cyclone"), ("volcano", "Volcano"),
            ("landslide", "Landslide"), ("storm_surge", "Storm Surge"),
        ] if k in HAZARD_KEYS
    ]
