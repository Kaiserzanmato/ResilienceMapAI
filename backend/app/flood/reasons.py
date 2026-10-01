"""Closed vocabulary of flood-capture reason codes. Jobs store and the API
returns only these codes, never raw exception text (which can carry signed
URLs, hostnames or file paths)."""
from __future__ import annotations

REASON_LABELS = {
    "no_recent_scene": "No recent Sentinel scene covers this spot.",
    "no_usable_scene": "Recent scenes were too cloudy or too partial to measure water here.",
    "scene_search_failed": "The satellite catalog could not be searched.",
    "raster_read_failed": "Satellite imagery could not be read.",
    "raster_stack_missing": "Satellite processing is not installed on this server.",
    "read_too_large": "The capture area was too large to read safely.",
    "area_too_large": "The capture area is too large (over 100 km2).",
    "flag_missing": "The flag for this job no longer exists.",
    "lease_expired": "Processing stopped before it finished and ran out of attempts.",
    "internal_error": "Capture failed unexpectedly.",
}

# Failures that retrying cannot fix.
PERMANENT = {"read_too_large", "area_too_large", "raster_stack_missing", "flag_missing"}


def classify(exc: BaseException, stage: str) -> str:
    """Map an exception to a reason code by type name, so this module (and the
    API importing it) needs none of the raster libraries."""
    name = type(exc).__name__
    if name == "AreaTooLarge":
        return "area_too_large"
    if name == "ReadTooLarge":
        return "read_too_large"
    if isinstance(exc, ImportError):
        return "raster_stack_missing"
    if isinstance(exc, MemoryError):
        return "read_too_large"
    if stage == "search":
        return "scene_search_failed"
    if isinstance(exc, (OSError, TimeoutError, ConnectionError)) or name.startswith("Rasterio") or "CPLE" in name:
        return "raster_read_failed"
    return "internal_error"
