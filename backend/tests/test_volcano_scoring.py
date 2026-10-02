"""Volcanic score: distance bands, status weighting, coverage, the data-file loader and its
off-by-default state. Test data is synthetic (invented volcanoes), not any real list."""
import json

import pytest

from app.config import get_settings
from app.services import volcano_scoring as vs
from app.services.global_assessment import assess_location

ACTIVE = {"name": "A", "latitude": 10.0, "longitude": 120.0, "status": "active", "last_eruption_year": 2020}
POTENTIAL = {"name": "P", "latitude": 10.0, "longitude": 120.0, "status": "potentially active", "last_eruption_year": None}
SYNTHETIC = {
    "source": {"name": "Synthetic test list", "url": "https://example.test/volcanoes", "retrieved": "2026-10-02",
               "licence_note": "test data"},
    "volcanoes": [
        {"name": "Teston", "latitude": 13.0, "longitude": 123.0, "status": "active", "last_eruption_year": 2024},
        {"name": "Fakeview", "latitude": 14.0, "longitude": 121.0, "status": "potentially active", "last_eruption_year": None},
    ],
}


def km_east(km):  # a point this far east of (10, 120)
    return 10.0, 120.0 + km / 109.64


@pytest.fixture
def volcano_file(tmp_path, monkeypatch):
    """Point VOLCANO_DATA_FILE at a synthetic list and switch scoring on."""
    path = tmp_path / "volcanoes.json"
    path.write_text(json.dumps(SYNTHETIC), encoding="utf-8")
    settings = get_settings()
    monkeypatch.setattr(settings, "volcano_data_file", str(path))
    monkeypatch.setattr(settings, "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    yield path
    vs._load.cache_clear()


@pytest.mark.parametrize("km,score", [(0, 90), (5.9, 90), (6.5, 75), (9.9, 75), (12, 45), (29, 45), (35, 15), (99, 15), (150, 0)])
def test_active_volcano_bands(km, score):
    lat, lng = km_east(km)
    assert vs.score_volcano(lat, lng, "PH", [ACTIVE])["score"] == score


def test_potentially_active_counts_half():
    lat, lng = km_east(4)
    assert vs.score_volcano(lat, lng, "PH", [POTENTIAL])["score"] == 45
    assert vs.score_volcano(lat, lng, "PH", [{**POTENTIAL, "status": "active"}])["score"] == 90


def test_the_highest_band_wins_not_just_the_nearest():
    lat, lng = km_east(4)
    near_potential = {**POTENTIAL, "name": "near", "latitude": 10.0, "longitude": 120.0}
    far_active = {**ACTIVE, "name": "far", "latitude": 10.0, "longitude": 120.0 + 8 / 109.64}  # 4 km from the point on the other side
    result = vs.score_volcano(lat, lng, "PH", [near_potential, far_active])
    assert result["score"] == 90 and result["driver"]["name"] == "far"


def test_outside_the_philippines_is_no_data_not_zero():
    assert vs.score_volcano(35.68, 139.76, "JP") is None
    assert vs.score_volcano(10.0, 120.0, None) is None
    assert vs.score_volcano(10.0, 120.0, "ph", [ACTIVE]) is not None  # case-insensitive
    assert vs.score_volcano(10.0, 120.0, "PH", []) is None           # no volcano data at all


def test_the_repo_ships_no_volcano_data_and_scoring_is_off_by_default():
    """GVP terms forbid redistribution (the repo is public), so no list is committed."""
    from pathlib import Path

    root = Path(__file__).parents[2]
    assert not list(root.glob("backend/app/data/*volcano*"))
    settings = get_settings()
    assert settings.enable_volcanic_scoring is False and settings.volcano_data_file == ""
    assert vs.volcano_data() is None


def test_without_a_data_file_volcanic_is_no_data_even_when_enabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "enable_volcanic_scoring", True)
    assert vs.score_volcano(13.0, 123.0, "PH") is None
    hazard = assess_location(13.0, 123.0, "Teston area", "PH")["hazards"]["volcano"]
    assert hazard["score"] is None and "note" not in hazard and hazard["coverage_status"] != "available"


@pytest.mark.parametrize("content", ["not json", "{}", '{"source": {}, "volcanoes": []}',
                                     json.dumps({**SYNTHETIC, "volcanoes": [{"name": "x", "latitude": 1, "longitude": 1, "status": "dormant"}]}),
                                     json.dumps({**SYNTHETIC, "volcanoes": [{"name": "x", "latitude": 99, "longitude": 1, "status": "active"}]})])
def test_an_invalid_data_file_is_ignored(tmp_path, monkeypatch, content):
    path = tmp_path / "bad.json"
    path.write_text(content, encoding="utf-8")
    monkeypatch.setattr(get_settings(), "volcano_data_file", str(path))
    monkeypatch.setattr(get_settings(), "enable_volcanic_scoring", True)
    vs._load.cache_clear()
    assert vs.volcano_data() is None and vs.score_volcano(13.0, 123.0, "PH") is None
    monkeypatch.setattr(get_settings(), "volcano_data_file", str(tmp_path / "missing.json"))
    vs._load.cache_clear()
    assert vs.volcano_data() is None
    vs._load.cache_clear()


def test_a_valid_data_file_scores_through_the_assessment(volcano_file):
    inside = assess_location(13.0, 123.0, "At Teston", "PH")
    hazard = inside["hazards"]["volcano"]
    assert hazard["score"] == 90 and hazard["coverage_status"] == "available" and hazard["reason_code"] == "volcano_distance_band"
    assert "Teston is an active volcano 0.0 km away" in hazard["note"]
    assert "not an official hazard map or a forecast" in hazard["note"] and "not live" in hazard["note"]
    assert hazard["link"]["url"].startswith("https://www.phivolcs.dost.gov.ph")
    assert hazard["evidence"][0]["source"] == "Synthetic test list"
    assert inside["multi_hazard_summary"]["components_available"] >= 2
    far = assess_location(14.0, 121.0 + 12 / 107.9, "Near Fakeview", "PH")["hazards"]["volcano"]
    assert far["score"] == round(45 * 0.5)  # a potentially active volcano 12 km away: half of the 30 km band
    tokyo = assess_location(35.68, 139.76, "Tokyo", "JP")["hazards"]["volcano"]
    assert tokyo["score"] is None and "note" not in tokyo


def test_it_can_be_switched_off(volcano_file, monkeypatch):
    monkeypatch.setattr(get_settings(), "enable_volcanic_scoring", False)
    hazard = assess_location(13.0, 123.0, "At Teston", "PH")["hazards"]["volcano"]
    assert hazard["score"] is None and "note" not in hazard
