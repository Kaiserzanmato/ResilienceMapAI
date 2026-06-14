"""Query classification and routing for AI agent.

Classifies user queries into intent types and routes to appropriate data sources:
- Location Query: Get risk profile for a specific location
- Ranking Query: Find top-risk locations by hazard
- Comparison Query: Compare risks between multiple locations
- Conflict Query: Find areas with high conflict/war risk
- Source Query: Provide information about data sources
"""
import re
from typing import Dict, List, Optional, Tuple

from ..data.sample_hazards import HAZARD_LABELS, HAZARD_ZONES
from .risk_scoring import score_location, COUNTRY_RISK_BASELINE


class QueryIntent:
    """Query classification results."""
    LOCATION = "location"  # "What is the risk in Davao?"
    RANKING = "ranking"  # "What are the highest flood-risk locations?"
    COMPARISON = "comparison"  # "Compare Manila and Jakarta"
    CONFLICT = "conflict"  # "Which areas have conflict risk?"
    SOURCE = "source"  # "What sources support this?"
    GENERAL = "general"  # Generic question about disasters


def classify_query(text: str) -> Tuple[str, Dict]:
    """Classify query intent and extract parameters.

    Returns:
        (intent_type, parameters_dict)
    """
    lower_text = text.lower().strip()

    # Source queries
    if any(word in lower_text for word in ["source", "where did", "how do you know", "citation", "reference", "data from"]):
        return QueryIntent.SOURCE, {"query": text}

    # Ranking queries - detect patterns like "highest", "top", "worst", "most"
    if any(word in lower_text for word in ["highest", "top ", "worst", "most ", "rank", "which areas", "where are"]):
        # Extract hazard type if mentioned
        hazard = None
        for hkey, hlabel in HAZARD_LABELS.items():
            if hkey.replace("_", " ") in lower_text or hlabel.lower() in lower_text:
                hazard = hkey
                break

        if hazard or "risk" in lower_text or "hazard" in lower_text:
            return QueryIntent.RANKING, {"query": text, "hazard": hazard}

    # Conflict queries
    if any(word in lower_text for word in ["conflict", "war", "fighting", "geopolitical", "political stability", "violence"]):
        return QueryIntent.CONFLICT, {"query": text}

    # Comparison queries - detect "compare", "vs", "versus", "difference", "which is more"
    if any(word in lower_text for word in ["compare", " vs ", "versus", "difference", "which is more", "which is higher"]):
        # Try to extract location names
        locations = []
        # Simple pattern matching for common location names
        location_patterns = [
            "manila", "jakarta", "davao", "cebu", "tokyo", "lagos", "cairo", "bangkok",
            "beirut", "gaza", "damascus", "aleppo", "baghdad", "kabul"
        ]
        for loc in location_patterns:
            if loc in lower_text:
                locations.append(loc)

        if len(locations) >= 2:
            return QueryIntent.COMPARISON, {"query": text, "locations": locations[:2]}
        elif len(locations) == 1:
            return QueryIntent.COMPARISON, {"query": text, "locations": locations}

    # Location queries - "What is the risk in X?" or "Tell me about X"
    # Try to extract location from common patterns
    location_match = re.search(r"(?:in|at|for|about)\s+([a-z\s]+?)(?:\?|$|and)", lower_text)
    if location_match:
        location = location_match.group(1).strip()
        if location and len(location) > 2:
            return QueryIntent.LOCATION, {"query": text, "location": location}

    return QueryIntent.GENERAL, {"query": text}


def get_top_risk_locations(hazard: Optional[str] = None, limit: int = 5) -> List[Dict]:
    """Get top risk locations by hazard type or overall risk.

    Returns sorted list of locations with scores.
    """
    results = []

    # Calculate scores for all zones
    for zone in HAZARD_ZONES:
        overall = round(0.65 * max(zone["hazards"].values()) + 0.35 * (sum(zone["hazards"].values()) / len(zone["hazards"])))

        if hazard and hazard in zone["hazards"]:
            score = zone["hazards"][hazard]
        else:
            score = overall

        results.append({
            "name": zone["name"],
            "country": zone["country"],
            "score": score,
            "overall": overall,
            "hazards": zone["hazards"],
            "population": zone["population"],
        })

    # Sort by hazard-specific score or overall
    if hazard:
        results.sort(key=lambda x: x["score"], reverse=True)
    else:
        results.sort(key=lambda x: x["overall"], reverse=True)

    return results[:limit]


def get_conflict_high_risk_areas() -> List[Dict]:
    """Get areas with high conflict risk.

    Returns locations ranked by conflict risk.
    """
    # Countries with high conflict risk from COUNTRY_RISK_BASELINE
    conflict_countries = [
        ("YE", "Yemen", 55),  # Yemen
        ("SY", "Syria", 50),  # Syria
        ("IQ", "Iraq", 48),  # Iraq
        ("AF", "Afghanistan", 45),  # Afghanistan
        ("PS", "Palestine", 55),  # Palestine
        ("LB", "Lebanon", 45),  # Lebanon
        ("ZA", "South Africa", 35),  # South Africa (internal conflict)
        ("SO", "Somalia", 65),  # Somalia
    ]

    return [
        {"country": country, "name": country, "conflict_risk": score}
        for code, country, score in conflict_countries
    ]


def compare_locations(loc_names: List[str]) -> Dict:
    """Compare risk profiles for multiple locations.

    Returns comparison data with side-by-side analysis.
    """
    results = []

    for loc_name in loc_names:
        # Try to find in HAZARD_ZONES
        for zone in HAZARD_ZONES:
            if zone["name"].lower() == loc_name.lower() or loc_name.lower() in zone["name"].lower():
                overall = round(0.65 * max(zone["hazards"].values()) + 0.35 * (sum(zone["hazards"].values()) / len(zone["hazards"])))
                results.append({
                    "name": zone["name"],
                    "country": zone["country"],
                    "overall": overall,
                    "hazards": zone["hazards"],
                    "population": zone["population"],
                })
                break

    return {
        "locations": results,
        "count": len(results),
        "note": "Comparison based on HAZARD_ZONES curated data"
    }


def format_ranking_response(intent: str, hazard: Optional[str], locations: List[Dict]) -> str:
    """Format ranking query results as readable text."""
    if not locations:
        return "No data available for this query."

    hazard_label = HAZARD_LABELS.get(hazard, "Overall Risk") if hazard else "Overall Risk"

    response = f"## Top Risk Locations — {hazard_label}\n\n"

    for i, loc in enumerate(locations, 1):
        score = loc.get("score") or loc.get("overall", 0)
        level = "High" if score > 60 else "Medium" if score > 25 else "Low"
        response += f"{i}. **{loc['name']}, {loc['country']}** — Risk: {score}/100 ({level})\n"
        response += f"   Population: {loc.get('population', 'N/A'):,}\n"

    response += "\n_Source: ResilienceMap curated hazard zones with global country-level baselines._"
    return response


def format_comparison_response(locations: List[Dict]) -> str:
    """Format comparison query results."""
    if not locations:
        return "Could not find comparison data for requested locations."

    if len(locations) < 2:
        return f"Comparison requires at least 2 locations. Only found: {locations[0]['name']}"

    response = f"## Risk Comparison: {locations[0]['name']} vs {locations[1]['name']}\n\n"

    for loc in locations:
        response += f"### {loc['name']}, {loc['country']}\n"
        response += f"**Overall Risk:** {loc.get('overall', 0)}/100\n"
        response += f"**Population:** {loc.get('population', 'N/A'):,}\n"
        response += "**Hazard Profile:**\n"

        for hkey, hscore in sorted(loc.get('hazards', {}).items(), key=lambda x: x[1], reverse=True)[:5]:
            if hscore > 0:
                response += f"  - {HAZARD_LABELS.get(hkey, hkey)}: {hscore}/100\n"
        response += "\n"

    response += "_Source: ResilienceMap curated hazard analysis._"
    return response


def format_conflict_response(areas: List[Dict]) -> str:
    """Format conflict query results."""
    response = "## High Conflict Risk Areas\n\n"

    for area in areas:
        response += f"- **{area['name']}** — Conflict Risk: {area['conflict_risk']}/100\n"

    response += "\n_Note: Conflict risk assessed from geopolitical context and internal stability indicators. "
    response += "This is indicative — always reference official government and humanitarian organizations for current status._"
    return response
