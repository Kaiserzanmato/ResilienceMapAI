"""Async SQLAlchemy engine/session setup — created lazily and only when
DATABASE_URL is configured. Every repository in app/repositories/ falls back
to an in-memory implementation when it isn't, so local dev and the existing
test suite never need a live database.

Migrations run out-of-band via Alembic (see backend/alembic/), never inside
this module or the request path — Vercel's Python function is request-
triggered, not a place to run schema migrations on cold start.
"""
from __future__ import annotations

from functools import lru_cache
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings


def to_asyncpg_url(database_url: str) -> str:
    """Normalize a plain postgres:// or postgresql:// URL (the shape Marketplace
    integrations typically hand out) to the asyncpg driver SQLAlchemy needs."""
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + database_url[len("postgresql://"):]
    if database_url.startswith("postgres://"):
        return "postgresql+asyncpg://" + database_url[len("postgres://"):]
    return database_url


@lru_cache()
def get_engine() -> AsyncEngine:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "get_engine() called with no DATABASE_URL configured — callers "
            "must check settings.database_url before using the DB-backed "
            "repositories."
        )
    return create_async_engine(to_asyncpg_url(settings.database_url), pool_pre_ping=True)


@lru_cache()
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


def database_configured() -> bool:
    return bool(get_settings().database_url)
