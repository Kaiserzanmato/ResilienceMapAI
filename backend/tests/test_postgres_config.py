"""Neon/Postgres connection plumbing: URL normalisation for asyncpg, SSL through
connect_args, a single linear Alembic chain, and the FIRMS "not configured" status.
No database or network is used."""
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient

from app.config import get_settings
from app.data_sources.sync.source_sync_health import get_sync_health_report
from app.db import asyncpg_connect_args, to_asyncpg_url
from app.main import app
from app.repositories.sync_health_repo import get_sync_health_repo

BACKEND = Path(__file__).resolve().parents[1]
NEON = "postgresql://user:p%40ss@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"


def test_neon_url_is_rewritten_for_asyncpg_without_libpq_params():
    url = to_asyncpg_url(NEON)
    assert url == "postgresql+asyncpg://user:p%40ss@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb"
    assert "sslmode" not in url and "channel_binding" not in url


def test_ssl_comes_from_sslmode_through_connect_args():
    assert asyncpg_connect_args(NEON)["ssl"] is True
    assert asyncpg_connect_args("postgresql://u:p@db.example.com/app?sslmode=verify-full")["ssl"] is True
    assert asyncpg_connect_args("postgresql://u:p@localhost/app?sslmode=disable")["ssl"] is False
    assert "ssl" not in asyncpg_connect_args("postgresql://u:p@localhost/app")


def test_pooler_hosts_disable_the_prepared_statement_cache():
    args = asyncpg_connect_args(NEON)
    assert args["statement_cache_size"] == 0 and args["prepared_statement_cache_size"] == 0
    direct = asyncpg_connect_args("postgresql://u:p@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")
    assert "statement_cache_size" not in direct


@pytest.mark.parametrize("raw,expected", [
    ("postgres://u:p@h/db", "postgresql+asyncpg://u:p@h/db"),
    ("postgresql://u:p@h/db", "postgresql+asyncpg://u:p@h/db"),
    ("postgresql+asyncpg://u:p@h/db", "postgresql+asyncpg://u:p@h/db"),
    ("postgresql://u:p@h/db?application_name=x&sslmode=require", "postgresql+asyncpg://u:p@h/db?application_name=x"),
])
def test_scheme_and_other_params_are_preserved(raw, expected):
    assert to_asyncpg_url(raw) == expected


def test_alembic_chain_is_linear_and_ends_with_postgis():
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    assert script.get_heads() == ["0005"]
    chain = [rev.revision for rev in script.walk_revisions()]
    assert chain == ["0005", "0004", "0002", "0001"]


def test_postgis_migration_is_idempotent_and_its_downgrade_is_a_no_op():
    source = (BACKEND / "alembic" / "versions" / "0005_enable_postgis.py").read_text()
    assert "CREATE EXTENSION IF NOT EXISTS postgis" in source
    downgrade = source.split("def downgrade", 1)[1]
    assert "op." not in downgrade


@pytest.fixture
def _no_firms_key_and_clean_health(monkeypatch):
    monkeypatch.setattr(get_settings(), "nasa_firms_map_key", "")
    health = get_sync_health_repo()
    if hasattr(health, "_health"):
        health._health.clear()


async def test_health_reports_firms_not_configured_instead_of_stale(_no_firms_key_and_clean_health):
    firms = next(h for h in await get_sync_health_report() if h["source_id"] == "nasa-firms")
    assert firms["last_sync_status"] == "not_configured"
    assert firms["reason_code"] == "not_configured"
    assert firms["is_stale"] is False
    # Other wired sources that have simply never synced are still reported as stale.
    usgs = next(h for h in await get_sync_health_report() if h["source_id"] == "usgs-earthquake")
    assert usgs["last_sync_status"] == "never" and usgs["is_stale"] is True


async def test_firms_with_a_key_that_never_synced_is_still_stale(monkeypatch):
    monkeypatch.setattr(get_settings(), "nasa_firms_map_key", "some-key")
    get_sync_health_repo()._health.clear()
    firms = next(h for h in await get_sync_health_report() if h["source_id"] == "nasa-firms")
    assert firms["last_sync_status"] == "never" and firms["is_stale"] is True


def test_sync_health_endpoint_shows_not_configured(monkeypatch, _no_firms_key_and_clean_health):
    entries = TestClient(app).get("/api/sync-health").json()["sync_health"]
    assert next(e for e in entries if e["source_id"] == "nasa-firms")["last_sync_status"] == "not_configured"
