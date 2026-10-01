"""Guard: the suite must never talk to a real database, even when
backend/.env.local holds Neon connection strings (see tests/conftest.py)."""
import os

from app.db import database_configured
from app.repositories.dataset_repo import InMemoryDatasetRepo, get_dataset_repo


def test_database_urls_are_blank_during_tests():
    assert os.environ.get("DATABASE_URL") == ""
    assert os.environ.get("ALEMBIC_DATABASE_URL") == ""


def test_repo_layer_is_in_memory_during_tests():
    assert not database_configured()
    assert isinstance(get_dataset_repo(), InMemoryDatasetRepo)
