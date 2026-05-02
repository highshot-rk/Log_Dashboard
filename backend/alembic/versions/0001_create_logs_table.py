"""create logs table

Revision ID: 0001_create_logs_table
Revises:
Create Date: 2026-05-01 10:05:00
"""

from alembic import op


revision = "0001_create_logs_table"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS logs (
            id BIGSERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL,
            severity VARCHAR(16) NOT NULL,
            source VARCHAR(128) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_logs_severity_timestamp ON logs (severity, timestamp);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp ON logs (source, timestamp);")


def downgrade() -> None:
    op.drop_index("idx_logs_source_timestamp", table_name="logs")
    op.drop_index("idx_logs_severity_timestamp", table_name="logs")
    op.drop_index("idx_logs_timestamp", table_name="logs")
    op.drop_table("logs")
