"""Shared response validation for fixed, allowlisted provider endpoints."""
from __future__ import annotations

from typing import Any

from ...config import get_settings


def provider_json(response: Any) -> dict[str, Any]:
    """Reject oversized/non-object provider responses before normalization."""
    response.raise_for_status()
    max_bytes = get_settings().events_max_response_bytes
    content_length = response.headers.get("content-length")
    if content_length and int(content_length) > max_bytes:
        raise ValueError("Provider response exceeds configured size limit")
    content = response.content
    if len(content) > max_bytes:
        raise ValueError("Provider response exceeds configured size limit")
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Provider response must be a JSON object")
    return data
