"""GDACS connector — fetches GeoJSON event feed."""
from __future__ import annotations
import logging
from typing import Any

from .safety import provider_json
from ...redaction import redact_secrets

logger = logging.getLogger(__name__)

# The old ".../geteventlist/GDACS" path now returns 404; SEARCH serves the same
# GeoJSON FeatureCollection (recent events, all types and alert levels).
GDACS_GEOJSON_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"

async def fetch_gdacs_events(http_client: Any) -> list[dict]:
    """Fetch current GDACS events and return normalized list."""
    try:
        resp = await http_client.get(GDACS_GEOJSON_URL, timeout=15)
        data = provider_json(resp)
        features = data.get("features", [])
        logger.info("[gdacs] Fetched %d events", len(features))
        return features
    except Exception as exc:
        logger.error("[gdacs] Fetch failed: %s", redact_secrets(exc))
        raise
