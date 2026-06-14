"""ReliefWeb connector — humanitarian crisis reports API."""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

RELIEFWEB_API = "https://api.reliefweb.int/v1/disasters"

async def fetch_reliefweb_disasters(
    http_client: Any,
    limit: int = 20,
    appname: str = "resiliencemap-ai",
) -> list[dict]:
    try:
        payload = {
            "appname": appname,
            "limit": limit,
            "fields": {"include": ["name", "date", "status", "country", "type", "body"]},
            "filter": {"field": "status", "value": ["alert", "ongoing"]},
        }
        resp = await http_client.post(RELIEFWEB_API, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data", [])
        logger.info("[reliefweb] Fetched %d disasters", len(items))
        return items
    except Exception as exc:
        logger.error("[reliefweb] Fetch failed: %s", exc)
        raise
