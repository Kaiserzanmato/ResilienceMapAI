import re
from pathlib import Path

import pytest

from app.services.country_lookup import SMALL_COUNTRY_BOXES, country_for_point
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


def test_bangkok_earthquake_is_labelled_as_a_country_baseline():
    earthquake = assess_location(13.746, 100.498, "Bangkok", "TH")["hazards"]["earthquake"]
    (evidence,) = earthquake["evidence"]
    assert evidence["source"] == "ResilienceMap country risk baseline"
    assert evidence["source_type"] == "modelled-baseline"
    assert evidence["resolution"] == "country"
    assert "country-level baseline" in evidence["uncertainty"].lower()
    assert "not local detail" in evidence["uncertainty"].lower()
    # Still an available component, but never better than low confidence.
    assert earthquake["coverage_status"] == "available" and earthquake["score"] is not None
    assert earthquake["confidence"] == "low"


def test_manila_earthquake_is_labelled_as_a_curated_zone():
    earthquake = assess_location(14.5995, 120.9842, "Metro Manila", "PH")["hazards"]["earthquake"]
    (evidence,) = earthquake["evidence"]
    assert evidence["source"] == "ResilienceMap curated zone dataset"
    assert evidence["source_type"] == "modelled"
    assert "zone-based" in evidence["uncertainty"].lower()
    assert "resolution" not in evidence
    assert earthquake["coverage_status"] == "available"


# ---- small states missing from the Natural Earth 110m polygons
REPO_ROOT = Path(__file__).resolve().parents[2]


def test_singapore_and_hong_kong_resolve_to_their_own_countries():
    assert country_for_point(1.29, 103.85) == "SG"
    assert country_for_point(22.3, 114.17) == "HK"
    assert assess_location(1.29, 103.85, "Singapore")["location"]["country_code"] == "SG"


@pytest.mark.parametrize("code,west,south,east,north", SMALL_COUNTRY_BOXES)
def test_every_small_country_box_resolves_at_its_centre(code, west, south, east, north):
    assert country_for_point((south + north) / 2, (west + east) / 2) == code


def test_small_country_list_covers_the_required_states():
    assert {box[0] for box in SMALL_COUNTRY_BOXES} >= {"SG", "HK", "MO", "BH", "MT", "MV", "LU", "AD", "MC", "LI", "SM", "BN"}


def test_small_country_boxes_do_not_swallow_nearby_neighbours():
    assert country_for_point(1.4927, 103.7414) == "MY"   # Johor Bahru, just over the causeway
    # Batam is absent from the 110m polygons (the coastal fallback picks a neighbour), but the
    # Singapore box must not claim it.
    assert country_for_point(1.05, 104.03) != "SG"
    assert country_for_point(22.5431, 114.0579) == "CN"  # Shenzhen
    assert country_for_point(13.746, 100.498) == "TH"    # unchanged for ordinary points


def test_python_and_typescript_small_country_boxes_are_identical():
    source = (REPO_ROOT / "frontend" / "lib" / "locations" / "point-to-country.ts").read_text(encoding="utf-8")
    block = source.split("SMALL_COUNTRY_BOXES:", 1)[1].split("];", 1)[0]
    ts_boxes = tuple(
        (code, *map(float, nums))
        for code, *nums in re.findall(r'\["([A-Z]{2})",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\]', block)
    )
    assert ts_boxes == SMALL_COUNTRY_BOXES
