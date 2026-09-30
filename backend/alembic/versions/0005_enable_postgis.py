"""Explicitly enable the PostGIS extension.

0002 already runs CREATE EXTENSION before creating the geometry column; this
migration makes the requirement its own step so a database that was provisioned
with PostGIS ahead of time, or one created fresh, reaches the same state and the
chain documents the dependency. Idempotent (IF NOT EXISTS).

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-01
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    # Deliberate no-op: other objects (hazard_events.geom) depend on the extension,
    # and dropping it could also remove data another app on this database uses.
    pass
