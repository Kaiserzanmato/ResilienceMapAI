"""NASA EONET connector — natural event metadata API v3."""
from __future__ import annotations
import logging
from typing import Any

from .safety import provider_json

logger = logging.getLogger(__name__)

EONET_EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

async def fetch_eonet_events(http_client: Any, days: int = 7, limit: int = 100) -> list[dict]:
    try:
        resp = await http_client.get(
            EONET_EVENTS_URL,
            params={"days": days, "limit": limit, "status": "open"},
            timeout=15,
        )
        data = provider_json(resp)
        events = data.get("events", [])
        logger.info("[nasa-eonet] Fetched %d events", len(events))
        return events
    except Exception as exc:
        logger.error("[nasa-eonet] Fetch failed: %s", exc)
        raise
