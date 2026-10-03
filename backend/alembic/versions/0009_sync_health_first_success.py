"""sync_health.first_successful_sync_at: when a source's history (not just its
freshness) started, so pruned/deleted stored rows can never reset "how long have
we been looking" back to zero.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-03
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE sync_health ADD COLUMN IF NOT EXISTS first_successful_sync_at TIMESTAMPTZ")
    # Best-effort backfill for existing rows: the true first success is unknown, so the
    # most recent one is the closest honest estimate (history then grows from here instead
    # of being wrongly reported as already long).
    op.execute("""
        UPDATE sync_health SET first_successful_sync_at = last_successful_sync_at
        WHERE first_successful_sync_at IS NULL AND last_successful_sync_at IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE sync_health DROP COLUMN IF EXISTS first_successful_sync_at")
