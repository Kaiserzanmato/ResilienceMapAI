"""Flood extents: total water and flood hectares (permanent water excluded).

Adds two nullable columns and nothing else, so it is metadata-only on Postgres
(no table rewrite, no backfill):

  total_water_ha  all open water the satellite saw in the capture box
  flood_ha        total minus JRC permanent water; NULL when the filter did not
                  run (the JRC fetch failed, or the extent predates this migration)

water_area_m2 keeps meaning "area of the stored geometry", which from now on is
the flood area when flood_ha is set.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE flood_extents ADD COLUMN IF NOT EXISTS total_water_ha DOUBLE PRECISION")
    op.execute("ALTER TABLE flood_extents ADD COLUMN IF NOT EXISTS flood_ha DOUBLE PRECISION")


def downgrade() -> None:
    op.execute("ALTER TABLE flood_extents DROP COLUMN IF EXISTS flood_ha")
    op.execute("ALTER TABLE flood_extents DROP COLUMN IF EXISTS total_water_ha")
