"""Alembic environment — run manually/out-of-band against a real database
(e.g. `alembic upgrade head` from a dev machine after `vercel env pull`),
never from inside the Vercel serverless function.

Uses ALEMBIC_DATABASE_URL if set (the direct/unpooled connection string —
DDL should not go through a transaction pooler like PgBouncer), falling back
to DATABASE_URL otherwise.
"""
import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import to_asyncpg_url  # noqa: E402
from app.models import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    url = os.getenv("ALEMBIC_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "Set ALEMBIC_DATABASE_URL (preferred: the direct/unpooled "
            "connection string) or DATABASE_URL before running Alembic."
        )
    return to_asyncpg_url(url)


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        {"sqlalchemy.url": _database_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
