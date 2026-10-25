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

    # Volcanic scoring is off by default (ENABLE_VOLCANIC_SCORING=false), or on without a data
    # file: either way the row says the data is not loaded (PHIVOLCS permission is granted).
    assert not get_settings().enable_volcanic_scoring
    assert hazards["volcano"]["score"] is None
    assert hazards["volcano"]["coverage_status"] == "unavailable"
    assert hazards["volcano"]["reason_code"] == "data_unavailable"

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


def test_volcanic_without_a_data_file_is_data_unavailable_even_when_enabled(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "volcano_data_file", str(tmp_path / "missing.json"))
    monkeypatch.setattr(settings, "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    try:
        volcano = assess_location(13.0, 123.0, "Teston", "PH")["hazards"]["volcano"]
        assert volcano["score"] is None and volcano["reason_code"] == "data_unavailable"
    finally:
        vs._load.cache_clear()


def test_volcanic_row_is_cited_and_never_exposes_coordinates_or_the_list(tmp_path, monkeypatch):
    path = tmp_path / "volcanoes.json"
    path.write_text(json.dumps({
        "source": {"name": "DOST-PHIVOLCS, List of Philippine Volcanoes", "url": vs.PHIVOLCS_URL, "retrieved": "2026-10-25",
                   "licence_note": "test data"},
        "volcanoes": [{"name": "Teston", "latitude": 13.0, "longitude": 123.0, "status": "active", "last_eruption_year": None},
                      {"name": "Otherton", "latitude": 14.5, "longitude": 121.5, "status": "active", "last_eruption_year": None}],
    }), encoding="utf-8")
    settings = get_settings()
    monkeypatch.setattr(settings, "volcano_data_file", str(path))
    monkeypatch.setattr(settings, "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    try:
        volcano = assess_location(13.001, 123.0, "Teston", "PH")["hazards"]["volcano"]
        assert volcano["link"]["url"] == "https://www.phivolcs.dost.gov.ph/volcanoes-of-the-philippines/"
        assert vs.CITATION in volcano["note"] and vs.CITATION in volcano["limitations"]
        text = json.dumps(volcano)
        assert "Otherton" not in text  # the full list is never returned
        for coordinate in ("13.0,", "123.0,", "14.5", "121.5"):
            assert f'"latitude": {coordinate}' not in text and f'"longitude": {coordinate}' not in text
        assert "latitude" not in text and "longitude" not in text
        # Exports carry the citation, not the list.
        from app.services.exporters import risks_to_csv
        from app.services.risk_scoring import score_location
        csv_text = risks_to_csv([score_location(13.0, 123.0, "Teston")])
        assert "DOST-PHIVOLCS" in csv_text and "Otherton" not in csv_text and "14.5" not in csv_text
    finally:
        vs._load.cache_clear()


def test_volcanic_reason_code_is_not_data_unavailable_once_scoring_is_enabled(tmp_path, monkeypatch):
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
        assert volcano["reason_code"] == "volcano_distance_band"
    finally:
        vs._load.cache_clear()
