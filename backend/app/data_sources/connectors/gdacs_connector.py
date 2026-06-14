"""GDACS connector — fetches GeoJSON event feed."""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

GDACS_GEOJSON_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/GDACS"

async def fetch_gdacs_events(http_client: Any) -> list[dict]:
    """Fetch current GDACS events and return normalized list."""
    try:
        resp = await http_client.get(GDACS_GEOJSON_URL, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("[gdacs] Fetched %d events", len(features))
        return features
    except Exception as exc:
        logger.error("[gdacs] Fetch failed: %s", exc)
        raise
