"""hazard_events table for Firecrawl-ingested unstructured advisories, with
a PostGIS point geometry column.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-ops if already enabled; required for the geometry column below.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "hazard_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("event_type", sa.String, nullable=False),
        sa.Column("source_agency", sa.String, nullable=False),
        sa.Column("location_name", sa.String, nullable=False),
        sa.Column("severity_level", sa.Integer, nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("citation_url", sa.String, nullable=False, unique=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    # geometry(Point, 4326) is PostGIS's own type — added via raw DDL since
    # the app has no geoalchemy2 dependency for a typed sa.Column equivalent.
    op.execute("ALTER TABLE hazard_events ADD COLUMN geom geometry(Point, 4326)")
    op.execute("CREATE INDEX ix_hazard_events_geom ON hazard_events USING GIST (geom)")


def downgrade() -> None:
    op.drop_table("hazard_events")
