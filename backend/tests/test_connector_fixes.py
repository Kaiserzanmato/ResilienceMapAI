"""Regressions for the first production sync: GDACS used a dead URL, ReliefWeb
v1 was decommissioned and v2 needs an approved appname, and FIRMS recorded a
plain-text error body as a successful empty sync."""
import httpx
import pytest

from app.config import get_settings
from app.data_sources.connectors import gdacs_connector, nasa_firms_connector, reliefweb_connector
from app.data_sources.sync.credentials import missing_credentials
from app.data_sources.sync.reason_codes import classify_error


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_gdacs_uses_the_search_endpoint():
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={"type": "FeatureCollection", "features": [{"id": 1}]})

    async with _client(handler) as client:
        assert await gdacs_connector.fetch_gdacs_events(client) == [{"id": 1}]
    assert seen == ["https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"]


async def test_reliefweb_uses_v2_with_appname_in_the_query(monkeypatch):
    monkeypatch.setattr(get_settings(), "reliefweb_appname", "approved-app")
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json={"data": [{"id": "1"}]})

    async with _client(handler) as client:
        assert await reliefweb_connector.fetch_reliefweb_disasters(client) == [{"id": "1"}]
    assert seen[0].path == "/v2/disasters"
    assert seen[0].params["appname"] == "approved-app"


async def test_reliefweb_without_an_appname_raises_instead_of_calling_out(monkeypatch):
    monkeypatch.setattr(get_settings(), "reliefweb_appname", "")

    def handler(request):  # pragma: no cover - must not be reached
        raise AssertionError("no request expected")

    async with _client(handler) as client:
        with pytest.raises(ValueError):
            await reliefweb_connector.fetch_reliefweb_disasters(client)


def test_reliefweb_is_not_configured_until_an_appname_is_set(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "reliefweb_appname", "")
    assert missing_credentials("reliefweb") is True
    monkeypatch.setattr(settings, "reliefweb_appname", "approved-app")
    assert missing_credentials("reliefweb") is False


async def test_firms_text_error_body_is_a_failure_not_an_empty_success():
    def handler(request):
        return httpx.Response(200, text="Exceeded transaction limit.")

    async with _client(handler) as client:
        with pytest.raises(ValueError) as caught:
            await nasa_firms_connector.fetch_firms_fire_data(client, map_key="k" * 32)
    assert classify_error(caught.value) == "upstream_invalid_response"


async def test_firms_parses_crlf_csv():
    body = "latitude,longitude,confidence\r\n10.1,120.2,high\r\n11.1,121.2,low\r\n"

    async with _client(lambda request: httpx.Response(200, text=body)) as client:
        rows = await nasa_firms_connector.fetch_firms_fire_data(client, map_key="k" * 32)
    assert [r["latitude"] for r in rows] == ["10.1", "11.1"]
    assert rows[0]["confidence"] == "high"
