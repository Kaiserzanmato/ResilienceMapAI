"""The PHIVOLCS list builder parses the published table verbatim and refuses a changed page."""
import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "build_phivolcs_volcanoes", Path(__file__).resolve().parents[1] / "scripts" / "build_phivolcs_volcanoes.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)

PAGE = """<table><tr><td>Item No.</td><td>Name of Volcano</td><td>Latitude</td><td>Longtitide</td><td>Province</td></tr>
<tr><td>18</td><td>Mayon</td><td>13.25519</td><td>123.68615</td><td>Albay, Bicol Region in Luzon</td></tr>
<tr><td>10</td><td>Hibok-hibok</td><td>9.20427</td><td>124.67115</td><td>Camiguin in Mindanao</td></tr>
<tr><td>x</td><td>not a row</td><td>1</td><td>2</td><td>-</td></tr></table>"""


def test_parse_keeps_names_and_coordinates_verbatim():
    rows = builder.parse(PAGE)
    assert rows == [
        {"name": "Mayon", "latitude": 13.25519, "longitude": 123.68615, "status": "active", "last_eruption_year": None},
        {"name": "Hibok-hibok", "latitude": 9.20427, "longitude": 124.67115, "status": "active", "last_eruption_year": None},
    ]


def test_built_rows_pass_the_loader_validation():
    from app.services.volcano_scoring import _validate
    data = {"source": {"name": builder.SOURCE_NAME, "url": builder.URL}, "volcanoes": builder.parse(PAGE)}
    assert _validate(data) is not None
