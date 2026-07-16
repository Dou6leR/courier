"""payments refunded_at

Revision ID: c3d4e5f60102
Revises: b2c3d4e5f601
Create Date: 2026-04-16 10:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f60102"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f601"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "refunded_at")
