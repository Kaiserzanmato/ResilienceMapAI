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
