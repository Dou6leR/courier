"""courier flow phase 1

Revision ID: a1b2c3d4e5f6
Revises: 393211fec026
Create Date: 2026-04-09 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "393211fec026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # addresses: drop coordinates, add lat/lon
    op.drop_column("addresses", "coordinates")
    op.add_column("addresses", sa.Column("lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("addresses", sa.Column("lon", sa.Numeric(9, 6), nullable=True))

    # couriers: location + availability
    op.add_column(
        "couriers",
        sa.Column("last_known_lat", sa.Numeric(9, 6), nullable=True),
    )
    op.add_column(
        "couriers",
        sa.Column("last_known_lon", sa.Numeric(9, 6), nullable=True),
    )
    op.add_column(
        "couriers",
        sa.Column("last_location_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "couriers",
        sa.Column(
            "is_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # orders: suggested_courier_id
    op.add_column(
        "orders",
        sa.Column("suggested_courier_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_orders_suggested_courier_id_couriers"),
        "orders",
        "couriers",
        ["suggested_courier_id"],
        ["user_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_orders_suggested_courier_id_couriers"),
        "orders",
        type_="foreignkey",
    )
    op.drop_column("orders", "suggested_courier_id")

    op.drop_column("couriers", "is_available")
    op.drop_column("couriers", "last_location_at")
    op.drop_column("couriers", "last_known_lon")
    op.drop_column("couriers", "last_known_lat")

    op.drop_column("addresses", "lon")
    op.drop_column("addresses", "lat")
    op.add_column(
        "addresses",
        sa.Column("coordinates", sa.String(length=64), nullable=True),
    )
