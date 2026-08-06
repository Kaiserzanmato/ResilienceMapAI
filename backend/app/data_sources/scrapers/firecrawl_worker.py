"""Firecrawl ingestion worker — scrapes unstructured hazard advisories
(PAGASA/PHIVOLCS/JMA bulletins, etc.) and upserts them into the
`hazard_events` table (see alembic/versions/0002_hazard_events.py for the
PostGIS-backed schema this writes to).

Distinct from `data_sources/connectors/`: connectors pull structured data
from documented APIs (USGS, GDACS, NASA...); this scrapes and LLM-extracts
unstructured advisory pages via Firecrawl, so it lives in its own
`scrapers/` package rather than alongside the connectors.

No-ops entirely when FIRECRAWL_API_KEY is unset, same pattern as the AI
provider keys in config.py — this worker is not wired into
data_sources/sync/run_source_sync.py's scheduled sync yet; call
scrape_and_upsert() directly (e.g. from an admin/cron task) until it is.
"""
import asyncio
import logging
import random
from datetime import datetime, timezone
from urllib.parse import urlparse

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import get_settings

logger = logging.getLogger("resiliencemap.scrapers")

MAX_SCRAPE_ATTEMPTS = 3
RETRY_BASE_DELAY_SECONDS = 1.0


class SpatialHazardEvent(BaseModel):
    event_type: str = Field(description="Typhoon, Volcanic Advisory, Earthquake, etc.")
    source_agency: str = Field(description="PAGASA, PHIVOLCS, JMA, USGS, etc.")
    location_name: str
    latitude: float
    longitude: float
    severity_level: int = Field(description="Scale 1 (Low) to 5 (Critical)", ge=1, le=5)
    summary: str
    citation_url: str


UPSERT_HAZARD_EVENT = text("""
    INSERT INTO hazard_events (
        event_type, source_agency, location_name, severity_level,
        summary, citation_url, geom, updated_at
    )
    VALUES (
        :event_type, :source_agency, :location_name, :severity_level,
        :summary, :citation_url, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :updated_at
    )
    ON CONFLICT (citation_url) DO UPDATE SET
        severity_level = EXCLUDED.severity_level,
        summary = EXCLUDED.summary,
        geom = EXCLUDED.geom,
        updated_at = EXCLUDED.updated_at;
""")


def is_scrapeable_url(url: str) -> bool:
    """Reject non-http(s) schemes (file://, javascript:, etc.) and anything
    without a host before it ever reaches Firecrawl. Firecrawl's own
    infrastructure — not this process — performs the actual outbound
    fetch, so this isn't a direct SSRF control on our network; it's basic
    input hygiene against obviously malformed or unsafe scrape targets."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


class FirecrawlIngestionWorker:
    def __init__(self):
        settings = get_settings()
        self.app = None
        if settings.firecrawl_api_key:
            # Async-native client: Firecrawl (sync) makes a blocking HTTP
            # call, which would stall the event loop if awaited-in-spirit
            # from inside this async method — AsyncFirecrawl actually
            # awaits instead.
            from firecrawl import AsyncFirecrawl
            self.app = AsyncFirecrawl(api_key=settings.firecrawl_api_key)

    async def _scrape_with_retry(self, url: str):
        last_exc: Exception | None = None
        for attempt in range(MAX_SCRAPE_ATTEMPTS):
            try:
                # Firecrawl v2 SDK: schema-based structured extraction is
                # requested via a `{"type": "json", "schema": ...}` format
                # entry; the extracted object comes back on `result.json`.
                return await self.app.scrape(
                    url,
                    formats=[{"type": "json", "schema": SpatialHazardEvent.model_json_schema()}],
                )
            except Exception as exc:  # noqa: BLE001 — SDK exception types aren't part of our contract
                last_exc = exc
                if attempt < MAX_SCRAPE_ATTEMPTS - 1:
                    delay = RETRY_BASE_DELAY_SECONDS * (2 ** attempt) + random.uniform(0, 0.5)
                    logger.warning(
                        "Firecrawl scrape attempt %d/%d failed for %s: %s — retrying in %.1fs",
                        attempt + 1, MAX_SCRAPE_ATTEMPTS, url, exc, delay,
                    )
                    await asyncio.sleep(delay)
        raise last_exc

    async def scrape_and_upsert(self, url: str, db_session: AsyncSession) -> None:
        if not self.app:
            return
        if not is_scrapeable_url(url):
            logger.warning("Firecrawl ingestion skipped: not a scrapeable http(s) URL: %r", url)
            return

        try:
            result = await self._scrape_with_retry(url)
            extracted = getattr(result, "json", None)
            if extracted is None and isinstance(result, dict):
                extracted = result.get("json")
            if not extracted:
                logger.warning("Firecrawl returned no structured data for %s", url)
                return
            event = SpatialHazardEvent(**extracted)

            await db_session.execute(UPSERT_HAZARD_EVENT, {
                "event_type": event.event_type,
                "source_agency": event.source_agency,
                "location_name": event.location_name,
                "severity_level": event.severity_level,
                "summary": event.summary,
                "citation_url": event.citation_url,
                "lng": event.longitude,
                "lat": event.latitude,
                "updated_at": datetime.now(timezone.utc),
            })
            await db_session.commit()
        except ValidationError:
            logger.exception("Firecrawl extraction for %s did not match SpatialHazardEvent", url)
            await db_session.rollback()
        except Exception:
            logger.exception("Firecrawl ingestion failed for %s", url)
            await db_session.rollback()
