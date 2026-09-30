"""Dataset governance: tier-5 uploads with a review workflow, and provenance
columns on hazard_events so synced feed records can be persisted.

Revision ID: 0004
Revises: 0002
Create Date: 2026-09-30

NOTE: numbered 0004 to leave 0003 free for the flood-extents migration
(feat/flood-extents). Whichever branch merges second must set its
down_revision to the other's revision id so Alembic keeps a single head.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Uploads are tier 5 (user upload) until a reviewer approves them; only
    # approved rows may influence scoring or AI grounding.
    op.add_column("uploaded_datasets", sa.Column("trust_level", sa.Integer, nullable=False, server_default="5"))
    op.add_column("uploaded_datasets", sa.Column("review_status", sa.String, nullable=False, server_default="pending"))
    op.add_column("uploaded_datasets", sa.Column("license", sa.String, nullable=True))
    op.add_column("uploaded_datasets", sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("uploaded_datasets", sa.Column("checksum", sa.String, nullable=True))
    op.add_column("uploaded_datasets", sa.Column("created_by", sa.String, nullable=True))
    op.create_check_constraint(
        "ck_uploaded_datasets_review_status", "uploaded_datasets",
        "review_status IN ('pending', 'approved', 'rejected')",
    )

    # Provenance for events persisted from scheduled syncs.
    op.add_column("hazard_events", sa.Column("provider", sa.String, nullable=True))
    op.add_column("hazard_events", sa.Column("source_tier", sa.Integer, nullable=True))
    op.add_column("hazard_events", sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_hazard_events_provider", "hazard_events", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_hazard_events_provider", table_name="hazard_events")
    for column in ("retrieved_at", "source_tier", "provider"):
        op.drop_column("hazard_events", column)
    op.drop_constraint("ck_uploaded_datasets_review_status", "uploaded_datasets", type_="check")
    for column in ("created_by", "checksum", "last_verified_at", "license", "review_status", "trust_level"):
        op.drop_column("uploaded_datasets", column)
