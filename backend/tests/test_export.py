from app.services.exporters import (CSV_COLUMNS, build_pdf_report, get_report,
                                    risks_to_csv, store_report)
from app.services.risk_scoring import score_location


def test_csv_has_all_columns():
    risks = [score_location(14.5995, 120.9842, "Metro Manila"),
             score_location(10.3157, 123.8854, "Cebu City")]
    csv_text = risks_to_csv(risks)
    header = csv_text.splitlines()[0].split(",")
    assert header == CSV_COLUMNS
    assert len(csv_text.splitlines()) == 3
    assert "Metro Manila" in csv_text
    assert "engine_version" in header
    assert risks[0]["engine_version"] in csv_text.splitlines()[1]


def test_pdf_renders():
    risk = score_location(13.1391, 123.7438, "Legazpi")
    pdf = build_pdf_report(risk, "government", "Sample AI summary.\n- bullet one")
    assert pdf[:5] == b"%PDF-"
    assert len(pdf) > 2000


async def test_report_store_roundtrip():
    risk = score_location(14.5995, 120.9842)
    rid = await store_report({"risk": risk, "summary": "s", "persona": "citizen",
                              "sources": [], "disclaimer": "d"})
    fetched = await get_report(rid)
    assert fetched is not None
    assert fetched["risk"]["location_name"] == risk["location_name"]
    assert await get_report("nonexistent") is None
