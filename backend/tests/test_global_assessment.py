import json

from app.config import get_settings
from app.services import volcano_scoring as vs
from app.services.coverage_registry import providers_for, supported_hazards
from app.services.global_assessment import assess_location


def test_registry_includes_required_hazards_and_explicit_no_data_sources():
    expected = {"flood", "earthquake", "active_fault", "tsunami", "landslide", "volcano", "tropical_cyclone", "wildfire", "drought", "extreme_heat", "coastal_exposure", "land_subsidence", "sinkhole"}
    assert expected <= set(supported_hazards())
    sources, fallback = providers_for("PH", "sinkhole")
    assert sources == []
    assert fallback is False


def test_assessment_preserves_missing_data_and_geometry_limits():
    result = assess_location(0.0, -140.0, "Ocean test", geometry_type="parcel")
    assert result["assessment_geometry"]["type"] == "parcel"
    assert result["hazards"]["sinkhole"]["score"] is None
    assert result["hazards"]["sinkhole"]["classification"] == "no-data"
    assert result["multi_hazard_summary"]["coverage_score"] == 0


def test_country_source_fallback_is_visible():
    result = assess_location(14.5995, 120.9842, "Metro Manila", "PH")
    earthquake = result["hazards"]["earthquake"]
    assert earthquake["score"] is not None
    assert any("global fallback" in item.lower() for item in earthquake["limitations"])
    assert result["scoring_version"]


def test_configured_connector_without_verified_wildfire_evidence_is_not_zero():
    result = assess_location(14.5995, 120.9842, "Metro Manila", "PH")
    wildfire = result["hazards"]["wildfire"]
    assert wildfire["score"] is None
    assert wildfire["classification"] == "no-data"


def test_honest_no_data_reason_codes():
    """Each no-data reason is specific about *why*, not a generic catch-all — the
    frontend's statusLabel (frontend/lib/hazard-status.ts) maps these 1:1 to a label."""
    result = assess_location(14.5995, 120.9842, "Metro Manila", "PH")
    hazards = result["hazards"]

    # Volcanic scoring is off (ENABLE_VOLCANIC_SCORING=false by default — PHIVOLCS
    # permission is pending, not "no source": volcano_scoring.py's GVP data already
    # locates the volcano, see memory/docs/sprint1-phivolcs-fault-data).
    assert not get_settings().enable_volcanic_scoring
    assert hazards["volcano"]["score"] is None
    assert hazards["volcano"]["coverage_status"] == "unavailable"
    assert hazards["volcano"]["reason_code"] == "licence_pending"

    # Metadata-only registered sources (no production connector configured yet).
    for key in ("tropical_cyclone", "landslide", "drought", "extreme_heat", "flood"):
        assert hazards[key]["score"] is None
        assert hazards[key]["reason_code"] == "no_connected_source", key

    # No provider registered at all for this hazard/country.
    for key in ("active_fault", "tsunami", "land_subsidence", "sinkhole"):
        assert hazards[key]["score"] is None
        assert hazards[key]["reason_code"] == "not_covered", key

    # None of the old reason codes leak out anymore.
    all_reason_codes = {h["reason_code"] for h in hazards.values()}
    assert "connector_not_configured" not in all_reason_codes
    assert "no_registered_source" not in all_reason_codes


def test_volcanic_reason_code_is_not_licence_pending_once_scoring_is_enabled(tmp_path, monkeypatch):
    # Synthetic data (not a real list) — same pattern as test_volcano_scoring.py's volcano_file fixture.
    path = tmp_path / "volcanoes.json"
    path.write_text(json.dumps({
        "source": {"name": "Synthetic test list", "url": "https://example.test/volcanoes", "retrieved": "2026-10-02",
                   "licence_note": "test data"},
        "volcanoes": [{"name": "Teston", "latitude": 13.0, "longitude": 123.0, "status": "active", "last_eruption_year": 2024}],
    }), encoding="utf-8")
    settings = get_settings()
    monkeypatch.setattr(settings, "volcano_data_file", str(path))
    monkeypatch.setattr(settings, "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    try:
        volcano = assess_location(13.0, 123.0, "Teston", "PH")["hazards"]["volcano"]  # on the summit
        assert volcano["score"] is not None
        assert volcano["reason_code"] != "licence_pending"
    finally:
        vs._load.cache_clear()
