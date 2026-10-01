"""Guard: the suite must never talk to a real database, even when
backend/.env.local holds Neon connection strings (see tests/conftest.py)."""
import os

from app.db import database_configured
from app.repositories.dataset_repo import InMemoryDatasetRepo, get_dataset_repo
from app.repositories.flood_repo import InMemoryFloodRepo, get_flood_repo


def test_database_urls_are_blank_during_tests():
    assert os.environ.get("DATABASE_URL") == ""
    assert os.environ.get("ALEMBIC_DATABASE_URL") == ""


def test_repo_layer_is_in_memory_during_tests():
    assert not database_configured()
    assert isinstance(get_dataset_repo(), InMemoryDatasetRepo)


def test_flood_repo_is_in_memory_during_tests():
    # The flood tests write flags, jobs and extents; they must never reach Neon.
    assert isinstance(get_flood_repo(), InMemoryFloodRepo)


def test_the_app_starts_without_the_raster_stack():
    import subprocess
    import sys

    code = ("import sys\n"
            "for name in ('numpy', 'rasterio', 'shapely', 'pystac_client', 'planetary_computer'):\n"
            "    sys.modules[name] = None\n"
            "import app.main\n")
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                            env={**os.environ, "DATABASE_URL": "", "ALEMBIC_DATABASE_URL": ""})
    assert result.returncode == 0, result.stderr[-500:]
