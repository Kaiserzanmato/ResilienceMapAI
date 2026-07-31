"""initial foundation-phase tables: sync_health, sync_audit_log,
uploaded_datasets, reports

Revision ID: 0001
Revises:
Create Date: 2026-08-01
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sync_health",
        sa.Column("source_id", sa.String, primary_key=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_status", sa.String),
        sa.Column("records_synced", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    op.create_table(
        "sync_audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_id", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("records_synced", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text),
        sa.Column("duration_ms", sa.Integer),
    )
    op.create_index("ix_sync_audit_log_timestamp", "sync_audit_log", ["timestamp"])
    op.create_index("ix_sync_audit_log_source_id", "sync_audit_log", ["source_id"])

    op.create_table(
        "uploaded_datasets",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("agency", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("url", sa.String, nullable=False),
        sa.Column("confidence", sa.String, nullable=False),
        sa.Column("records", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("payload", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("uploaded_datasets")
    op.drop_index("ix_sync_audit_log_source_id", table_name="sync_audit_log")
    op.drop_index("ix_sync_audit_log_timestamp", table_name="sync_audit_log")
    op.drop_table("sync_audit_log")
    op.drop_table("sync_health")
