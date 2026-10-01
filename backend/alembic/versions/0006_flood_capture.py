"""Flood auto-capture: user flags, satellite-derived flood extents and a
persistent job queue.

0003 was reserved for flood extents and never used; this migration takes its
place in the chain after 0005. Raw DDL (like 0002) because the app has no
geoalchemy2 dependency for typed geometry columns.

  flood_flags        a spot a user flagged as flooding (point + hashed client id)
  flood_extents      water polygons derived from one satellite scene over one AOI
  flood_capture_jobs one capture attempt per flag; survives restarts (leases)

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-01
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.execute("""
        CREATE TABLE flood_flags (
            id BIGSERIAL PRIMARY KEY,
            geom geometry(Point, 4326) NOT NULL,
            note TEXT,
            observed_at TIMESTAMPTZ,
            client_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            review_status TEXT NOT NULL DEFAULT 'unreviewed',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ck_flood_flags_review CHECK (review_status IN ('unreviewed', 'confirmed', 'rejected'))
        )
    """)
    op.execute("CREATE INDEX ix_flood_flags_geom ON flood_flags USING GIST (geom)")
    op.execute("CREATE INDEX ix_flood_flags_client_created ON flood_flags (client_hash, created_at)")

    op.execute("""
        CREATE TABLE flood_extents (
            id BIGSERIAL PRIMARY KEY,
            source TEXT NOT NULL,
            scene_id TEXT NOT NULL,
            acquired_at TIMESTAMPTZ NOT NULL,
            tile_key TEXT NOT NULL,
            aoi geometry(Polygon, 4326) NOT NULL,
            geom geometry(MultiPolygon, 4326),
            water_area_m2 DOUBLE PRECISION NOT NULL DEFAULT 0,
            method JSONB NOT NULL DEFAULT '{}'::jsonb,
            source_tier INTEGER NOT NULL DEFAULT 3,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_flood_extents_scene_tile UNIQUE (source, scene_id, tile_key),
            CONSTRAINT ck_flood_extents_source CHECK (source IN ('s1-rtc-pc', 's2-l2a-e84'))
        )
    """)
    op.execute("CREATE INDEX ix_flood_extents_geom ON flood_extents USING GIST (geom)")
    op.execute("CREATE INDEX ix_flood_extents_acquired_at ON flood_extents (acquired_at)")

    op.execute("""
        CREATE TABLE flood_capture_jobs (
            id BIGSERIAL PRIMARY KEY,
            flag_id BIGINT NOT NULL REFERENCES flood_flags (id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            lease_until TIMESTAMPTZ,
            reason_code TEXT,
            extent_id BIGINT REFERENCES flood_extents (id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ck_flood_jobs_status CHECK (status IN ('queued', 'running', 'done', 'no_scene', 'failed'))
        )
    """)
    op.execute("CREATE INDEX ix_flood_capture_jobs_status_created ON flood_capture_jobs (status, created_at)")


def downgrade() -> None:
    # Reverse dependency order: jobs reference flags and extents.
    op.execute("DROP TABLE IF EXISTS flood_capture_jobs")
    op.execute("DROP TABLE IF EXISTS flood_extents")
    op.execute("DROP TABLE IF EXISTS flood_flags")
