"""NASA FIRMS connector — fire hotspot detection."""
from __future__ import annotations
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

FIRMS_API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


async def fetch_firms_fire_data(
    http_client: Any,
    map_key: Optional[str] = None,
    area_url: str = "world",
    days: int = 2,
) -> list[dict]:
    if not map_key:
        logger.warning("[nasa-firms] No MAP_KEY configured — skipping")
        return []
    try:
        url = f"{FIRMS_API}/{map_key}/VIIRS_SNPP_NRT/{area_url}/{days}"
        resp = await http_client.get(url, timeout=30)
        resp.raise_for_status()
        lines = resp.text.strip().split("\n")
        headers = lines[0].split(",") if lines else []
        records = []
        for line in lines[1:]:
            values = line.split(",")
            if len(values) == len(headers):
                records.append(dict(zip(headers, values)))
        logger.info("[nasa-firms] Fetched %d fire detections", len(records))
        return records
    except Exception as exc:
        logger.error("[nasa-firms] Fetch failed: %s", exc)
        raise
