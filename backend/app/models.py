"""SQLAlchemy models for persisted sync health, audit log, uploaded dataset
metadata, and shareable reports.

These back the Postgres-backed repository implementations in
app/repositories/. They are only used when DATABASE_URL is configured — see
each repository module for the in-memory fallback used otherwise (the MVP
default, matching the existing curated-sample-data behavior).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SyncHealthRow(Base):
    """One row per data source — mirrors the in-memory `_sync_health` dict
    previously kept in app/data_sources/sync/source_sync_health.py."""

    __tablename__ = "sync_health"

    source_id: Mapped[str] = mapped_column(String, primary_key=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_successful_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_sync_status: Mapped[Optional[str]] = mapped_column(String)
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )


class SyncAuditLogRow(Base):
    """Append-only sync audit log — mirrors the in-memory `_audit_log` list
    previously kept in app/data_sources/sync/sync_audit_log.py."""

    __tablename__ = "sync_audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source_id: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String)
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)


class UploadedDatasetRow(Base):
    """Admin-submitted dataset metadata — mirrors the in-memory
    `_uploaded_datasets` list previously kept in app/main.py."""

    __tablename__ = "uploaded_datasets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    agency: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String)
    confidence: Mapped[str] = mapped_column(String)
    records: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReportRow(Base):
    """Shareable generated reports — mirrors the in-memory `_REPORT_STORE`
    dict previously kept in app/services/exporters.py."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
