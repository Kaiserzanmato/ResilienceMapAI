from app.services.risk_scoring import level_for_score, score_location


def test_manila_is_covered_and_high_flood():
    r = score_location(14.5995, 120.9842, "Metro Manila")
    assert r["data_coverage"] == "covered"
    assert r["hazards"]["flood"]["score"] == 78
    assert r["overall"]["score"] is not None
    assert r["overall"]["level"] in {"Low", "Medium", "High"}


def test_deterministic():
    a = score_location(10.3157, 123.8854)
    b = score_location(10.3157, 123.8854)
    a.pop("generated_at"); b.pop("generated_at")
    assert a == b


def test_ocean_has_no_data():
    r = score_location(0.0, -140.0)
    assert r["data_coverage"] == "limited"
    assert r["overall"]["score"] is None
    assert r["overall"]["level"] == "No Data"


def test_level_thresholds():
    assert level_for_score(0)["level"] == "Low"
    assert level_for_score(25)["level"] == "Low"
    assert level_for_score(26)["level"] == "Medium"
    assert level_for_score(60)["level"] == "Medium"
    assert level_for_score(61)["level"] == "High"
    assert level_for_score(100)["color"] == "red"
    assert level_for_score(None)["color"] == "gray"


def test_distance_decay():
    near = score_location(14.5995, 120.9842)
    far = score_location(15.4, 120.9842)  # ~89 km north, inside falloff band
    assert far["hazards"]["flood"]["score"] < near["hazards"]["flood"]["score"]
