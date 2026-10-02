"""ReliefWeb connector — humanitarian crisis reports API."""
from __future__ import annotations
import logging
from typing import Any

from .safety import provider_json
from ...config import get_settings
from ...redaction import redact_secrets

logger = logging.getLogger(__name__)

# v1 was decommissioned (HTTP 410). v2 rejects any appname ReliefWeb has not
# approved (HTTP 403); request one at https://apidoc.reliefweb.int/parameters#appname
# and set it as RELIEFWEB_APPNAME.
RELIEFWEB_API = "https://api.reliefweb.int/v2/disasters"

async def fetch_reliefweb_disasters(
    http_client: Any,
    limit: int = 20,
    appname: str | None = None,
) -> list[dict]:
    appname = appname or get_settings().reliefweb_appname
    if not appname:
        raise ValueError("RELIEFWEB_APPNAME is not configured")
    try:
        payload = {
            "limit": limit,
            "fields": {"include": ["name", "date", "status", "country", "type", "description"]},
            "filter": {"field": "status", "value": ["alert", "ongoing"]},
        }
        resp = await http_client.post(RELIEFWEB_API, params={"appname": appname}, json=payload, timeout=20)
        data = provider_json(resp)
        items = data.get("data", [])
        logger.info("[reliefweb] Fetched %d disasters", len(items))
        return items
    except Exception as exc:
        logger.error("[reliefweb] Fetch failed: %s", redact_secrets(exc))
        raise
