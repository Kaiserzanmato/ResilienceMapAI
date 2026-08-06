"""Spatial-vision endpoint tests: Base64/schema validation happens before
any provider call, and provider failures (timeout, error, rate limit,
malformed response) must degrade safely without leaking raw provider
output to the client. Provider calls are mocked — these never hit the
real Qwen VL API.
"""
import base64

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services import spatial_vision
from app.services.spatial_vision import SpatialVisionError, analyze_spatial_viewport

# Not a real decodable JPEG — just satisfies the schema validator's checks
# (magic bytes + length bounds), which is all it's responsible for.
_FAKE_JPEG_BYTES = b"\xff\xd8" + (b"\x00" * 200) + b"\xff\xd9"
_VALID_IMAGE = "data:image/jpeg;base64," + base64.b64encode(_FAKE_JPEG_BYTES).decode()

@pytest.fixture(autouse=True)
def _generous_ai_rate_limit(monkeypatch):
    """RateLimitMiddleware's bucket is keyed by client IP, and Starlette's
    TestClient always reports "testclient" — so it's shared across every
    test file in the session. test_security.py::test_ai_rate_limit_returns_429
    intentionally saturates that exact bucket to verify 429 behavior; without
    this, any AI-endpoint test that happens to run afterward (alphabetically,
    this file does) spuriously 429s on an already-full bucket that hasn't
    aged out yet. Raising the limit — not clearing the bucket — keeps this
    self-contained per test file."""
    monkeypatch.setattr(get_settings(), "ai_rate_limit_requests", 10_000)


_VALID_PAYLOAD = {
    "user_query": "Evaluate site safety",
    "persona": "developer",
    "map_image_base64": _VALID_IMAGE,
    "lat": 14.5995,
    "lng": 120.9842,
    "deterministic_scores": {"flood": 45},
    "active_layers": ["overall"],
}


# ---------------------------------------------------------------- fakes
class _FakeResponse:
    def __init__(self, status_code, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data
        self.text = text or (str(json_data) if json_data is not None else "")

    def json(self):
        return self._json


class _FakeAsyncClient:
    def __init__(self, response=None, raise_exc=None, **_kwargs):
        self._response = response
        self._raise_exc = raise_exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def post(self, *_args, **_kwargs):
        if self._raise_exc:
            raise self._raise_exc
        return self._response


def _mock_provider(monkeypatch, response=None, raise_exc=None):
    monkeypatch.setattr(
        spatial_vision.httpx, "AsyncClient",
        lambda *a, **kw: _FakeAsyncClient(response=response, raise_exc=raise_exc),
    )


# ---------------------------------------------------------------- schema validation (client layer)
def test_missing_image_field_rejected():
    client = TestClient(app)
    payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "map_image_base64"}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_wrong_mime_type_rejected():
    client = TestClient(app)
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/png;base64," + base64.b64encode(_FAKE_JPEG_BYTES).decode()}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_invalid_base64_rejected():
    client = TestClient(app)
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/jpeg;base64,not-valid-base64!!!"}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_empty_image_payload_rejected():
    client = TestClient(app)
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/jpeg;base64,"}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_truncated_image_rejected():
    """Below the minimum plausible decoded size (100 bytes)."""
    client = TestClient(app)
    tiny = base64.b64encode(b"\xff\xd8\xff\xd9").decode()
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/jpeg;base64," + tiny}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_bad_magic_bytes_rejected():
    """Valid base64, plausible length, but not actually JPEG content."""
    client = TestClient(app)
    not_jpeg = base64.b64encode(b"\x00" * 200).decode()
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/jpeg;base64," + not_jpeg}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


def test_oversized_payload_rejected():
    client = TestClient(app)
    oversized = base64.b64encode(b"\xff\xd8" + b"\x00" * 1_300_000).decode()
    payload = {**_VALID_PAYLOAD, "map_image_base64": "data:image/jpeg;base64," + oversized}
    assert client.post("/api/ai/spatial-vision", json=payload).status_code == 422


# ---------------------------------------------------------------- service behavior
@pytest.mark.asyncio
async def test_missing_api_key_returns_safe_local_fallback(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "")
    result = await analyze_spatial_viewport(
        "query", "developer", _VALID_IMAGE, 14.6, 120.9, {"flood": 45}, ["overall"]
    )
    assert result["status"] == "success"
    assert result["engine"] == "qwen-vl-local-fallback"
    assert "grounded_analysis" in result


@pytest.mark.asyncio
async def test_provider_timeout_raises_generic_error(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    _mock_provider(monkeypatch, raise_exc=spatial_vision.httpx.TimeoutException("timed out"))
    with pytest.raises(SpatialVisionError) as exc:
        await analyze_spatial_viewport(
            "query", "developer", _VALID_IMAGE, 14.6, 120.9, {}, []
        )
    assert "timed out" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_provider_error_does_not_leak_raw_response(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    sensitive_body = "internal-request-id=abc123 account=super-secret-account"
    _mock_provider(monkeypatch, response=_FakeResponse(500, text=sensitive_body))
    with pytest.raises(SpatialVisionError) as exc:
        await analyze_spatial_viewport(
            "query", "developer", _VALID_IMAGE, 14.6, 120.9, {}, []
        )
    assert sensitive_body not in str(exc.value)


@pytest.mark.asyncio
async def test_provider_rate_limit_returns_specific_message(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    _mock_provider(monkeypatch, response=_FakeResponse(429, text="rate limited"))
    with pytest.raises(SpatialVisionError) as exc:
        await analyze_spatial_viewport(
            "query", "developer", _VALID_IMAGE, 14.6, 120.9, {}, []
        )
    assert "rate limit" in str(exc.value).lower()


@pytest.mark.asyncio
async def test_malformed_provider_response_raises_generic_error(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    _mock_provider(monkeypatch, response=_FakeResponse(200, json_data={"unexpected": "shape"}))
    with pytest.raises(SpatialVisionError):
        await analyze_spatial_viewport(
            "query", "developer", _VALID_IMAGE, 14.6, 120.9, {}, []
        )


@pytest.mark.asyncio
async def test_successful_provider_response_returns_grounded_analysis(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    good_response = _FakeResponse(200, json_data={
        "choices": [{"message": {"content": "This area has moderate flood risk."}}]
    })
    _mock_provider(monkeypatch, response=good_response)
    result = await analyze_spatial_viewport(
        "query", "developer", _VALID_IMAGE, 14.6, 120.9, {"flood": 45}, ["overall"]
    )
    assert result["status"] == "success"
    assert result["grounded_analysis"] == "This area has moderate flood risk."
    assert result["engine"] == get_settings().qwen_vision_model


def test_endpoint_success_end_to_end(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    good_response = _FakeResponse(200, json_data={
        "choices": [{"message": {"content": "Grounded analysis text."}}]
    })
    _mock_provider(monkeypatch, response=good_response)
    client = TestClient(app)
    resp = client.post("/api/ai/spatial-vision", json=_VALID_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["grounded_analysis"] == "Grounded analysis text."


def test_endpoint_provider_failure_returns_controlled_502(monkeypatch):
    monkeypatch.setattr(get_settings(), "qwen_api_key", "dummy-key")
    _mock_provider(monkeypatch, response=_FakeResponse(500, text="raw provider internals"))
    client = TestClient(app)
    resp = client.post("/api/ai/spatial-vision", json=_VALID_PAYLOAD)
    assert resp.status_code == 502
    assert "raw provider internals" not in resp.text
