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


COUNTRY_RISK_BASELINE = {
    # Asia-Pacific High Risk
    "PH": {"flood": 72, "earthquake": 68, "tropical_cyclone": 75, "volcano": 55, "landslide": 52, "storm_surge": 65},
    "ID": {"flood": 62, "earthquake": 72, "tropical_cyclone": 68, "volcano": 65, "landslide": 58, "storm_surge": 52},
    "BD": {"flood": 85, "earthquake": 42, "tropical_cyclone": 80, "volcano": 0, "landslide": 25, "storm_surge": 78},
    "TH": {"flood": 70, "earthquake": 48, "tropical_cyclone": 65, "volcano": 0, "landslide": 45, "storm_surge": 42},
    "VN": {"flood": 68, "earthquake": 45, "tropical_cyclone": 72, "volcano": 0, "landslide": 42, "storm_surge": 55},
    "JP": {"flood": 55, "earthquake": 75, "tropical_cyclone": 62, "volcano": 48, "landslide": 55, "storm_surge": 45},
    "MM": {"flood": 68, "earthquake": 35, "tropical_cyclone": 75, "volcano": 0, "landslide": 48, "storm_surge": 52},
    "KH": {"flood": 72, "earthquake": 28, "tropical_cyclone": 65, "volcano": 0, "landslide": 35, "storm_surge": 45},
    "LA": {"flood": 65, "earthquake": 22, "tropical_cyclone": 55, "volcano": 0, "landslide": 52, "storm_surge": 0},
    "MY": {"flood": 58, "earthquake": 42, "tropical_cyclone": 68, "volcano": 18, "landslide": 48, "storm_surge": 45},
    "SG": {"flood": 52, "earthquake": 25, "tropical_cyclone": 48, "volcano": 0, "landslide": 8, "storm_surge": 38},
    "KR": {"flood": 35, "earthquake": 42, "tropical_cyclone": 55, "volcano": 0, "landslide": 18, "storm_surge": 32},
    "TW": {"flood": 48, "earthquake": 72, "tropical_cyclone": 75, "volcano": 18, "landslide": 65, "storm_surge": 52},
    "PK": {"flood": 75, "earthquake": 65, "tropical_cyclone": 35, "volcano": 0, "landslide": 62, "storm_surge": 28},
    "IN": {"flood": 65, "earthquake": 48, "tropical_cyclone": 62, "volcano": 0, "landslide": 48, "storm_surge": 42},
    "NP": {"flood": 72, "earthquake": 75, "tropical_cyclone": 0, "volcano": 0, "landslide": 68, "storm_surge": 0},
    "LK": {"flood": 62, "earthquake": 28, "tropical_cyclone": 72, "volcano": 0, "landslide": 42, "storm_surge": 55},
    "AF": {"flood": 48, "earthquake": 62, "tropical_cyclone": 0, "volcano": 0, "landslide": 62, "storm_surge": 0},
    "PG": {"flood": 68, "earthquake": 65, "tropical_cyclone": 62, "volcano": 55, "landslide": 72, "storm_surge": 48},
    "FJ": {"flood": 55, "earthquake": 52, "tropical_cyclone": 85, "volcano": 32, "landslide": 35, "storm_surge": 68},
    "SB": {"flood": 62, "earthquake": 58, "tropical_cyclone": 75, "volcano": 38, "landslide": 48, "storm_surge": 62},
    "PW": {"flood": 48, "earthquake": 35, "tropical_cyclone": 82, "volcano": 0, "landslide": 25, "storm_surge": 72},

    # Americas High Risk
    "MX": {"flood": 48, "earthquake": 62, "tropical_cyclone": 58, "volcano": 35, "landslide": 42, "storm_surge": 42},
    "BR": {"flood": 52, "earthquake": 25, "tropical_cyclone": 0, "volcano": 15, "landslide": 45, "storm_surge": 25},
    "PE": {"flood": 55, "earthquake": 72, "tropical_cyclone": 0, "volcano": 45, "landslide": 68, "storm_surge": 35},
    "CL": {"flood": 48, "earthquake": 78, "tropical_cyclone": 0, "volcano": 52, "landslide": 48, "storm_surge": 32},
    "EC": {"flood": 62, "earthquake": 75, "tropical_cyclone": 35, "volcano": 58, "landslide": 65, "storm_surge": 42},
    "CO": {"flood": 65, "earthquake": 48, "tropical_cyclone": 42, "volcano": 35, "landslide": 62, "storm_surge": 38},
    "VE": {"flood": 58, "earthquake": 42, "tropical_cyclone": 65, "volcano": 25, "landslide": 48, "storm_surge": 45},
    "CR": {"flood": 68, "earthquake": 58, "tropical_cyclone": 72, "volcano": 48, "landslide": 65, "storm_surge": 52},
    "PA": {"flood": 72, "earthquake": 48, "tropical_cyclone": 75, "volcano": 28, "landslide": 48, "storm_surge": 55},
    "GT": {"flood": 62, "earthquake": 65, "tropical_cyclone": 68, "volcano": 52, "landslide": 62, "storm_surge": 48},
    "SV": {"flood": 65, "earthquake": 68, "tropical_cyclone": 72, "volcano": 58, "landslide": 65, "storm_surge": 52},
    "HN": {"flood": 68, "earthquake": 55, "tropical_cyclone": 78, "volcano": 35, "landslide": 55, "storm_surge": 52},
    "NI": {"flood": 72, "earthquake": 52, "tropical_cyclone": 75, "volcano": 42, "landslide": 52, "storm_surge": 55},
    "BZ": {"flood": 65, "earthquake": 38, "tropical_cyclone": 75, "volcano": 0, "landslide": 35, "storm_surge": 58},
    "JM": {"flood": 55, "earthquake": 42, "tropical_cyclone": 78, "volcano": 0, "landslide": 32, "storm_surge": 65},
    "DO": {"flood": 62, "earthquake": 48, "tropical_cyclone": 82, "volcano": 0, "landslide": 35, "storm_surge": 68},
    "CU": {"flood": 48, "earthquake": 32, "tropical_cyclone": 85, "volcano": 0, "landslide": 12, "storm_surge": 72},
    "HT": {"flood": 72, "earthquake": 52, "tropical_cyclone": 82, "volcano": 0, "landslide": 48, "storm_surge": 65},
    "BO": {"flood": 62, "earthquake": 65, "tropical_cyclone": 0, "volcano": 38, "landslide": 72, "storm_surge": 0},
    "PY": {"flood": 68, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 0},
    "UY": {"flood": 45, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 28},
    "AR": {"flood": 42, "earthquake": 48, "tropical_cyclone": 0, "volcano": 18, "landslide": 22, "storm_surge": 22},
    "US": {"flood": 45, "earthquake": 55, "tropical_cyclone": 48, "volcano": 32, "landslide": 38, "storm_surge": 40},
    "CA": {"flood": 35, "earthquake": 48, "tropical_cyclone": 18, "volcano": 25, "landslide": 28, "storm_surge": 32},

    # Africa High Risk
    "NG": {"flood": 62, "earthquake": 35, "tropical_cyclone": 0, "volcano": 0, "landslide": 42, "storm_surge": 38},
    "ET": {"flood": 55, "earthquake": 52, "tropical_cyclone": 0, "volcano": 38, "landslide": 48, "storm_surge": 0},
    "KE": {"flood": 58, "earthquake": 55, "tropical_cyclone": 0, "volcano": 42, "landslide": 45, "storm_surge": 35},
    "ZA": {"flood": 48, "earthquake": 42, "tropical_cyclone": 0, "volcano": 0, "landslide": 32, "storm_surge": 35},
    "EG": {"flood": 38, "earthquake": 45, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 22},
    "MA": {"flood": 42, "earthquake": 52, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 32},
    "DZ": {"flood": 35, "earthquake": 48, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 28},
    "GH": {"flood": 62, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 42},
    "CI": {"flood": 65, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 42, "storm_surge": 45},
    "SL": {"flood": 72, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 48, "storm_surge": 52},
    "LR": {"flood": 75, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 52, "storm_surge": 55},
    "SN": {"flood": 55, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 38},
    "TZ": {"flood": 62, "earthquake": 48, "tropical_cyclone": 0, "volcano": 35, "landslide": 45, "storm_surge": 38},
    "UG": {"flood": 65, "earthquake": 42, "tropical_cyclone": 0, "volcano": 38, "landslide": 52, "storm_surge": 0},
    "RW": {"flood": 72, "earthquake": 52, "tropical_cyclone": 0, "volcano": 45, "landslide": 65, "storm_surge": 0},
    "SD": {"flood": 62, "earthquake": 38, "tropical_cyclone": 0, "volcano": 0, "landslide": 38, "storm_surge": 35},
    "CD": {"flood": 72, "earthquake": 35, "tropical_cyclone": 0, "volcano": 42, "landslide": 62, "storm_surge": 0},
    "CG": {"flood": 68, "earthquake": 22, "tropical_cyclone": 0, "volcano": 28, "landslide": 55, "storm_surge": 0},
    "GA": {"flood": 65, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 48, "storm_surge": 42},
    "CM": {"flood": 65, "earthquake": 28, "tropical_cyclone": 0, "volcano": 32, "landslide": 52, "storm_surge": 35},
    "MG": {"flood": 72, "earthquake": 45, "tropical_cyclone": 78, "volcano": 18, "landslide": 55, "storm_surge": 52},
    "MZ": {"flood": 68, "earthquake": 28, "tropical_cyclone": 0, "volcano": 0, "landslide": 38, "storm_surge": 42},
    "ZM": {"flood": 62, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 0},
    "ZW": {"flood": 48, "earthquake": 25, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 0},
    "BW": {"flood": 35, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 15, "storm_surge": 0},
    "NA": {"flood": 32, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 28},
    "AO": {"flood": 48, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 35},

    # Middle East & Central Asia
    "IQ": {"flood": 45, "earthquake": 55, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 35},
    "YE": {"flood": 55, "earthquake": 45, "tropical_cyclone": 42, "volcano": 35, "landslide": 38, "storm_surge": 45},
    "SA": {"flood": 35, "earthquake": 48, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 28},
    "AE": {"flood": 28, "earthquake": 32, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 22},
    "KW": {"flood": 32, "earthquake": 38, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 18},
    "QA": {"flood": 25, "earthquake": 35, "tropical_cyclone": 0, "volcano": 0, "landslide": 5, "storm_surge": 15},
    "BH": {"flood": 28, "earthquake": 32, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 18},
    "OM": {"flood": 38, "earthquake": 48, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 35},
    "IR": {"flood": 48, "earthquake": 68, "tropical_cyclone": 0, "volcano": 0, "landslide": 42, "storm_surge": 32},
    "SY": {"flood": 42, "earthquake": 58, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 0},
    "JO": {"flood": 38, "earthquake": 58, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 0},
    "LB": {"flood": 48, "earthquake": 65, "tropical_cyclone": 0, "volcano": 0, "landslide": 38, "storm_surge": 28},
    "IL": {"flood": 35, "earthquake": 62, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 22},
    "PS": {"flood": 32, "earthquake": 55, "tropical_cyclone": 0, "volcano": 0, "landslide": 15, "storm_surge": 0},
    "TR": {"flood": 52, "earthquake": 72, "tropical_cyclone": 0, "volcano": 35, "landslide": 48, "storm_surge": 28},
    "AZ": {"flood": 48, "earthquake": 68, "tropical_cyclone": 0, "volcano": 0, "landslide": 45, "storm_surge": 0},
    "AM": {"flood": 42, "earthquake": 72, "tropical_cyclone": 0, "volcano": 0, "landslide": 52, "storm_surge": 0},
    "GE": {"flood": 62, "earthquake": 68, "tropical_cyclone": 0, "volcano": 0, "landslide": 58, "storm_surge": 0},
    "KZ": {"flood": 35, "earthquake": 42, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 0},
    "UZ": {"flood": 42, "earthquake": 35, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 0},
    "TJ": {"flood": 55, "earthquake": 62, "tropical_cyclone": 0, "volcano": 0, "landslide": 65, "storm_surge": 0},
    "KG": {"flood": 52, "earthquake": 72, "tropical_cyclone": 0, "volcano": 0, "landslide": 68, "storm_surge": 0},
    "TM": {"flood": 28, "earthquake": 35, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 0},

    # Europe Moderate Risk
    "IT": {"flood": 48, "earthquake": 62, "tropical_cyclone": 0, "volcano": 38, "landslide": 35, "storm_surge": 28},
    "GR": {"flood": 42, "earthquake": 68, "tropical_cyclone": 0, "volcano": 28, "landslide": 32, "storm_surge": 22},
    "ES": {"flood": 38, "earthquake": 48, "tropical_cyclone": 0, "volcano": 0, "landslide": 28, "storm_surge": 18},
    "PT": {"flood": 42, "earthquake": 52, "tropical_cyclone": 0, "volcano": 0, "landslide": 25, "storm_surge": 22},
    "FR": {"flood": 35, "earthquake": 38, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 18},
    "DE": {"flood": 32, "earthquake": 25, "tropical_cyclone": 0, "volcano": 0, "landslide": 15, "storm_surge": 12},
    "NL": {"flood": 45, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 38},
    "BE": {"flood": 38, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 28},
    "GB": {"flood": 35, "earthquake": 28, "tropical_cyclone": 0, "volcano": 0, "landslide": 15, "storm_surge": 22},
    "IE": {"flood": 42, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 28},
    "PL": {"flood": 48, "earthquake": 18, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 0},
    "CZ": {"flood": 38, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 0},
    "SK": {"flood": 42, "earthquake": 25, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 0},
    "HU": {"flood": 45, "earthquake": 28, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 0},
    "RO": {"flood": 52, "earthquake": 45, "tropical_cyclone": 0, "volcano": 0, "landslide": 38, "storm_surge": 0},
    "BG": {"flood": 48, "earthquake": 52, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 22},
    "RS": {"flood": 52, "earthquake": 48, "tropical_cyclone": 0, "volcano": 0, "landslide": 38, "storm_surge": 0},
    "HR": {"flood": 48, "earthquake": 52, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 18},
    "BA": {"flood": 55, "earthquake": 62, "tropical_cyclone": 0, "volcano": 0, "landslide": 48, "storm_surge": 0},
    "AL": {"flood": 52, "earthquake": 65, "tropical_cyclone": 0, "volcano": 0, "landslide": 45, "storm_surge": 18},
    "MK": {"flood": 48, "earthquake": 62, "tropical_cyclone": 0, "volcano": 0, "landslide": 42, "storm_surge": 0},
    "RU": {"flood": 35, "earthquake": 42, "tropical_cyclone": 0, "volcano": 28, "landslide": 32, "storm_surge": 25},
    "UA": {"flood": 42, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 18},
    "BY": {"flood": 38, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 0},
    "LT": {"flood": 35, "earthquake": 12, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 18},
    "LV": {"flood": 38, "earthquake": 12, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 22},
    "EE": {"flood": 32, "earthquake": 12, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 28},
    "NO": {"flood": 48, "earthquake": 38, "tropical_cyclone": 0, "volcano": 0, "landslide": 35, "storm_surge": 32},
    "SE": {"flood": 35, "earthquake": 22, "tropical_cyclone": 0, "volcano": 0, "landslide": 18, "storm_surge": 25},
    "FI": {"flood": 32, "earthquake": 15, "tropical_cyclone": 0, "volcano": 0, "landslide": 12, "storm_surge": 22},
    "DK": {"flood": 35, "earthquake": 12, "tropical_cyclone": 0, "volcano": 0, "landslide": 8, "storm_surge": 28},
    "IS": {"flood": 48, "earthquake": 68, "tropical_cyclone": 0, "volcano": 52, "landslide": 38, "storm_surge": 35},

    # South Asia & Oceania
    "BN": {"flood": 68, "earthquake": 42, "tropical_cyclone": 72, "volcano": 0, "landslide": 52, "storm_surge": 58},
    "TL": {"flood": 72, "earthquake": 65, "tropical_cyclone": 75, "volcano": 48, "landslide": 68, "storm_surge": 62},
    "NZ": {"flood": 52, "earthquake": 68, "tropical_cyclone": 42, "volcano": 28, "landslide": 48, "storm_surge": 35},
    "AU": {"flood": 35, "earthquake": 45, "tropical_cyclone": 52, "volcano": 0, "landslide": 22, "storm_surge": 32},

    # Default fallback for unmapped countries (conservative low-moderate)
    "XX": {"flood": 35, "earthquake": 28, "tropical_cyclone": 0, "volcano": 0, "landslide": 22, "storm_surge": 18},
}

def score_location(lat: float, lng: float, name: Optional[str] = None, country_code: Optional[str] = None) -> Dict:
    """Compute hazard scores for a coordinate from the curated zone dataset."""
    contributions: List[Dict] = []
    for zone in HAZARD_ZONES:
        d = haversine_km(lat, lng, zone["lat"], zone["lng"])
        w = _zone_weight(d, zone["radius_km"])
        if w > 0:
            contributions.append({"zone": zone, "weight": w, "distance_km": round(d, 1)})

    has_data = len(contributions) > 0

    # If no zone data and country code provided, use country-level fallback
    country_baseline = None
    if not has_data and country_code:
        country_baseline = COUNTRY_RISK_BASELINE.get(country_code.upper())

    # If country not in explicit baseline, use conservative defaults
    if not has_data and not country_baseline:
        country_baseline = COUNTRY_RISK_BASELINE.get("XX")

    hazards = {}
    for key in HAZARD_KEYS:
        if has_data:
            # Max-weighted contribution: the dominant zone drives the hazard.
            score = max(c["zone"]["hazards"][key] * c["weight"] for c in contributions)
            score = round(score)
        else:
            # Use country-level fallback (always available now with XX default)
            score = country_baseline.get(key, 0) if country_baseline else 0

        hazards[key] = {"score": score, "label": HAZARD_LABELS[key],
                        **level_for_score(score)}

    scored = [h["score"] for h in hazards.values() if h["score"] is not None]
    if scored:
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
        "data_coverage": "covered" if has_data else ("regional" if country_baseline else "limited"),
        "confidence": "High" if (contributions and contributions[0]["weight"] >= 0.99)
        else ("Medium" if (has_data or country_baseline) else "Low"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "methodology": "Deterministic zone-based scoring (max-weighted hazard contribution, "
                       "linear distance decay). Indicative only — not an official advisory.",
    }


def compare_locations(locations: List[Dict]) -> List[Dict]:
    return [score_location(l["lat"], l["lng"], l.get("name")) for l in locations]
