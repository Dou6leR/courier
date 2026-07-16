from fastapi import HTTPException, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.admins.services.admin_mappers import (
    derive_payment_status,
    map_order_status_to_ui,
    ui_status_to_db_set,
)
from api.v1.orders.services.order_service import (
    _order_load_options,
    _to_order_out,
)
from core.debug_clock import now_utc
from core.models.address import Address
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.user import User
from core.schemas.admin import (
    AdminOrderDetailOut,
    AdminOrderOut,
    OrderStatusFilter,
)


def _flat_address(addr: Address) -> str:
    parts = [addr.street, addr.building]
    if addr.apartment:
        parts.append(f"кв. {addr.apartment}")
    return ", ".join(parts)


def _order_to_admin_out(order: Order) -> AdminOrderOut:
    sender_user = order.sender.user if order.sender is not None else None
    logistics = order.logistics
    courier = logistics.courier if logistics is not None else None
    courier_user = courier.user if courier is not None else None
    customer = sender_user.full_name if sender_user is not None else "—"
    courier_name = courier_user.full_name if courier_user is not None else None
    amount = float(order.payment.amount) if order.payment is not None else 0.0
    return AdminOrderOut(
        id=order.id,
        customer=customer,
        courier=courier_name,
        status=map_order_status_to_ui(order.status),
        payment_status=derive_payment_status(order.payment, order.status),
        amount=amount,
        date=order.created_at.date().isoformat(),
        from_=_flat_address(logistics.pickup_address),
        to=_flat_address(logistics.delivery_address),
        raw_status=order.status,
        created_at=order.created_at,
    )


def _order_to_admin_detail(order: Order) -> AdminOrderDetailOut:
    base = _order_to_admin_out(order)
    return AdminOrderDetailOut(
        **base.model_dump(by_alias=False),
        order=_to_order_out(order, current_user_id=order.sender_id),
    )


class AdminOrderService:
    @classmethod
    async def _load(cls, session: AsyncSession, order_id: int) -> Order | None:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(*_order_load_options())
        )
        return await session.scalar(stmt)

    @classmethod
    async def _require(cls, session: AsyncSession, order_id: int) -> Order:
        order = await cls._load(session, order_id)
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Замовлення не знайдено",
            )
        return order

    @classmethod
    async def list_orders(
        cls,
        session: AsyncSession,
        status_filter: OrderStatusFilter,
        search: str | None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[AdminOrderOut]:
        stmt = select(Order).options(*_order_load_options())
        db_statuses = ui_status_to_db_set(status_filter)
        if db_statuses is not None:
            stmt = stmt.where(Order.status.in_(db_statuses))
        if search:
            like = f"%{search.strip()}%"
            SenderUser = User.__table__.alias("sender_user")
            CourierUser = User.__table__.alias("courier_user")
            stmt = (
                stmt.outerjoin(SenderUser, Order.sender_id == SenderUser.c.id)
                .outerjoin(
                    OrderLogistics, OrderLogistics.order_id == Order.id
                )
                .outerjoin(
                    CourierUser, OrderLogistics.courier_id == CourierUser.c.id
                )
                .where(
                    or_(
                        cast(Order.id, String).ilike(like),
                        SenderUser.c.full_name.ilike(like),
                        CourierUser.c.full_name.ilike(like),
                    )
                )
            )
        stmt = stmt.order_by(Order.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        rows = (await session.scalars(stmt)).unique().all()
        return [_order_to_admin_out(o) for o in rows]

    @classmethod
    async def get_order(
        cls, session: AsyncSession, order_id: int
    ) -> AdminOrderDetailOut:
        order = await cls._require(session, order_id)
        return _order_to_admin_detail(order)

    @classmethod
    async def cancel_order(
        cls, session: AsyncSession, order_id: int
    ) -> AdminOrderDetailOut:
        from core.models.enums import OrderStatus

        order = await cls._require(session, order_id)
        if order.status in (OrderStatus.CANCELLED, OrderStatus.DELIVERED):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Неможливо скасувати замовлення у цьому статусі",
            )
        order.status = OrderStatus.CANCELLED
        await session.commit()
        loaded = await cls._load(session, order_id)
        assert loaded is not None
        return _order_to_admin_detail(loaded)

    @classmethod
    async def refund_order(
        cls, session: AsyncSession, order_id: int
    ) -> AdminOrderDetailOut:
        order = await cls._require(session, order_id)
        payment = order.payment
        if payment is None or payment.paid_at is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Оплата не здійснена",
            )
        if payment.refunded_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Кошти вже повернуто",
            )
        payment.refunded_at = now_utc()
        await session.commit()
        loaded = await cls._load(session, order_id)
        assert loaded is not None
        return _order_to_admin_detail(loaded)
