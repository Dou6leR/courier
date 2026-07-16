"""drop in_transit order status

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-18 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Collapse any leftover IN_TRANSIT rows into PICKED_UP (identical semantics).
    op.execute("UPDATE orders SET status = 'picked_up' WHERE status = 'in_transit'")

    # Recreate the enum without in_transit. Postgres has no ALTER TYPE DROP VALUE
    # on pre-v14 versions that can be relied on, so swap the type via a rename.
    op.execute("ALTER TYPE order_status RENAME TO order_status_old")
    op.execute(
        "CREATE TYPE order_status AS ENUM "
        "('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status "
        "TYPE order_status USING status::text::order_status"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status "
        "SET DEFAULT 'pending'::order_status"
    )
    op.execute("DROP TYPE order_status_old")


def downgrade() -> None:
    op.execute("ALTER TYPE order_status RENAME TO order_status_old")
    op.execute(
        "CREATE TYPE order_status AS ENUM "
        "('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status "
        "TYPE order_status USING status::text::order_status"
    )
    op.execute(
        "ALTER TABLE orders ALTER COLUMN status "
        "SET DEFAULT 'pending'::order_status"
    )
    op.execute("DROP TYPE order_status_old")
