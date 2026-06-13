"""Deterministic risk scoring engine.

Flow (per spec): hazard data -> backend scoring -> risk color -> AI explanation.
The AI never decides scores or colors. Scoring is a pure function of curated
zone data and distance, so identical inputs always yield identical outputs.
"""
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional

from ..data.sample_hazards import HAZARD_KEYS, HAZARD_LABELS, HAZARD_ZONES

# Influence extends beyond the core radius with linear decay, reaching zero
# at FALLOFF_MULTIPLIER x radius.
FALLOFF_MULTIPLIER = 3.0

RISK_LEVELS = [
    (0, 25, "Low", "green"),
    (26, 60, "Medium", "yellow"),
    (61, 100, "High", "red"),
]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def level_for_score(score: Optional[float]) -> Dict:
    if score is None:
        return {"level": "No Data", "color": "gray"}
    for lo, hi, label, color in RISK_LEVELS:
        if lo <= score <= hi:
            return {"level": label, "color": color}
    return {"level": "High", "color": "red"}


def _zone_weight(distance_km: float, radius_km: float) -> float:
    """1.0 inside the core radius, linear decay to 0 at the falloff edge."""
    if distance_km <= radius_km:
        return 1.0
    edge = radius_km * FALLOFF_MULTIPLIER
    if distance_km >= edge:
        return 0.0
    return 1.0 - (distance_km - radius_km) / (edge - radius_km)


def score_location(lat: float, lng: float, name: Optional[str] = None) -> Dict:
    """Compute hazard scores for a coordinate from the curated zone dataset."""
    contributions: List[Dict] = []
    for zone in HAZARD_ZONES:
        d = haversine_km(lat, lng, zone["lat"], zone["lng"])
        w = _zone_weight(d, zone["radius_km"])
        if w > 0:
            contributions.append({"zone": zone, "weight": w, "distance_km": round(d, 1)})

    has_data = len(contributions) > 0
    hazards = {}
    for key in HAZARD_KEYS:
        if not has_data:
            hazards[key] = {"score": None, "label": HAZARD_LABELS[key],
                            **level_for_score(None)}
            continue
        # Max-weighted contribution: the dominant zone drives the hazard.
        score = max(c["zone"]["hazards"][key] * c["weight"] for c in contributions)
        score = round(score)
        hazards[key] = {"score": score, "label": HAZARD_LABELS[key],
                        **level_for_score(score)}

    if has_data:
        scored = [h["score"] for h in hazards.values() if h["score"] is not None]
        # Overall: weighted blend of the worst hazard and the mean, so a single
        # extreme hazard dominates but compound exposure still registers.
        overall = round(0.65 * max(scored) + 0.35 * (sum(scored) / len(scored)))
    else:
        overall = None

    primary = contributions[0]["zone"] if contributions else None
    if contributions:
        primary = max(contributions, key=lambda c: c["weight"])["zone"]

    drivers = []
    if has_data:
        ranked = sorted(
            ((k, v["score"]) for k, v in hazards.items() if v["score"] is not None),
            key=lambda kv: kv[1], reverse=True,
        )
        drivers = [HAZARD_LABELS[k] for k, s in ranked[:3] if s > 25]

    return {
        "location_name": name or (primary["name"] if primary else f"{lat:.3f}, {lng:.3f}"),
        "latitude": lat,
        "longitude": lng,
        "overall": {"score": overall, **level_for_score(overall)},
        "hazards": hazards,
        "main_drivers": drivers,
        "nearest_zone": {
            "name": primary["name"], "country": primary["country"],
            "population": primary["population"],
            "critical_facilities": primary["critical_facilities"],
            "schools": primary["schools"], "hospitals": primary["hospitals"],
        } if primary else None,
        "data_coverage": "covered" if has_data else "limited",
        "confidence": "High" if (contributions and contributions[0]["weight"] >= 0.99)
        else ("Medium" if has_data else "Low"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": "Deterministic zone-based scoring (max-weighted hazard contribution, "
                       "linear distance decay). Indicative only — not an official advisory.",
    }


def compare_locations(locations: List[Dict]) -> List[Dict]:
    return [score_location(l["lat"], l["lng"], l.get("name")) for l in locations]
