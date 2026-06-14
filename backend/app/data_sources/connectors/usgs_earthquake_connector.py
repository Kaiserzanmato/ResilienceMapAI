"""USGS Earthquake connector — real-time GeoJSON feeds."""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

USGS_FEEDS = {
    "all_hour": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
    "all_day": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    "significant_month": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    "2.5_week": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
}

async def fetch_usgs_earthquakes(
    http_client: Any,
    feed: str = "2.5_week",
) -> list[dict]:
    url = USGS_FEEDS.get(feed, USGS_FEEDS["2.5_week"])
    try:
        resp = await http_client.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("[usgs] Fetched %d earthquake events from %s", len(features), feed)
        return features
    except Exception as exc:
        logger.error("[usgs] Fetch failed: %s", exc)
        raise
