"""Ask AI / AI Agent with grounded disaster intelligence guardrails.

This module enforces scope checking, source attribution, and approved source usage.
All user queries are classified as in-scope (disaster/hazard/resilience) or
out-of-scope. Only in-scope queries can retrieve live data from approved sources.
"""

import re
from datetime import datetime, timezone
from typing import Literal, Optional, List

from ..data.disaster_sources import DISASTER_SOURCES, get_sources_for_hazard
from .ai_router import generate_insight
from .risk_scoring import score_location

# Scope classification patterns
IN_SCOPE_PATTERNS = [
    r"\b(earthquakes?|seismic|shaking|fault|landslides?|volcanoes?|eruption|ashfall|lahar)\b",
    r"(tsunami|tidal wave|wave)",
    r"\b(cyclones?|typhoons?|hurricane|storm|tropical|wind|gale)\b",
    r"\b(floods?|overflow|inundation|river|rainfall|rain|water level)\b",
    r"\b(drought|dryness|water scarcity)\b",
    r"\b(wildfires?|forest fire|bushfire|thermal anomaly|hotspot)\b",
    r"\b(heat|temperature|heat index|heat wave)\b",
    r"\b(weather|meteorology|climate|precipitation|hail|lightning|thunderstorm)\b",
    r"\b(hazards?|risk|danger|threat|warning|advisory|alert)\b",
    r"\b(disasters?|calamity|emergency|crisis|catastrophe)\b",
    r"\b(resilience|preparedness|response|recovery|risk reduction|drr)\b",
    r"\b(satellite|remote sensing|earth observation|monitoring|detection)\b",
    r"\b(evacuation|shelter|aid|relief|humanitarian|response)\b",
    r"\b(exposure|vulnerability|adaptation|mitigation)\b",
]

OUT_OF_SCOPE_PATTERNS = [
    r"\b(sports|game|score|win|lose|match)\b",
    r"\b(music|song|artist|concert|album)\b",
    r"\b(movie|film|tv|series|watch|entertainment)\b",
    r"\b(restaurant|food|cook|recipe|dining)\b",
    r"\b(politics|election|vote|candidate|party)\b",
    r"\b(celebrity|gossip|famous|actor|actress)\b",
]


def classify_query_scope(query: str) -> Literal["in_scope", "out_of_scope"]:
    """Classify user query as in-scope or out-of-scope for Ask AI."""
    lower_query = query.lower()

    # Check out-of-scope patterns first
    for pattern in OUT_OF_SCOPE_PATTERNS:
        if re.search(pattern, lower_query, re.IGNORECASE):
            return "out_of_scope"

    # Check in-scope patterns
    for pattern in IN_SCOPE_PATTERNS:
        if re.search(pattern, lower_query, re.IGNORECASE):
            return "in_scope"

    # Default: out of scope
    return "out_of_scope"


async def ask_ai_guardrailed(
    query: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    location_name: Optional[str] = None,
    persona: str = "technical",
    provider: Optional[str] = None,
) -> dict:
    """Execute Ask AI with guardrails: scope checking and source attribution.

    Returns:
      {
        "status": "in_scope" | "out_of_scope",
        "message": str,
        "sources": [{"source_id": str, "source_name": str, "url": str, ...}],
        "answer": str,
        "confidence_category": str,
        "disclaimer": str,
      }
    """

    # 1. Classify scope
    scope = classify_query_scope(query)

    if scope == "out_of_scope":
        return {
            "status": "out_of_scope",
            "message": "I can only answer questions related to Resilience Map AI, disaster intelligence, hazard monitoring, and resilience mapping.",
            "sources": [],
            "answer": None,
            "confidence_category": None,
            "disclaimer": None,
        }

    # 2. For in-scope queries, extract hazard types and location context
    is_philippines = False
    if location_name:
        is_philippines = any(ph_term in location_name.lower() for ph_term in ["philippines", "ph", "manila", "davao", "cebu"])

    # Identify hazard types mentioned in query
    hazard_types = _extract_hazard_types(query)

    # Get applicable sources
    applicable_sources = []
    if hazard_types:
        for hazard in hazard_types:
            applicable_sources.extend(get_sources_for_hazard(hazard, is_philippines=is_philippines))
    else:
        # If no specific hazard, use general sources for the region
        if is_philippines:
            applicable_sources = [DISASTER_SOURCES.get(sid) for sid in ["SRC-002", "SRC-003", "SRC-008", "SRC-012"]]

    # Remove duplicates
    applicable_sources = list({s.get("source_name"): s for s in applicable_sources if s}.values())

    # 3. Score the selected location if coordinates are provided
    risk = None
    if lat is not None and lng is not None:
        try:
            risk = score_location(lat, lng, location_name)
        except Exception:
            pass

    # 4. Call the AI router with full risk context + attribution
    try:
        result = await generate_insight(
            "agent",
            risk,
            query,
            persona,
            provider,
        )

        return {
            "status": "in_scope",
            "message": "Query processed with Resilience Map AI guardrails.",
            "sources": [
                {
                    "source_id": s.get("source_name", "unknown"),
                    "source_name": s.get("source_name", "unknown"),
                    "url": s.get("url", ""),
                    "agency": s.get("agency", ""),
                    "scope": s.get("scope", ""),
                    "tier": s.get("tier", ""),
                }
                for s in applicable_sources
            ],
            "answer": result.get("answer"),
            "confidence_category": "model_response",
            "disclaimer": (
                "This response is generated by an AI model. It is based on approved disaster "
                "intelligence sources. Always verify critical information with official agencies: "
                "PAGASA (weather), PHIVOLCS (earthquakes/volcanoes), NDRRMC (disaster response), "
                "and other official sources for your region."
            ),
        }
    except Exception as e:
        return {
            "status": "in_scope",
            "message": f"Error processing query: {str(e)}",
            "sources": applicable_sources,
            "answer": None,
            "confidence_category": "error",
            "disclaimer": None,
        }


def _extract_hazard_types(query: str) -> List[str]:
    """Extract hazard types mentioned in query."""
    hazard_keywords = {
        "earthquake": ["earthquake", "seismic", "tremor", "quake"],
        "volcano": ["volcano", "volcanic", "eruption", "ashfall", "lahar"],
        "tsunami": ["tsunami", "tidal wave"],
        "tropical cyclone": ["typhoon", "cyclone", "hurricane", "storm"],
        "flood": ["flood", "flooding", "overflow", "inundation"],
        "wildfire": ["fire", "wildfire", "bushfire"],
        "heat": ["heat", "temperature", "heat index"],
        "weather": ["weather", "rainfall", "rain"],
        "landslide": ["landslide", "landslip"],
    }

    found = []
    lower_query = query.lower()
    for hazard, keywords in hazard_keywords.items():
        for keyword in keywords:
            if keyword in lower_query:
                found.append(hazard)
                break

    return list(set(found))
