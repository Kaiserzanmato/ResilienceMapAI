"""Manual upload connector — for official sources without stable public APIs (e.g. PAGASA, PHIVOLCS)."""
from __future__ import annotations
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def validate_manual_upload(payload: dict) -> tuple[bool, list[str]]:
    """Validate a manually uploaded dataset entry."""
    errors = []
    required = ["name", "agency", "category", "url"]
    for field in required:
        if not payload.get(field):
            errors.append(f"Missing required field: {field}")
    url = payload.get("url", "")
    if url and not url.startswith("https://"):
        errors.append("URL must use HTTPS")
    return len(errors) == 0, errors


def build_manual_source_entry(
    payload: dict,
    uploaded_by: Optional[str] = None,
) -> dict:
    """Build a normalized source entry from a manual upload form."""
    return {
        "source_id": "manual-upload",
        "source_name": payload.get("name", "Manual Dataset"),
        "organization": payload.get("agency", "Unknown"),
        "url": payload.get("url", ""),
        "category": payload.get("category", "unknown"),
        "confidence": payload.get("confidence", "Medium"),
        "records": payload.get("records", 0),
        "ingested_by": uploaded_by,
        "access_type": "manual",
        "confidence_category": "manual_curated_record",
        "trust_level": 5,
    }
