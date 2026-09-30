"""Closed vocabulary of safe sync-failure reasons.

Raw exception text (URLs, hostnames, upstream bodies, stack details) must never
reach a public response or the persisted health/audit rows — only these codes
do. The full exception is written to server logs at the point of failure.
"""
from __future__ import annotations

import json

import httpx

REASON_LABELS: dict[str, str] = {
    "upstream_timeout": "The data provider did not respond in time.",
    "upstream_unreachable": "The data provider could not be reached.",
    "upstream_rate_limited": "The data provider is rate limiting requests.",
    "upstream_auth_rejected": "The data provider rejected the configured credentials.",
    "upstream_server_error": "The data provider reported a server error.",
    "upstream_http_error": "The data provider returned an unexpected HTTP status.",
    "upstream_invalid_response": "The data provider returned a response that could not be used.",
    "not_configured": "A required credential or setting is not configured.",
    "persistence_error": "Records were fetched but could not be saved.",
    "internal_error": "An internal error occurred during sync.",
    "unknown_error": "The sync failed for an unrecorded reason.",
}


def classify_error(exc: BaseException) -> str:
    if isinstance(exc, httpx.TimeoutException):
        return "upstream_timeout"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return "upstream_rate_limited"
        if status in (401, 403):
            return "upstream_auth_rejected"
        return "upstream_server_error" if status >= 500 else "upstream_http_error"
    if isinstance(exc, httpx.RequestError):
        return "upstream_unreachable"
    if isinstance(exc, (ValueError, json.JSONDecodeError, KeyError, TypeError)):
        return "upstream_invalid_response"
    if type(exc).__module__.startswith("sqlalchemy") or type(exc).__name__ == "PersistenceError":
        return "persistence_error"
    return "internal_error"


def safe_reason(value: str | None) -> str | None:
    """Map any stored value (including legacy raw error strings) into the vocabulary."""
    if not value:
        return None
    return value if value in REASON_LABELS else "unknown_error"
