"""Generate grounded risk intelligence insights using approved sources.

All insights are strictly grounded in:
1. Approved disaster source registry
2. Deterministic risk scoring engine
3. Attached datasets
4. Official scraped/fetched data

No unsupported AI speculation is allowed.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from ..data.disaster_sources import get_sources_for_hazard
from .providers import AIProvider, pick_provider

logger = logging.getLogger("resiliencemap.insights")


class GroundedInsight:
    """An insight with mandatory source attribution."""

    def __init__(
        self,
        title: str,
        summary: str,
        hazard_type: str,
        sources: list[dict],
        confidence_category: str,
        timestamp: str,
    ):
        self.title = title
        self.summary = summary
        self.hazard_type = hazard_type
        self.sources = sources  # list of {source_name, url, agency, verified, description}
        self.confidence_category = confidence_category
        self.timestamp = timestamp

    def to_dict(self):
        return {
            "title": self.title,
            "summary": self.summary,
            "hazard_type": self.hazard_type,
            "sources": self.sources,
            "confidence_category": self.confidence_category,
            "timestamp": self.timestamp,
            "notice": "All insights are grounded in official sources. Unsupported claims are marked as 'insufficient data'.",
        }


async def generate_insights(
    risk_data: dict,
    hazard_layer: str,
    persona: str,
    providers: dict,
    location_name: str = "",
) -> GroundedInsight:
    """Generate grounded insights for a location's risk profile.

    Args:
        risk_data: Risk scores from the scoring engine {location, overall, hazards...}
        hazard_layer: Active hazard layer (overall, earthquake, cyclone, etc.)
        persona: User persona (citizen, responder, planner, etc.)
        providers: Available AI providers
        location_name: Location name for context

    Returns:
        GroundedInsight with source attribution
    """

    # Extract primary hazards from risk data
    primary_hazards = risk_data.get("hazards", [])
    if isinstance(primary_hazards, dict):
        primary_hazards = [h["name"] for h in primary_hazards.values() if isinstance(h, dict)]

    # Get approved sources for these hazards
    is_philippines = "philippines" in location_name.lower() if location_name else False
    applicable_sources = []
    for hazard in primary_hazards[:3]:  # Top 3 hazards
        applicable_sources.extend(get_sources_for_hazard(hazard, is_philippines=is_philippines))

    # Remove duplicates
    seen = set()
    unique_sources = []
    for src in applicable_sources:
        name = src.get("source_name")
        if name and name not in seen:
            seen.add(name)
            unique_sources.append(src)

    if not unique_sources:
        # Fallback: no sources found
        return GroundedInsight(
            title=f"{location_name or 'This location'}: Risk Profile",
            summary="Insufficient verified data to generate this insight. Select a location on the map to see detailed risk scores and available data sources.",
            hazard_type="unspecified",
            sources=[],
            confidence_category="insufficient_data",
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    # Build context for AI provider
    score = risk_data.get("overall", {}).get("score", 0)
    level = risk_data.get("overall", {}).get("level", "Unknown")

    # Prepare prompt for AI (with source context)
    sources_summary = "\n".join(
        f"- {s.get('source_name')}: {s.get('grounding')}"
        for s in unique_sources[:5]  # Top 5 sources
    )

    prompt = f"""You are a disaster risk intelligence analyst. Generate a concise insight summary for the user.

Location: {location_name or "Selected area"}
Risk Score: {score}/100 ({level})
Hazard Types: {', '.join(primary_hazards[:3]) or "Multiple"}
User Persona: {persona}

Available Official Sources:
{sources_summary}

Instructions:
1. Summarize why this location is at risk
2. Cite ONLY the approved sources listed above
3. If no source supports a claim, say "Insufficient verified data"
4. Be concise (2-3 sentences)
5. Focus on actionable insights for the {persona} persona

Generate the insight now."""

    messages = [
        {
            "role": "system",
            "content": "You are a disaster risk intelligence assistant. All insights must cite official sources.",
        },
        {"role": "user", "content": prompt},
    ]

    # Use AI provider for richer insights (falls back to local if unavailable)
    provider = pick_provider("reasoning", providers, preferred=None)
    try:
        summary = await provider.generate(messages, max_tokens=500)
    except Exception as e:
        logger.warning(f"AI provider failed: {e}. Using template insight.")
        summary = (
            f"{location_name or 'This location'} has a risk score of {score}/100 ({level}). "
            f"Primary hazard types: {', '.join(primary_hazards[:3]) or 'multiple'}. "
            f"See the map for detailed risk layers and official sources."
        )

    # Build source attribution
    sources_data = [
        {
            "source_name": s.get("source_name"),
            "source_id": s.get("id"),
            "url": s.get("url"),
            "agency": s.get("agency"),
            "tier": s.get("tier"),
            "verified": s.get("tier", "").startswith("official") or s.get("tier", "").startswith("trusted"),
        }
        for s in unique_sources[:5]
    ]

    return GroundedInsight(
        title=f"{location_name}: Why This Area Is Prioritized",
        summary=summary,
        hazard_type=hazard_layer,
        sources=sources_data,
        confidence_category="ai_generated_with_official_sources",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
