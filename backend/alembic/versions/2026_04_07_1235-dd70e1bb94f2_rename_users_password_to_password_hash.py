"""rename users.password to password_hash

Revision ID: dd70e1bb94f2
Revises: 3559291aa6b6
Create Date: 2026-04-07 12:35:21.205524

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "dd70e1bb94f2"
down_revision: Union[str, Sequence[str], None] = "3559291aa6b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "password", new_column_name="password_hash")


def downgrade() -> None:
    op.alter_column("users", "password_hash", new_column_name="password")
