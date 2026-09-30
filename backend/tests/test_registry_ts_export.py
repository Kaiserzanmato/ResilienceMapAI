"""The frontend's sources.registry.ts is generated from the Python registry. These
tests fail if the committed file drifts from the registry, and pin the sync
frequencies that an inline comment once silently swallowed."""
import importlib.util
from pathlib import Path

import pytest

from app.data_sources.registry.sources_registry import get_source_by_id

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = REPO_ROOT / "backend" / "scripts" / "export_ts_registry.py"
COMMITTED_TS = REPO_ROOT / "frontend" / "data-sources" / "registry" / "sources.registry.ts"

# Sources with no connector: auto-sync is off, but their cadence metadata must survive.
NO_CONNECTOR_FREQUENCIES = {"gdacs-rss": 10, "noaa-nws-api": 15, "hdx": 360, "ifrc-go": 180, "worldbank-open": 43200}


def _load_generator():
    spec = importlib.util.spec_from_file_location("export_ts_registry", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_ts_registry_matches_the_generator_output():
    generated = _load_generator().render_ts()
    assert generated == COMMITTED_TS.read_text(encoding="utf-8"), (
        "frontend/data-sources/registry/sources.registry.ts is stale; regenerate it with "
        "`python backend/scripts/export_ts_registry.py` from the repo root."
    )


@pytest.mark.parametrize("source_id,minutes", NO_CONNECTOR_FREQUENCIES.items())
def test_no_connector_sources_keep_their_sync_frequency(source_id, minutes):
    source = get_source_by_id(source_id)
    assert source.auto_sync_enabled is False
    assert source.sync_frequency_minutes == minutes


@pytest.mark.parametrize("source_id", NO_CONNECTOR_FREQUENCIES)
def test_generated_ts_reports_auto_sync_off_and_the_frequency(source_id):
    block = COMMITTED_TS.read_text(encoding="utf-8").split(f'id: "{source_id}"', 1)[1].split("\n  },", 1)[0]
    assert "autoSyncEnabled: false" in block
    assert f"syncFrequencyMinutes: {NO_CONNECTOR_FREQUENCIES[source_id]}" in block
