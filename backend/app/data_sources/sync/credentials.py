"""Which wired sources need a credential we don't have.

Shared by the sync runner (skip instead of recording a fake success) and the
health report (show "not configured" instead of "stale")."""
from __future__ import annotations

from ...config import get_settings


def missing_credentials(source_id: str) -> bool:
    if source_id == "nasa-firms":
        return not get_settings().nasa_firms_map_key
    return False
