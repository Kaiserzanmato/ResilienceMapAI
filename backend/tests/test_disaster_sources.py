from app.data.disaster_sources import get_sources_for_hazard


def test_non_philippines_location_excludes_philippines_scoped_sources():
    """Regression: Jakarta previously got cited against PAGASA/PHIVOLCS/
    HazardHunterPH/MGB — sources that don't cover Indonesia — because they
    were declared first in DISASTER_SOURCES and nothing filtered them out
    when is_philippines was False."""
    sources = get_sources_for_hazard("flood", is_philippines=False)
    assert sources, "expected at least one Global-scope flood source"
    for s in sources:
        assert "philippines" not in s["scope"].lower()


def test_philippines_location_still_prioritizes_national_sources():
    sources = get_sources_for_hazard("earthquake", is_philippines=True)
    assert sources[0]["source_name"] == "PHIVOLCS Latest Earthquake Information"
    # Global sources remain present, just not first
    assert any("philippines" not in s["scope"].lower() for s in sources)
