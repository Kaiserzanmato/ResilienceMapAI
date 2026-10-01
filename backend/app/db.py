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
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings


# libpq-style query parameters asyncpg rejects as unknown keyword arguments. Managed
# hosts (Neon, Supabase) hand out URLs carrying them; SSL is passed via connect_args.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding"}
_SSL_REQUIRED_MODES = {"require", "verify-ca", "verify-full"}


def _with_asyncpg_scheme(database_url: str) -> str:
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            return "postgresql+asyncpg://" + database_url[len(prefix):]
    return database_url


def _sslmode(database_url: str) -> str | None:
    values = parse_qs(urlsplit(database_url).query).get("sslmode")
    return values[0].lower() if values else None


def to_asyncpg_url(database_url: str) -> str:
    """Normalize a plain postgres:// or postgresql:// URL (the shape Marketplace and
    Neon integrations hand out) to the asyncpg driver SQLAlchemy needs, dropping the
    libpq-only `sslmode` / `channel_binding` query parameters asyncpg does not accept.
    Use asyncpg_connect_args() for the SSL setting those parameters expressed."""
    url = _with_asyncpg_scheme(database_url)
    parts = urlsplit(url)
    if not parts.query:
        return url
    kept = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k.lower() not in _LIBPQ_ONLY_PARAMS]
    return urlunsplit(parts._replace(query=urlencode(kept)))


def asyncpg_connect_args(database_url: str) -> dict:
    """connect_args for create_async_engine: SSL from `sslmode`, and no prepared
    statement cache behind a PgBouncer-style pooler (Neon `-pooler` hosts), where
    cached prepared statements can land on a different server connection."""
    args: dict = {}
    mode = _sslmode(database_url)
    if mode in _SSL_REQUIRED_MODES:
        args["ssl"] = True
    elif mode == "disable":
        args["ssl"] = False
    host = urlsplit(database_url).hostname or ""
    if "-pooler" in host:
        args["statement_cache_size"] = 0
        args["prepared_statement_cache_size"] = 0
    return args


@lru_cache()
def get_engine() -> AsyncEngine:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "get_engine() called with no DATABASE_URL configured — callers "
            "must check settings.database_url before using the DB-backed "
            "repositories."
        )
    return create_async_engine(
        to_asyncpg_url(settings.database_url),
        pool_pre_ping=True,
        connect_args=asyncpg_connect_args(settings.database_url),
    )


@lru_cache()
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


def database_configured() -> bool:
    return bool(get_settings().database_url)
