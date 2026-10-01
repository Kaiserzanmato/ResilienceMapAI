"""Panel title naming and the usage-reset time (regressions found on the live map)."""
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services import usage_quota
from app.services.global_assessment import assess_location
from app.services.risk_scoring import score_location

# The clicked pin from production: 15.0893, 120.8896 (Candaba, Pampanga), ~55 km north of
# Metro Manila's centre. Manila's sample zone has a 30 km core radius and its influence
# fades out to 3x that, so this point still picks up Manila's scores but is not "in" Manila.
CANDABA = (15.0893, 120.8896)
MANILA_CENTRE = (14.5995, 120.9842)
client = TestClient(app, client=("203.0.113.30", 50000))


def test_a_click_outside_a_zones_core_radius_is_not_named_after_that_zone():
    assert score_location(*CANDABA)["location_name"] == "15.089, 120.890"
    assert assess_location(*CANDABA, None, "PH")["location"]["name"] == "15.089, 120.890"


def test_a_click_inside_a_zones_core_radius_keeps_the_zone_name():
    assert score_location(*MANILA_CENTRE)["location_name"] == "Metro Manila"
    assert assess_location(14.62, 121.0, None, "PH")["location"]["name"] == "Metro Manila"


def test_an_explicit_name_always_wins():
    assert score_location(*CANDABA, name="Candaba")["location_name"] == "Candaba"
    assert assess_location(*CANDABA, "Candaba", "PH")["location"]["name"] == "Candaba"


def test_the_zone_still_informs_the_indicative_scores_outside_its_core():
    # Naming changed, scoring did not: Candaba keeps its (decayed) Manila-derived earthquake figure.
    assert score_location(*CANDABA)["hazards"]["earthquake"]["score"] == 42


# ------------------------------------------------------------ usage reset

def test_unused_quota_has_no_reset_time_instead_of_one_that_is_already_past():
    status = usage_quota.get_status("insights", "fresh-key")
    assert status.used == 0 and status.resets_at is None and status.resets_in_seconds == 0


def test_a_used_quota_resets_when_the_oldest_hit_leaves_the_window():
    usage_quota.consume("insights", "k-reset")
    status = usage_quota.get_status("insights", "k-reset")
    reset = datetime.fromisoformat(status.resets_at)
    assert status.used == 1 and reset > datetime.now(timezone.utc)
    assert abs(status.resets_in_seconds - get_settings().insights_quota_window_seconds) < 5


def test_usage_status_endpoint_reports_null_reset_for_an_unused_insights_bucket():
    body = client.get("/api/usage-status").json()
    assert body["insights"]["used"] == 0 and body["insights"]["resets_at"] is None
    assert datetime.fromisoformat(body["chat"]["resets_at"]) > datetime.now(timezone.utc)  # daily reset is fixed
