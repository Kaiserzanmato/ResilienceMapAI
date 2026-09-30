import pytest

from app.services.country_lookup import country_for_point
from app.services.global_assessment import assess_location

COVERAGE_VOCABULARY = {"available", "not_applicable", "out_of_coverage", "unknown", "unavailable", "stale", "expired", "suppressed"}

FIXTURES = [
    ("Bangkok", 13.746, 100.498, "TH"),
    ("San Fernando, Pampanga", 15.03, 120.69, "PH"),
    ("Malolos, Bulacan", 14.84, 120.81, "PH"),
]


@pytest.mark.parametrize("name,lat,lng,country", FIXTURES)
def test_fixture_locations_have_an_available_component(name, lat, lng, country):
    result = assess_location(lat, lng, name, country)
    summary = result["multi_hazard_summary"]
    assert summary["components_available"] >= 1
    assert summary["components_total"] == len(result["hazards"])


@pytest.mark.parametrize("name,lat,lng,country", FIXTURES)
def test_every_hazard_has_policy_status_and_reason(name, lat, lng, country):
    for hazard in assess_location(lat, lng, name, country)["hazards"].values():
        assert hazard["coverage_status"] in COVERAGE_VOCABULARY
        assert hazard["reason_code"]
        assert (hazard["coverage_status"] == "available") == (hazard["score"] is not None)


def test_missing_country_is_derived_server_side():
    result = assess_location(13.746, 100.498, "Bangkok")
    assert result["location"]["country_code"] == "TH"
    assert result["hazards"]["earthquake"]["score"] is not None


def test_country_lookup_handles_ocean_and_bad_input():
    assert country_for_point(0.0, -140.0) is None
    assert country_for_point(95.0, 0.0) is None
    assert country_for_point(14.5995, 120.9842) == "PH"


def test_no_data_states_never_carry_a_score_and_baseline_is_separate():
    result = assess_location(14.84, 120.81, "Malolos, Bulacan", "PH")
    flood = result["hazards"]["flood"]
    assert flood["score"] is None
    assert flood["coverage_status"] == "unavailable"
    assert flood["classification"] == "no-data"
    assert flood["indicative_score"] is not None  # labelled baseline, not a score
    sinkhole = result["hazards"]["sinkhole"]
    assert sinkhole["coverage_status"] == "out_of_coverage"
    assert sinkhole["indicative_score"] is None


def test_zero_baseline_is_not_reported_as_indicative_risk():
    # Nepal's baseline stores 0 for hazards that are not modelled there.
    result = assess_location(28.39, 84.12, "Nepal", "NP")
    assert result["hazards"]["tropical_cyclone"]["indicative_score"] is None
