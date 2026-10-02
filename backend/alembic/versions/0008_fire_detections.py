"""FIRMS active-fire detections, so the risk panel can score Wildfire.

The FIRMS sync used to count the rows it downloaded and drop them; nothing was
stored. This table keeps VIIRS detections (about 35 days, pruned at ingest) with a
geography point and a GiST index for ST_DWithin radius queries.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("""
        CREATE TABLE IF NOT EXISTS fire_detections (
            id BIGSERIAL PRIMARY KEY,
            source TEXT NOT NULL DEFAULT 'VIIRS_SNPP_NRT',
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            geog geography(Point, 4326) NOT NULL,
            acq_at TIMESTAMPTZ NOT NULL,
            satellite TEXT NOT NULL,
            instrument TEXT,
            confidence TEXT,
            frp DOUBLE PRECISION,
            daynight TEXT,
            ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_fire_detections UNIQUE (source, acq_at, latitude, longitude)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_fire_detections_geog ON fire_detections USING GIST (geog)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_fire_detections_acq_at ON fire_detections (acq_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fire_detections")
