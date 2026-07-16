"""order_logistics time window + courier_route_stops

Revision ID: d1e2f3a4b5c6
Revises: b7e4d8f2a9c1
Create Date: 2026-04-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "b7e4d8f2a9c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- order_logistics: drop legacy, add new fields ----------------------
    op.drop_constraint(
        op.f("fk_order_logistics_suggested_courier_id_couriers"),
        "order_logistics",
        type_="foreignkey",
    )
    op.drop_column("order_logistics", "suggested_courier_id")

    op.alter_column(
        "order_logistics",
        "scheduled_pickup_time",
        new_column_name="requested_pickup_from",
    )

    op.add_column(
        "order_logistics",
        sa.Column("requested_pickup_to", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE order_logistics SET requested_pickup_to = requested_pickup_from + INTERVAL '2 hours'"
    )
    op.alter_column("order_logistics", "requested_pickup_to", nullable=False)

    op.drop_column("order_logistics", "scheduled_delivery_time")

    op.add_column(
        "order_logistics",
        sa.Column("actual_pickup_time", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "order_logistics",
        sa.Column("actual_delivery_time", sa.DateTime(timezone=True), nullable=True),
    )

    # --- courier_route_stops table -----------------------------------------
    op.create_table(
        "courier_route_stops",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=False),
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column(
            "stop_type",
            sa.Enum("pickup", "delivery", name="route_stop_type"),
            nullable=False,
        ),
        sa.Column(
            "estimated_arrival_time", sa.DateTime(timezone=True), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["courier_id"],
            ["couriers.user_id"],
            name=op.f("fk_courier_route_stops_courier_id_couriers"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name=op.f("fk_courier_route_stops_order_id_orders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_courier_route_stops")),
        sa.UniqueConstraint(
            "courier_id",
            "plan_date",
            "seq",
            name=op.f("uq_courier_route_stops_ordering"),
        ),
    )
    op.create_index(
        "ix_courier_route_stops_courier_date",
        "courier_route_stops",
        ["courier_id", "plan_date"],
    )
    op.create_index(
        "ix_courier_route_stops_order_type",
        "courier_route_stops",
        ["order_id", "stop_type"],
    )


def downgrade() -> None:
    # --- courier_route_stops ------------------------------------------------
    op.drop_index("ix_courier_route_stops_order_type", table_name="courier_route_stops")
    op.drop_index(
        "ix_courier_route_stops_courier_date", table_name="courier_route_stops"
    )
    op.drop_table("courier_route_stops")
    sa.Enum(name="route_stop_type").drop(op.get_bind(), checkfirst=False)

    # --- order_logistics: revert fields ------------------------------------
    op.drop_column("order_logistics", "actual_delivery_time")
    op.drop_column("order_logistics", "actual_pickup_time")

    op.add_column(
        "order_logistics",
        sa.Column(
            "scheduled_delivery_time", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.execute(
        "UPDATE order_logistics SET scheduled_delivery_time = requested_pickup_to"
    )
    op.alter_column("order_logistics", "scheduled_delivery_time", nullable=False)

    op.drop_column("order_logistics", "requested_pickup_to")

    op.alter_column(
        "order_logistics",
        "requested_pickup_from",
        new_column_name="scheduled_pickup_time",
    )

    op.add_column(
        "order_logistics",
        sa.Column("suggested_courier_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_order_logistics_suggested_courier_id_couriers"),
        "order_logistics",
        "couriers",
        ["suggested_courier_id"],
        ["user_id"],
        ondelete="SET NULL",
    )
