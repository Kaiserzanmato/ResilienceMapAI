"""Aggregated, deterministic dashboard statistics computed from the curated
zone dataset. Served to the executive dashboard as ready-to-chart payloads."""
from collections import Counter
from typing import Dict

from ..data.sample_hazards import (ACTIVE_ALERTS, HAZARD_EVENTS, HAZARD_KEYS,
                                   HAZARD_LABELS, HAZARD_ZONES)
from .risk_scoring import level_for_score


def _zone_overall(zone: Dict) -> int:
    scored = list(zone["hazards"].values())
    return round(0.65 * max(scored) + 0.35 * (sum(scored) / len(scored)))


def dashboard_stats() -> Dict:
    overalls = {z["id"]: _zone_overall(z) for z in HAZARD_ZONES}
    levels = {zid: level_for_score(s)["level"] for zid, s in overalls.items()}

    high_zones = [z for z in HAZARD_ZONES if levels[z["id"]] == "High"]
    medium_zones = [z for z in HAZARD_ZONES if levels[z["id"]] == "Medium"]

    hazard_avgs = {
        k: round(sum(z["hazards"][k] for z in HAZARD_ZONES) / len(HAZARD_ZONES))
        for k in HAZARD_KEYS
    }
    top_driver_key = max(hazard_avgs, key=lambda k: hazard_avgs[k])

    dist = Counter(levels.values())

    events_by_year = Counter(e["year"] for e in HAZARD_EVENTS)
    year_series = [{"year": y, "events": events_by_year[y]}
                   for y in sorted(events_by_year)]

    top_locations = sorted(
        ({"name": z["name"], "country": z["country"], "score": overalls[z["id"]],
          **level_for_score(overalls[z["id"]])}
         for z in HAZARD_ZONES),
        key=lambda x: x["score"], reverse=True,
    )[:8]

    def exposure(zones):
        return {
            "population": sum(z["population"] for z in zones),
            "critical_facilities": sum(z["critical_facilities"] for z in zones),
            "schools": sum(z["schools"] for z in zones),
            "hospitals": sum(z["hospitals"] for z in zones),
        }

    high_exp = exposure(high_zones)
    med_exp = exposure(medium_zones)

    severity_rank = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4, "Moderate": 2}
    alert_trend = [
        {"label": a["title"], "severity": a["severity"],
         "rank": severity_rank.get(a["severity"], 1)}
        for a in ACTIVE_ALERTS
    ]

    return {
        "kpis": {
            "average_risk": round(sum(overalls.values()) / len(overalls)),
            "high_risk_areas": len(high_zones),
            "active_alerts": len(ACTIVE_ALERTS),
            "main_driver": HAZARD_LABELS[top_driver_key],
            "population_exposed": high_exp["population"],
            "critical_facilities_exposed": high_exp["critical_facilities"],
            "schools_exposed": high_exp["schools"],
            "hospitals_exposed": high_exp["hospitals"],
        },
        "risk_distribution": [
            {"level": lvl, "count": dist.get(lvl, 0),
             "color": level_for_score({"Low": 10, "Medium": 40, "High": 80}[lvl])["color"]}
            for lvl in ["Low", "Medium", "High"]
        ],
        "hazard_breakdown": [
            {"hazard": HAZARD_LABELS[k], "average": hazard_avgs[k],
             "max": max(z["hazards"][k] for z in HAZARD_ZONES)}
            for k in HAZARD_KEYS
        ],
        "events_by_year": year_series,
        "top_locations": top_locations,
        "exposure_by_sector": [
            {"sector": "Population", "high": high_exp["population"], "medium": med_exp["population"]},
            {"sector": "Critical Facilities", "high": high_exp["critical_facilities"], "medium": med_exp["critical_facilities"]},
            {"sector": "Schools", "high": high_exp["schools"], "medium": med_exp["schools"]},
            {"sector": "Hospitals", "high": high_exp["hospitals"], "medium": med_exp["hospitals"]},
        ],
        "alert_trend": alert_trend,
        "recent_events": sorted(HAZARD_EVENTS, key=lambda e: e["year"], reverse=True)[:6],
    }
