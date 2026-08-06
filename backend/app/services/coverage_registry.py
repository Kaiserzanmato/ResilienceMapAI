"""Versioned, runtime hazard-provider routing with no silent fallback."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(__file__).parents[1] / "data" / "coverage_registry.json"


@lru_cache
def registry() -> dict[str, Any]:
    with REGISTRY_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def providers_for(country_code: str | None, hazard: str) -> tuple[list[dict[str, Any]], bool]:
    """Return priority-ordered providers and whether a global fallback is used."""
    data = registry()
    country = (country_code or "").upper()
    local = data.get("countries", {}).get(country, {}).get(hazard, [])
    global_providers = data["defaults"].get(hazard, [])
    providers = sorted([*local, *global_providers], key=lambda item: item["priority"])
    # A source with metadata only is intentionally not executable. Selecting a
    # configured global connector after it is therefore a visible fallback.
    local_is_executable = any(item["status"] == "configured" for item in local)
    return providers, bool(global_providers and not local_is_executable)


def supported_hazards() -> list[str]:
    return list(registry()["defaults"])
