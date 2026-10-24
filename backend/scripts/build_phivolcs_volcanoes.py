"""Build the PHIVOLCS volcano list for VOLCANO_DATA_FILE.

Run from the repo root:  python backend/scripts/build_phivolcs_volcanoes.py [output.json]

Fetches DOST-PHIVOLCS "Volcanoes of the Philippines" and writes names and coordinates exactly as
published. PHIVOLCS approved this use in a letter dated 15 Oct 2026 on these conditions:
DocypherLabs use only (no redistribution), no changes to the information, full citation.
The output is therefore gitignored (default backend/data/phivolcs_volcanoes.json): never commit
it. Upload it to the host as a secret file and point VOLCANO_DATA_FILE at it.

The page lists only the active volcanoes and gives no per-row status or eruption year, so
every row is "active" (the page's heading) with last_eruption_year null.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
URL = "https://www.phivolcs.dost.gov.ph/volcanoes-of-the-philippines/"
DEFAULT_OUT = ROOT / "backend" / "data" / "phivolcs_volcanoes.json"
SOURCE_NAME = "DOST-PHIVOLCS, List of Philippine Volcanoes"
LICENCE_NOTE = "Used with written permission from PHIVOLCS dated 15 Oct 2026; DocypherLabs use only"
# Page columns: Item No., Name of Volcano, Latitude, Longitude, Province.
EXPECTED_ACTIVE = 24


class _Rows(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._cells: list[str] | None = None
        self._text: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "tr":
            self._cells = []
        elif tag in ("td", "th") and self._cells is not None:
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._text is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._cells is not None and self._text is not None:
            self._cells.append(" ".join("".join(self._text).split()))
            self._text = None
        elif tag == "tr" and self._cells is not None:
            self.rows.append(self._cells)
            self._cells = None


def parse(html: str) -> list[dict]:
    parser = _Rows()
    parser.feed(html)
    volcanoes = []
    for cells in parser.rows:
        if len(cells) < 4 or not cells[0].isdigit():
            continue
        try:
            lat, lng = float(cells[2]), float(cells[3])
        except ValueError:
            continue
        volcanoes.append({"name": cells[1], "latitude": lat, "longitude": lng,
                          "status": "active", "last_eruption_year": None})
    return volcanoes


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    response = httpx.get(URL, headers={"User-Agent": "ResilienceMapAI data builder"}, timeout=30, follow_redirects=True)
    response.raise_for_status()
    volcanoes = parse(response.text)
    if len(volcanoes) != EXPECTED_ACTIVE:
        sys.exit(f"Expected {EXPECTED_ACTIVE} volcanoes, parsed {len(volcanoes)}: the page layout changed; check it by hand.")
    data = {"source": {"name": SOURCE_NAME, "url": URL, "retrieved": date.today().isoformat(),
                       "licence_note": LICENCE_NOTE},
            "volcanoes": volcanoes}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(volcanoes)} volcanoes to {out}")


if __name__ == "__main__":
    main()
