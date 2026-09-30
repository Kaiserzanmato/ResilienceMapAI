"""NASA FIRMS connector — fire hotspot detection."""
from __future__ import annotations
import logging
from typing import Any, Optional

import httpx

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
    # The MAP_KEY is part of the URL path, and httpx puts the full URL in its
    # exception messages. Re-raise each httpx error with a URL-free message (same
    # exception class, so sync error classification still works) and `from None`
    # so the original, URL-bearing exception is not chained into any traceback.
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
    except httpx.HTTPStatusError as exc:
        message = f"NASA FIRMS request failed with HTTP {exc.response.status_code}"
        logger.error("[nasa-firms] Fetch failed: %s", message)
        raise httpx.HTTPStatusError(message, request=exc.request, response=exc.response) from None
    except httpx.TimeoutException:
        logger.error("[nasa-firms] Fetch failed: request timed out")
        raise httpx.TimeoutException("NASA FIRMS request timed out") from None
    except httpx.RequestError as exc:
        message = f"NASA FIRMS request failed ({type(exc).__name__})"
        logger.error("[nasa-firms] Fetch failed: %s", message)
        raise httpx.RequestError(message) from None
    except Exception as exc:
        logger.error("[nasa-firms] Fetch failed: %s", type(exc).__name__)
        raise
