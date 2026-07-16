"""add triggers, stored procedure and indexes

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-04-20 19:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Indexes ---
    op.create_index("ix_orders_sender_id", "orders", ["sender_id"])
    op.create_index("ix_orders_recipient_id", "orders", ["recipient_id"])
    op.create_index("ix_order_logistics_courier_id", "order_logistics", ["courier_id"])

    # --- Trigger 1: recalculate courier rating_avg on review insert/delete ---
    op.execute("""
        CREATE FUNCTION fn_recalc_courier_rating() RETURNS trigger AS $$
        DECLARE
            v_courier_id INT;
            v_new_avg NUMERIC(3,2);
        BEGIN
            SELECT ol.courier_id INTO v_courier_id
            FROM order_logistics ol
            WHERE ol.order_id = COALESCE(NEW.order_id, OLD.order_id);

            IF v_courier_id IS NOT NULL THEN
                SELECT COALESCE(AVG(r.rating), 0) INTO v_new_avg
                FROM reviews r
                JOIN orders o ON o.id = r.order_id
                JOIN order_logistics ol ON ol.order_id = o.id
                WHERE ol.courier_id = v_courier_id;

                UPDATE couriers SET rating_avg = v_new_avg
                WHERE user_id = v_courier_id;
            END IF;

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_recalc_courier_rating
            AFTER INSERT OR DELETE ON reviews
            FOR EACH ROW EXECUTE FUNCTION fn_recalc_courier_rating();
    """)

    # --- Trigger 2: validate order status transitions ---
    op.execute("""
        CREATE FUNCTION fn_validate_order_status() RETURNS trigger AS $$
        BEGIN
            IF OLD.status = NEW.status THEN
                RETURN NEW;
            END IF;

            IF OLD.status = 'pending' AND NEW.status IN ('assigned', 'cancelled') THEN
                RETURN NEW;
            ELSIF OLD.status = 'assigned' AND NEW.status IN ('picked_up', 'delivered', 'pending', 'cancelled') THEN
                RETURN NEW;
            ELSIF OLD.status = 'picked_up' AND NEW.status IN ('delivered', 'cancelled') THEN
                RETURN NEW;
            ELSE
                RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_validate_order_status
            BEFORE UPDATE OF status ON orders
            FOR EACH ROW EXECUTE FUNCTION fn_validate_order_status();
    """)

    # --- Stored procedure: analytics summary ---
    op.execute("""
        CREATE PROCEDURE sp_analytics_summary(
            IN p_date_from TIMESTAMPTZ,
            IN p_date_to   TIMESTAMPTZ,
            IN p_service_fee NUMERIC,
            INOUT out_revenue NUMERIC DEFAULT 0,
            INOUT out_total_income NUMERIC DEFAULT 0,
            INOUT out_deliveries INT DEFAULT 0,
            INOUT out_completion_rate NUMERIC DEFAULT 0,
            INOUT out_active_couriers INT DEFAULT 0,
            INOUT out_avg_delivery_minutes NUMERIC DEFAULT NULL
        )
        LANGUAGE plpgsql
        AS $proc$
        DECLARE
            v_non_cancelled INT;
            v_avg_seconds NUMERIC;
        BEGIN
            SELECT COALESCE(SUM(p.amount), 0) INTO out_total_income
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE o.status = 'delivered'
              AND p.paid_at IS NOT NULL
              AND p.refunded_at IS NULL
              AND o.created_at BETWEEN p_date_from AND p_date_to;

            SELECT COUNT(*) INTO out_deliveries
            FROM orders
            WHERE status = 'delivered'
              AND created_at BETWEEN p_date_from AND p_date_to;

            SELECT COUNT(*) INTO v_non_cancelled
            FROM orders
            WHERE status != 'cancelled'
              AND created_at BETWEEN p_date_from AND p_date_to;

            SELECT ROUND(COUNT(*) * p_service_fee, 2) INTO out_revenue
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE o.status = 'delivered'
              AND p.paid_at IS NOT NULL
              AND p.refunded_at IS NULL
              AND o.created_at BETWEEN p_date_from AND p_date_to;

            IF v_non_cancelled > 0 THEN
                out_completion_rate := ROUND(out_deliveries * 100.0 / v_non_cancelled, 1);
            END IF;

            SELECT COUNT(*) INTO out_active_couriers
            FROM couriers c
            JOIN users u ON u.id = c.user_id
            WHERE c.is_available = TRUE AND u.is_active = TRUE;

            SELECT AVG(EXTRACT(EPOCH FROM (ol.actual_delivery_time - ol.actual_pickup_time)))
            INTO v_avg_seconds
            FROM orders o
            JOIN order_logistics ol ON ol.order_id = o.id
            WHERE o.status = 'delivered'
              AND ol.actual_pickup_time IS NOT NULL
              AND ol.actual_delivery_time IS NOT NULL
              AND o.created_at BETWEEN p_date_from AND p_date_to;

            IF v_avg_seconds IS NOT NULL THEN
                out_avg_delivery_minutes := ROUND(v_avg_seconds / 60.0, 1);
            END IF;
        END;
        $proc$;
    """)


def downgrade() -> None:
    op.execute("DROP PROCEDURE IF EXISTS sp_analytics_summary")
    op.execute("DROP TRIGGER IF EXISTS trg_validate_order_status ON orders")
    op.execute("DROP FUNCTION IF EXISTS fn_validate_order_status()")
    op.execute("DROP TRIGGER IF EXISTS trg_recalc_courier_rating ON reviews")
    op.execute("DROP FUNCTION IF EXISTS fn_recalc_courier_rating()")
    op.drop_index("ix_order_logistics_courier_id", table_name="order_logistics")
    op.drop_index("ix_orders_recipient_id", table_name="orders")
    op.drop_index("ix_orders_sender_id", table_name="orders")
