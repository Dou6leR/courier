"""split orders into order_cargos + order_logistics

Revision ID: b7e4d8f2a9c1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-10 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e4d8f2a9c1"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f60102"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create new tables.
    op.create_table(
        "order_cargos",
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(10, 2), nullable=False),
        sa.Column("volume", sa.Numeric(10, 2), nullable=False),
        sa.Column("special_instructions", sa.String(length=1000), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name=op.f("fk_order_cargos_order_id_orders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("order_id", name=op.f("pk_order_cargos")),
    )

    op.create_table(
        "order_logistics",
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column(
            "scheduled_pickup_time", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column(
            "scheduled_delivery_time", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("pickup_address_id", sa.Integer(), nullable=False),
        sa.Column("delivery_address_id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=True),
        sa.Column("suggested_courier_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name=op.f("fk_order_logistics_order_id_orders"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["pickup_address_id"],
            ["addresses.id"],
            name=op.f("fk_order_logistics_pickup_address_id_addresses"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["delivery_address_id"],
            ["addresses.id"],
            name=op.f("fk_order_logistics_delivery_address_id_addresses"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["courier_id"],
            ["couriers.user_id"],
            name=op.f("fk_order_logistics_courier_id_couriers"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["suggested_courier_id"],
            ["couriers.user_id"],
            name=op.f("fk_order_logistics_suggested_courier_id_couriers"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("order_id", name=op.f("pk_order_logistics")),
    )

    # 2. Copy existing data.
    op.execute(
        """
        INSERT INTO order_cargos (order_id, weight, volume, special_instructions)
        SELECT id, weight, volume, special_instructions
        FROM orders
        """
    )
    op.execute(
        """
        INSERT INTO order_logistics (
            order_id, scheduled_pickup_time, scheduled_delivery_time,
            pickup_address_id, delivery_address_id, courier_id, suggested_courier_id
        )
        SELECT id, scheduled_pickup_time, scheduled_delivery_time,
               pickup_address_id, delivery_address_id, courier_id, suggested_courier_id
        FROM orders
        """
    )

    # 3. Drop FKs that pointed out of the moved columns.
    op.drop_constraint(
        op.f("fk_orders_pickup_address_id_addresses"),
        "orders",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_orders_delivery_address_id_addresses"),
        "orders",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_orders_courier_id_couriers"),
        "orders",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_orders_suggested_courier_id_couriers"),
        "orders",
        type_="foreignkey",
    )

    # 4. Drop moved columns from orders.
    op.drop_column("orders", "weight")
    op.drop_column("orders", "volume")
    op.drop_column("orders", "special_instructions")
    op.drop_column("orders", "scheduled_pickup_time")
    op.drop_column("orders", "scheduled_delivery_time")
    op.drop_column("orders", "pickup_address_id")
    op.drop_column("orders", "delivery_address_id")
    op.drop_column("orders", "courier_id")
    op.drop_column("orders", "suggested_courier_id")


def downgrade() -> None:
    # 1. Re-add columns on orders (nullable for data copy).
    op.add_column(
        "orders", sa.Column("weight", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("volume", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "orders",
        sa.Column("special_instructions", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column(
            "scheduled_pickup_time", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "scheduled_delivery_time", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "orders", sa.Column("pickup_address_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("delivery_address_id", sa.Integer(), nullable=True)
    )
    op.add_column("orders", sa.Column("courier_id", sa.Integer(), nullable=True))
    op.add_column(
        "orders", sa.Column("suggested_courier_id", sa.Integer(), nullable=True)
    )

    # 2. Copy data back.
    op.execute(
        """
        UPDATE orders o
        SET weight = c.weight,
            volume = c.volume,
            special_instructions = c.special_instructions
        FROM order_cargos c
        WHERE c.order_id = o.id
        """
    )
    op.execute(
        """
        UPDATE orders o
        SET scheduled_pickup_time = l.scheduled_pickup_time,
            scheduled_delivery_time = l.scheduled_delivery_time,
            pickup_address_id = l.pickup_address_id,
            delivery_address_id = l.delivery_address_id,
            courier_id = l.courier_id,
            suggested_courier_id = l.suggested_courier_id
        FROM order_logistics l
        WHERE l.order_id = o.id
        """
    )

    # 3. Restore NOT NULL on required columns.
    op.alter_column("orders", "weight", nullable=False)
    op.alter_column("orders", "volume", nullable=False)
    op.alter_column("orders", "scheduled_pickup_time", nullable=False)
    op.alter_column("orders", "scheduled_delivery_time", nullable=False)
    op.alter_column("orders", "pickup_address_id", nullable=False)
    op.alter_column("orders", "delivery_address_id", nullable=False)

    # 4. Restore FKs.
    op.create_foreign_key(
        op.f("fk_orders_pickup_address_id_addresses"),
        "orders",
        "addresses",
        ["pickup_address_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        op.f("fk_orders_delivery_address_id_addresses"),
        "orders",
        "addresses",
        ["delivery_address_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        op.f("fk_orders_courier_id_couriers"),
        "orders",
        "couriers",
        ["courier_id"],
        ["user_id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_orders_suggested_courier_id_couriers"),
        "orders",
        "couriers",
        ["suggested_courier_id"],
        ["user_id"],
        ondelete="SET NULL",
    )

    # 5. Drop new tables.
    op.drop_table("order_logistics")
    op.drop_table("order_cargos")
