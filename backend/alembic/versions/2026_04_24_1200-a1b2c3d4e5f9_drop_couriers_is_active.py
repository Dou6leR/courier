"""drop couriers.is_active (redundant with is_available)

Revision ID: a1b2c3d4e5f9
Revises: f3a4b5c6d7e8
Create Date: 2026-04-24 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f9"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("couriers", "is_active")


def downgrade() -> None:
    op.add_column(
        "couriers",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
