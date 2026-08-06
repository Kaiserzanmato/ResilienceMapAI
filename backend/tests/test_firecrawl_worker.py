"""Firecrawl ingestion worker tests. No real network or database calls —
the Firecrawl client and DB session are both faked.
"""
import pytest

from app.config import get_settings
from app.data_sources.scrapers.firecrawl_worker import (
    FirecrawlIngestionWorker, is_scrapeable_url,
)

VALID_EVENT_JSON = {
    "event_type": "Typhoon",
    "source_agency": "PAGASA",
    "location_name": "Tacloban City",
    "latitude": 11.2447,
    "longitude": 125.0026,
    "severity_level": 4,
    "summary": "Signal No. 3 raised over Eastern Visayas.",
    "citation_url": "https://www.pagasa.dost.gov.ph/advisory/123",
}


class _FakeDocument:
    def __init__(self, json_data):
        self.json = json_data


class _FakeFirecrawlApp:
    """Fails `fail_times` times before succeeding (or fails forever if
    fail_times >= MAX_SCRAPE_ATTEMPTS), to exercise the retry path."""

    def __init__(self, result=None, exc_factory=None, fail_times=0):
        self.result = result
        self.exc_factory = exc_factory or (lambda: RuntimeError("scrape failed"))
        self.fail_times = fail_times
        self.call_count = 0

    async def scrape(self, url, formats=None):
        self.call_count += 1
        if self.call_count <= self.fail_times:
            raise self.exc_factory()
        return self.result


class _FakeSession:
    def __init__(self):
        self.executed = []
        self.committed = False
        self.rolled_back = False

    async def execute(self, stmt, params=None):
        self.executed.append((stmt, params))

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True


def _make_worker(monkeypatch, api_key="dummy-key"):
    monkeypatch.setattr(get_settings(), "firecrawl_api_key", api_key)
    return FirecrawlIngestionWorker()


# ---------------------------------------------------------------- URL validation
def test_is_scrapeable_url_accepts_https():
    assert is_scrapeable_url("https://www.pagasa.dost.gov.ph/advisory/123")


def test_is_scrapeable_url_rejects_non_http_scheme():
    assert not is_scrapeable_url("file:///etc/passwd")
    assert not is_scrapeable_url("javascript:alert(1)")


def test_is_scrapeable_url_rejects_missing_host():
    assert not is_scrapeable_url("https://")
    assert not is_scrapeable_url("not-a-url")


# ---------------------------------------------------------------- key / no-op
@pytest.mark.asyncio
async def test_missing_firecrawl_key_is_safe_noop(monkeypatch):
    worker = _make_worker(monkeypatch, api_key="")
    assert worker.app is None
    session = _FakeSession()
    await worker.scrape_and_upsert("https://example.com/advisory", session)
    assert session.executed == []
    assert not session.committed


@pytest.mark.asyncio
async def test_invalid_url_is_safe_noop(monkeypatch):
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument(VALID_EVENT_JSON))
    session = _FakeSession()
    await worker.scrape_and_upsert("javascript:alert(1)", session)
    assert session.executed == []
    assert worker.app.call_count == 0


# ---------------------------------------------------------------- successful path
@pytest.mark.asyncio
async def test_successful_geospatial_upsert(monkeypatch):
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument(VALID_EVENT_JSON))
    session = _FakeSession()

    await worker.scrape_and_upsert(VALID_EVENT_JSON["citation_url"], session)

    assert session.committed
    assert not session.rolled_back
    assert len(session.executed) == 1
    _stmt, params = session.executed[0]
    assert params["citation_url"] == VALID_EVENT_JSON["citation_url"]
    assert params["lat"] == VALID_EVENT_JSON["latitude"]
    assert params["lng"] == VALID_EVENT_JSON["longitude"]
    assert params["severity_level"] == 4


@pytest.mark.asyncio
async def test_upsert_uses_stable_conflict_key_on_citation_url(monkeypatch):
    """Two scrapes of the same URL must both target the same conflict key
    so a duplicate scrape updates rather than duplicates the row."""
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument(VALID_EVENT_JSON))
    session = _FakeSession()

    await worker.scrape_and_upsert(VALID_EVENT_JSON["citation_url"], session)
    await worker.scrape_and_upsert(VALID_EVENT_JSON["citation_url"], session)

    assert len(session.executed) == 2
    for _stmt, params in session.executed:
        assert params["citation_url"] == VALID_EVENT_JSON["citation_url"]
    assert "ON CONFLICT (citation_url)" in str(session.executed[0][0])


# ---------------------------------------------------------------- failure paths
@pytest.mark.asyncio
async def test_empty_scrape_response_is_safe_noop(monkeypatch):
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument(None))
    session = _FakeSession()

    await worker.scrape_and_upsert("https://example.com/advisory", session)

    assert session.executed == []
    assert not session.committed
    assert not session.rolled_back


@pytest.mark.asyncio
async def test_malformed_extracted_content_rolls_back(monkeypatch):
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument({"unexpected": "shape"}))
    session = _FakeSession()

    await worker.scrape_and_upsert("https://example.com/advisory", session)

    assert session.executed == []
    assert not session.committed
    assert session.rolled_back


@pytest.mark.asyncio
async def test_provider_failure_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(
        "app.data_sources.scrapers.firecrawl_worker.RETRY_BASE_DELAY_SECONDS", 0.0
    )
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(result=_FakeDocument(VALID_EVENT_JSON), fail_times=2)
    session = _FakeSession()

    await worker.scrape_and_upsert(VALID_EVENT_JSON["citation_url"], session)

    assert worker.app.call_count == 3
    assert session.committed


@pytest.mark.asyncio
async def test_provider_failure_exhausts_retries_and_rolls_back(monkeypatch):
    monkeypatch.setattr(
        "app.data_sources.scrapers.firecrawl_worker.RETRY_BASE_DELAY_SECONDS", 0.0
    )
    worker = _make_worker(monkeypatch)
    worker.app = _FakeFirecrawlApp(
        exc_factory=lambda: TimeoutError("provider timeout"), fail_times=99
    )
    session = _FakeSession()

    await worker.scrape_and_upsert("https://example.com/advisory", session)

    assert worker.app.call_count == 3  # MAX_SCRAPE_ATTEMPTS, bounded — not indefinite
    assert not session.committed
    assert session.rolled_back
