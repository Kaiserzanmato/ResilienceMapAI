"""One-off backfill of FIRMS detections into fire_detections (run from a trusted machine).

The scheduled sync stores each day it downloads, so the wildfire score's 7 and 30 day windows
fill by themselves over a month. This script fills them at once from FIRMS's own history
(NRT data is kept for roughly two months), 10 days per request.

    cd backend
    NASA_FIRMS_MAP_KEY=... NASA_FIRMS_AREA="116,4,127,22" .venv/bin/python scripts/backfill_firms.py            # dry run
    ... DATABASE_URL=... .venv/bin/python scripts/backfill_firms.py --days 30 --apply                              # writes

Dry run downloads and parses but writes nothing. The MAP_KEY sits in the request path, so
nothing here prints a URL or the key. Migration 0008 must already be applied.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.data_sources.connectors.nasa_firms_connector import MAX_RANGE  # noqa: E402
from app.repositories.fire_repo import get_fire_repo  # noqa: E402
from app.services.wildfire_scoring import parse_firms_record  # noqa: E402

FIRMS_API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
SOURCE = "VIIRS_SNPP_NRT"


def chunks(days: int, today: date) -> list[tuple[date, int]]:
    """(start date, day range) pieces that exactly cover the last `days` days ending today."""
    out, remaining, end = [], days, today
    while remaining > 0:
        size = min(MAX_RANGE, remaining)
        out.append((end - timedelta(days=size - 1), size))
        end -= timedelta(days=size)
        remaining -= size
    return list(reversed(out))


def parse_csv(text: str) -> list[dict]:
    lines = text.strip().split("\n")
    headers = [h.strip() for h in lines[0].split(",")] if lines else []
    if "latitude" not in headers:
        raise ValueError("FIRMS returned a non-CSV response (bad key or exhausted quota)")
    rows = [dict(zip(headers, (v.strip() for v in line.split(",")))) for line in lines[1:]]
    return [r for r in rows if len(r) == len(headers)]


async def main(days: int, apply: bool) -> int:
    settings = get_settings()
    if not settings.nasa_firms_map_key:
        print("NASA_FIRMS_MAP_KEY is not set")
        return 1
    total = stored = 0
    async with httpx.AsyncClient(timeout=60.0) as client:
        for start, size in chunks(days, date.today()):
            url = f"{FIRMS_API}/{settings.nasa_firms_map_key}/{SOURCE}/{settings.nasa_firms_area}/{size}/{start.isoformat()}"
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                records = parse_csv(resp.text)
            except httpx.HTTPError as exc:
                print(f"{start} (+{size} d): request failed ({type(exc).__name__})")  # never print the exception: it carries the URL
                return 1
            detections = [d for d in (parse_firms_record(r) for r in records) if d is not None]
            total += len(detections)
            if apply:
                stored += await get_fire_repo().upsert_many(detections)
            print(f"{start} (+{size} d): {len(detections)} detections")
    print(f"{total} detections downloaded; {'stored ' + str(stored) if apply else 'dry run, nothing written'}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--apply", action="store_true", help="write to the database (default: dry run)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(max(1, min(args.days, 60)), args.apply)))
