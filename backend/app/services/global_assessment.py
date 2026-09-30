"""Traceable multi-hazard assessment contract built on deterministic engines.

This layer deliberately does not fabricate coverage: unconnected providers and
hazards without registered sources remain insufficient-data.
"""
from datetime import datetime, timezone
from typing import Any

from ..data.sample_hazards import HAZARD_LABELS
from .country_lookup import country_for_point
from .coverage_registry import providers_for, registry, supported_hazards
from .risk_scoring import ENGINE_VERSION, level_for_score, score_location

LEGACY_TO_GLOBAL = {"storm_surge": "coastal_exposure"}
# The registry only permits a legacy modelled value where the assessment
# contract explicitly supports it. Other configured connectors must return
# their own verified observations before they can produce a numeric score.
MODELLED_LEGACY_HAZARDS = {"earthquake"}


def _geometry(kind: str | None) -> dict[str, Any]:
    requested = kind or "point"
    allowed = {"point", "building-footprint", "parcel", "drawn-boundary", "uploaded-boundary", "search-bounding-box"}
    if requested not in allowed:
        requested = "point"
    confidence = "high" if requested in {"building-footprint", "parcel", "drawn-boundary", "uploaded-boundary"} else "low"
    return {"type": requested, "fallback_used": requested == "point", "confidence": confidence, "default_buffers_m": [50, 100, 500]}


def _coverage_state(score: float | None, providers: list, selected: dict | None,
                    country_code: str | None, legacy_coverage: str) -> tuple[str, str]:
    """Closed-vocabulary coverage_status + reason_code (public display decision, section 4)."""
    if score is not None:
        return "available", "modelled_indicator"
    if not providers:
        return "out_of_coverage", "no_registered_source"
    if selected is None:
        return "unavailable", "connector_not_configured"
    if legacy_coverage == "limited":
        return ("out_of_coverage", "outside_modelled_coverage") if country_code else ("unknown", "country_unresolved")
    return "unavailable", "no_verified_evidence"


def _indicative(legacy_value: dict, legacy_coverage: str) -> dict[str, Any]:
    """Legacy curated/baseline value, exposed separately so it is never read as a verified score."""
    value = legacy_value.get("score")
    # Baselines use 0 for "not modelled"; zero must never stand in for no-data.
    if not value:
        return {"indicative_score": None}
    return {
        "indicative_score": value,
        "indicative_source_type": "curated-zone-model" if legacy_coverage == "covered" else "modelled-baseline",
        "indicative_confidence": "low",
    }


def assess_location(lat: float, lng: float, name: str | None = None, country_code: str | None = None,
                    geometry_type: str | None = None) -> dict[str, Any]:
    country_code = (country_code or country_for_point(lat, lng) or None)
    legacy = score_location(lat, lng, name, country_code)
    hazards: dict[str, Any] = {}
    for hazard in supported_hazards():
        providers, uses_global_fallback = providers_for(country_code, hazard)
        legacy_key = next((key for key, value in LEGACY_TO_GLOBAL.items() if value == hazard), hazard)
        legacy_value = legacy["hazards"].get(legacy_key, {})
        score = (legacy_value.get("score") if hazard in MODELLED_LEGACY_HAZARDS
                 and legacy_key in HAZARD_LABELS else None)
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
        coverage_status, reason_code = _coverage_state(score, providers, selected, country_code, legacy["data_coverage"])
        indicative = _indicative(legacy_value, legacy["data_coverage"]) if score is None and legacy_key in HAZARD_LABELS else {"indicative_score": None}
        hazards[hazard] = {
            "hazard": hazard,
            "label": HAZARD_LABELS.get(legacy_key, hazard.replace("_", " ").title()),
            "classification": level_for_score(score)["level"].lower().replace(" ", "-"),
            "score": score,
            "confidence": confidence,
            "source_quality": selected["reliability"] if selected else "none",
            "coverage_status": coverage_status,
            "reason_code": reason_code,
            "registry_coverage": selected["coverage"] if selected else None,
            **indicative,
            "sources": providers,
            "evidence": evidence,
            "limitations": limitations,
        }
    scored = [(key, value["score"]) for key, value in hazards.items() if value["score"] is not None]
    return {
        "location": {"name": name or legacy["location_name"], "latitude": lat, "longitude": lng, "country_code": country_code.upper() if country_code else None},
        "assessment_geometry": _geometry(geometry_type),
        "hazards": hazards,
        "multi_hazard_summary": {"highest_priority_hazards": [key for key, _ in sorted(scored, key=lambda item: item[1], reverse=True)[:3]], "coverage_score": round(100 * len(scored) / len(hazards)), "components_available": len(scored), "components_total": len(hazards)},
        "scoring_version": ENGINE_VERSION,
        "coverage_registry_version": registry()["version"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "This is a screening result, not an official certification or a finding that a location is safe or unsuitable.",
    }
