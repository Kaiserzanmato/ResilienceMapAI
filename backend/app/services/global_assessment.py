"""Traceable multi-hazard assessment contract built on deterministic engines.

This layer deliberately does not fabricate coverage: unconnected providers and
hazards without registered sources remain insufficient-data.
"""
from datetime import datetime, timezone
from typing import Any

from ..data.sample_hazards import HAZARD_LABELS
from .coverage_registry import providers_for, registry, supported_hazards
from .risk_scoring import ENGINE_VERSION, level_for_score, score_location

LEGACY_TO_GLOBAL = {"storm_surge": "coastal_exposure"}


def _geometry(kind: str | None) -> dict[str, Any]:
    requested = kind or "point"
    allowed = {"point", "building-footprint", "parcel", "drawn-boundary", "uploaded-boundary", "search-bounding-box"}
    if requested not in allowed:
        requested = "point"
    confidence = "high" if requested in {"building-footprint", "parcel", "drawn-boundary", "uploaded-boundary"} else "low"
    return {"type": requested, "fallback_used": requested == "point", "confidence": confidence, "default_buffers_m": [50, 100, 500]}


def assess_location(lat: float, lng: float, name: str | None = None, country_code: str | None = None,
                    geometry_type: str | None = None) -> dict[str, Any]:
    legacy = score_location(lat, lng, name, country_code)
    hazards: dict[str, Any] = {}
    for hazard in supported_hazards():
        providers, uses_global_fallback = providers_for(country_code, hazard)
        legacy_key = next((key for key, value in LEGACY_TO_GLOBAL.items() if value == hazard), hazard)
        legacy_value = legacy["hazards"].get(legacy_key, {})
        score = legacy_value.get("score") if legacy_key in HAZARD_LABELS else None
        selected = next((provider for provider in providers if provider["status"] == "configured"), None)
        limitations = []
        if not providers:
            limitations.append("No approved provider is registered for this hazard and country.")
        elif selected is None:
            limitations.append("A source is registered but no production connector is configured; no score was calculated from it.")
        if uses_global_fallback:
            limitations.append("No country-specific source is registered; the global fallback is shown with reduced confidence.")
        # Curated legacy scores are retained only as explicitly modelled indicators.
        if score is not None and selected and legacy["data_coverage"] != "limited":
            evidence = [{"source": "ResilienceMap curated zone dataset", "source_type": "modelled", "timestamp": legacy["generated_at"], "raw_value": score, "normalized_value": score, "uncertainty": "Indicative zone-based model; not a parcel-level measurement.", "cache_policy": "request"}]
            confidence = "medium" if selected and not uses_global_fallback else "low"
        else:
            score, evidence, confidence = None, [], "none"
        hazards[hazard] = {
            "hazard": hazard,
            "label": HAZARD_LABELS.get(legacy_key, hazard.replace("_", " ").title()),
            "classification": level_for_score(score)["level"].lower().replace(" ", "-"),
            "score": score,
            "confidence": confidence,
            "source_quality": selected["reliability"] if selected else "none",
            "coverage_status": selected["coverage"] if selected else "unavailable",
            "sources": providers,
            "evidence": evidence,
            "limitations": limitations,
        }
    scored = [(key, value["score"]) for key, value in hazards.items() if value["score"] is not None]
    return {
        "location": {"name": name or legacy["location_name"], "latitude": lat, "longitude": lng, "country_code": country_code.upper() if country_code else None},
        "assessment_geometry": _geometry(geometry_type),
        "hazards": hazards,
        "multi_hazard_summary": {"highest_priority_hazards": [key for key, _ in sorted(scored, key=lambda item: item[1], reverse=True)[:3]], "coverage_score": round(100 * len(scored) / len(hazards))},
        "scoring_version": ENGINE_VERSION,
        "coverage_registry_version": registry()["version"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "This is a screening result, not an official certification or a finding that a location is safe or unsuitable.",
    }
