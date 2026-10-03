"""Traceable multi-hazard assessment contract built on deterministic engines.

This layer deliberately does not fabricate coverage: unconnected providers and
hazards without registered sources remain insufficient-data.
"""
from datetime import datetime, timezone
from typing import Any

from ..config import get_settings
from ..data.sample_hazards import HAZARD_LABELS
from .country_lookup import country_for_point
from .coverage_registry import providers_for, registry, supported_hazards
from .risk_scoring import ENGINE_VERSION, level_for_score, score_location
from .volcano_scoring import LABEL as VOLCANO_LABEL, PHIVOLCS_URL, score_volcano, volcano_data, volcano_note
from .wildfire_scoring import FireContext, assess_wildfire, wildfire_note, LABEL as WILDFIRE_LABEL

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


def _modelled_evidence(score: float, data_coverage: str, timestamp: str) -> dict[str, Any]:
    """Evidence record for a legacy modelled value, labelled by what actually produced it.

    `covered`: the point falls inside a curated hazard zone. `regional`: no zone
    covers the point, so the value is the country-level baseline; it must not be
    presented as local, zone-level evidence."""
    common = {"timestamp": timestamp, "raw_value": score, "normalized_value": score, "cache_policy": "request"}
    if data_coverage == "regional":
        return {
            "source": "ResilienceMap country risk baseline",
            "source_type": "modelled-baseline",
            "uncertainty": "Country-level baseline; not local detail for this location.",
            "resolution": "country",
            **common,
        }
    return {
        "source": "ResilienceMap curated zone dataset",
        "source_type": "modelled",
        "uncertainty": "Indicative zone-based model; not a parcel-level measurement.",
        **common,
    }


def _coverage_state(score: float | None, providers: list, selected: dict | None,
                    country_code: str | None, legacy_coverage: str) -> tuple[str, str]:
    """Closed-vocabulary coverage_status + reason_code (public display decision, section 4).
    Honest, specific no-data reasons — never a generic "temporarily unavailable" catch-all:
    `not_covered` (no source is even registered), `no_connected_source` (a source is
    registered — e.g. GloFAS, IBTrACS — but nothing is wired up to it yet) and
    `no_verified_evidence` (a connector IS configured but produced nothing for this spot).
    Volcano's own `licence_pending` case is applied by the caller, which alone knows about
    ENABLE_VOLCANIC_SCORING."""
    if score is not None:
        return "available", "modelled_indicator"
    if not providers:
        return "out_of_coverage", "not_covered"
    if selected is None:
        return "unavailable", "no_connected_source"
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


def _satellite_fire(fire: FireContext | None, lat: float, lng: float) -> dict[str, Any]:
    """The wildfire hazard from FIRMS detections, scored or an honest no-data."""
    settings = get_settings()
    result = assess_wildfire(fire, lat, lng, settings.nasa_firms_area)
    source = {"id": "nasa-firms", "name": "NASA FIRMS (VIIRS active-fire detections)"}
    if result["score"] is None:
        return {"score": None, "coverage_status": result["coverage_status"], "reason_code": result["reason_code"],
                "limitations": [f"Wildfire is {WILDFIRE_LABEL}; no score is given without fresh, covered detection data ({result['reason_code']})."],
                "evidence": [], "confidence": "none"}
    return {
        "score": result["score"], "coverage_status": "available", "reason_code": result["reason_code"], "confidence": "medium",
        "note": wildfire_note(result),
        "limitations": [f"Scored from {WILDFIRE_LABEL}; it also sees agricultural burning."],
        "evidence": [{"source": source["name"], "source_type": "observed", "timestamp": result["last_seen"],
                      "raw_value": result["count_30d"], "normalized_value": result["score"], "cache_policy": "request",
                      "uncertainty": "A detection is a hot pixel, not an assessed hazard.", "resolution": "375 m",
                      "details": {k: result[k] for k in ("radius_km", "count_7d", "count_30d", "nearest_km", "last_seen", "history_days")}}],
    }


def _volcanic(volcano: dict[str, Any]) -> dict[str, Any]:
    source = volcano_data()["source"]  # present: a score exists only when the data loaded
    return {
        "score": volcano["score"], "coverage_status": "available", "reason_code": "volcano_distance_band", "confidence": "medium",
        "note": volcano_note(volcano),
        "link": {"label": "PHIVOLCS volcano bulletins (alert level not live here)", "url": PHIVOLCS_URL},
        "limitations": [f"Scored from {VOLCANO_LABEL}. The current PHIVOLCS alert level is not included: no reliable machine-readable source."],
        "evidence": [{"source": source["name"], "source_type": "static-reference", "timestamp": source.get("retrieved"),
                      "raw_value": round(volcano["driver"]["distance_km"], 1), "normalized_value": volcano["score"],
                      "cache_policy": "static", "uncertainty": "Distance to the nearest volcano; not a forecast.",
                      "details": {"volcano": volcano["driver"]["name"], "status": volcano["driver"]["status"],
                                  "last_eruption_year": volcano["driver"].get("last_eruption_year")}}],
    }


def assess_location(lat: float, lng: float, name: str | None = None, country_code: str | None = None,
                    geometry_type: str | None = None, fire: FireContext | None = None) -> dict[str, Any]:
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
            evidence = [_modelled_evidence(score, legacy["data_coverage"], legacy["generated_at"])]
            # A country-level baseline is never better than low confidence.
            is_baseline = legacy["data_coverage"] == "regional"
            confidence = "low" if is_baseline or uses_global_fallback else "medium"
        else:
            score, evidence, confidence = None, [], "none"
        coverage_status, reason_code = _coverage_state(score, providers, selected, country_code, legacy["data_coverage"])
        if hazard == "volcano" and score is None and not get_settings().enable_volcanic_scoring:
            # PHIVOLCS data permission is pending, not "no connected source" — GVP alone
            # (volcano_scoring.py) already locates volcanoes; the live alert feed is what's
            # blocked. See memory: keep this off until written PHIVOLCS permission.
            coverage_status, reason_code = "unavailable", "licence_pending"
        # Satellite- and distance-based rows that do not go through the legacy zone model.
        observed: dict[str, Any] = {}
        if hazard == "wildfire" and get_settings().enable_wildfire_scoring and selected is not None and fire is not None:
            observed = _satellite_fire(fire, lat, lng)
        elif hazard == "volcano" and get_settings().enable_volcanic_scoring:
            volcano = score_volcano(lat, lng, country_code)
            observed = _volcanic(volcano) if volcano is not None else {}
        if observed.get("score") is not None or (hazard == "wildfire" and observed):
            score, evidence, confidence = observed["score"], observed["evidence"], observed["confidence"]
            coverage_status, reason_code = observed["coverage_status"], observed["reason_code"]
            limitations = [*limitations, *observed["limitations"]]
        # Volcanic has no zone-model indicator (score_location returns it unscored), so a
        # disabled or data-less Volcanic row carries no number at all.
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
            **({"note": observed["note"]} if observed.get("note") else {}),
            **({"link": observed["link"]} if observed.get("link") else {}),
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


def _parse_health_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value) if isinstance(value, str) else value
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def load_fire_context(lat: float, lng: float) -> FireContext | None:
    """FIRMS detections near the point plus FIRMS sync health, or None when scoring is off
    or either store cannot be read (a missing table, a database error): the wildfire row
    then stays honest no-data instead of failing the whole assessment. Freshness and
    history length come from sync health, never from the detections themselves — see
    FireContext and wildfire_scoring's module docstring."""
    import logging
    from datetime import timedelta
    from ..repositories.fire_repo import get_fire_repo
    from ..repositories.sync_health_repo import get_sync_health_repo
    from .wildfire_scoring import RADIUS_KM, WINDOW_DAYS

    if not get_settings().enable_wildfire_scoring:
        return None
    try:
        since = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
        nearby = await get_fire_repo().context(lat, lng, RADIUS_KM, since)
        health = await get_sync_health_repo().get("nasa-firms")
        return FireContext(
            nearby,
            last_successful_sync_at=_parse_health_timestamp(health.get("last_successful_sync_at")),
            first_successful_sync_at=_parse_health_timestamp(health.get("first_successful_sync_at")),
        )
    except Exception as exc:  # noqa: BLE001 - never let the fire store break the assessment
        logging.getLogger(__name__).warning("[wildfire] detections unavailable: %s", type(exc).__name__)
        return None
