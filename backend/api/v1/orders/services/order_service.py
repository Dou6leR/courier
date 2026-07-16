from datetime import datetime, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.debug_clock import now_utc
from core.models.address import Address
from core.models.cargo import Cargo
from core.models.client import Client
from core.models.courier import Courier
from core.models.enums import OrderStatus, PaymentMethod, RouteStopType
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.payment import Payment
from core.models.user import User
from core.schemas.order import (
    AddressOut,
    CourierBrief,
    OrderConfirmIn,
    OrderCreateIn,
    OrderOut,
)
from core.schemas.payment import PaymentOut
from core.schemas.review import ReviewOut
from core.schemas.transport import TransportOut

# Pricing constants
PRICE_BASE = 100.0
PRICE_PER_KG = 2.0
PRICE_PER_M3 = 500.0  # 5 грн per 0.01 м³
SERVICE_FEE = 50.0

# Client-requested pickup window length
PICKUP_WINDOW_HOURS = 2


def calculate_price(weight: float, volume: float) -> float:
    return round(
        PRICE_BASE + weight * PRICE_PER_KG + volume * PRICE_PER_M3 + SERVICE_FEE, 2
    )


def _order_load_options():
    return (
        selectinload(Order.cargo),
        selectinload(Order.logistics).selectinload(OrderLogistics.pickup_address),
        selectinload(Order.logistics).selectinload(OrderLogistics.delivery_address),
        selectinload(Order.logistics)
        .selectinload(OrderLogistics.courier)
        .selectinload(Courier.user),
        selectinload(Order.logistics)
        .selectinload(OrderLogistics.courier)
        .selectinload(Courier.transport),
        selectinload(Order.sender).selectinload(Client.user),
        selectinload(Order.recipient).selectinload(Client.user),
        selectinload(Order.payment),
        selectinload(Order.reviews),
        selectinload(Order.route_stops),
    )


def _to_order_out(order: Order, current_user_id: int) -> OrderOut:
    logistics = order.logistics
    cargo = order.cargo
    courier = logistics.courier if logistics is not None else None
    courier_brief: CourierBrief | None = None
    if courier is not None:
        courier_brief = CourierBrief(
            user_id=courier.user_id,
            full_name=courier.user.full_name,
            phone=courier.user.phone,
            rating_avg=float(courier.rating_avg),
            transport=(
                TransportOut.model_validate(courier.transport)
                if courier.transport is not None
                else None
            ),
            last_known_lat=(
                float(courier.last_known_lat)
                if courier.last_known_lat is not None
                else None
            ),
            last_known_lon=(
                float(courier.last_known_lon)
                if courier.last_known_lon is not None
                else None
            ),
            last_location_at=courier.last_location_at,
        )
    payment_out: PaymentOut | None = None
    if order.payment is not None:
        payment_out = PaymentOut.model_validate(order.payment)
    review_out: ReviewOut | None = None
    own_review = next(
        (r for r in order.reviews if r.author_user_id == current_user_id),
        None,
    )
    if own_review is not None:
        review_out = ReviewOut.model_validate(own_review)
    sender_user = order.sender.user if order.sender is not None else None
    recipient_user = order.recipient.user if order.recipient is not None else None

    est_pickup: datetime | None = None
    est_delivery: datetime | None = None
    for stop in order.route_stops or ():
        if stop.stop_type == RouteStopType.PICKUP:
            est_pickup = stop.estimated_arrival_time
        elif stop.stop_type == RouteStopType.DELIVERY:
            est_delivery = stop.estimated_arrival_time

    return OrderOut(
        id=order.id,
        status=order.status,
        is_confirmed=order.is_confirmed,
        weight=float(cargo.weight),
        volume=float(cargo.volume),
        special_instructions=cargo.special_instructions,
        requested_pickup_from=logistics.requested_pickup_from,
        requested_pickup_to=logistics.requested_pickup_to,
        estimated_pickup_time=est_pickup,
        estimated_delivery_time=est_delivery,
        actual_pickup_time=logistics.actual_pickup_time,
        actual_delivery_time=logistics.actual_delivery_time,
        created_at=order.created_at,
        created_by_user_id=order.created_by_user_id,
        sender_user_id=order.sender_id,
        recipient_user_id=order.recipient_id,
        sender_full_name=sender_user.full_name if sender_user else None,
        sender_phone=sender_user.phone if sender_user else None,
        recipient_full_name=recipient_user.full_name if recipient_user else None,
        recipient_phone=recipient_user.phone if recipient_user else None,
        pickup_address=AddressOut.model_validate(logistics.pickup_address),
        delivery_address=AddressOut.model_validate(logistics.delivery_address),
        courier=courier_brief,
        payment=payment_out,
        review=review_out,
    )


class OrderService:
    @classmethod
    async def _load_order(cls, session: AsyncSession, order_id: int) -> Order | None:
        stmt = select(Order).where(Order.id == order_id).options(*_order_load_options())
        return await session.scalar(stmt)

    @classmethod
    async def _get_order_for_user(
        cls, session: AsyncSession, order_id: int, user_id: int
    ) -> Order:
        order = await cls._load_order(session, order_id)
        if order is None or user_id not in (order.sender_id, order.recipient_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        return order

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        current_user_id: int,
        dto: OrderCreateIn,
    ) -> OrderOut:
        # Resolve counterparty by phone -> clients
        cp_user = await session.scalar(
            select(User).where(User.phone == dto.counterparty_phone)
        )
        if cp_user is None or cp_user.id == current_user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Користувача з таким телефоном не зареєстровано",
            )
        cp_client = await session.scalar(
            select(Client).where(Client.user_id == cp_user.id)
        )
        if cp_client is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Користувача з таким телефоном не зареєстровано",
            )

        if dto.my_role == "sender":
            sender_id = current_user_id
            recipient_id = cp_user.id
        else:
            sender_id = cp_user.id
            recipient_id = current_user_id

        pickup = Address(**dto.pickup_address.model_dump())
        delivery = Address(**dto.delivery_address.model_dump())
        session.add_all([pickup, delivery])
        await session.flush()

        window_from = dto.requested_pickup_from
        window_to = window_from + timedelta(hours=PICKUP_WINDOW_HOURS)

        order = Order(
            status=OrderStatus.PENDING,
            is_confirmed=False,
            sender_id=sender_id,
            recipient_id=recipient_id,
            created_by_user_id=current_user_id,
        )
        session.add(order)
        await session.flush()

        cargo = Cargo(
            order_id=order.id,
            weight=dto.weight,
            volume=dto.volume,
            special_instructions=dto.special_instructions,
        )
        logistics = OrderLogistics(
            order_id=order.id,
            requested_pickup_from=window_from,
            requested_pickup_to=window_to,
            pickup_address_id=pickup.id,
            delivery_address_id=delivery.id,
        )
        session.add_all([cargo, logistics])
        await session.flush()

        amount = calculate_price(dto.weight, dto.volume)
        payment = Payment(
            order_id=order.id,
            amount=amount,
            payment_method=PaymentMethod(dto.payment_method),
            paid_at=None,
        )
        session.add(payment)
        await session.flush()

        await session.commit()

        loaded = await cls._load_order(session, order.id)
        assert loaded is not None
        return _to_order_out(loaded, current_user_id)

    @classmethod
    async def confirm(
        cls,
        session: AsyncSession,
        order_id: int,
        user_id: int,
        data: OrderConfirmIn | None = None,
    ) -> OrderOut:
        order = await cls._get_order_for_user(session, order_id, user_id)
        if user_id == order.created_by_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Підтвердити замовлення має інша сторона",
            )
        if order.is_confirmed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Замовлення вже підтверджене",
            )

        if data is not None:
            is_sender = user_id == order.sender_id
            is_recipient = user_id == order.recipient_id
            if data.pickup_address is not None:
                if not is_sender:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Адресу забору може змінити лише відправник",
                    )
                pickup = await session.get(Address, order.logistics.pickup_address_id)
                assert pickup is not None
                for k, v in data.pickup_address.model_dump().items():
                    setattr(pickup, k, v)
            if data.delivery_address is not None:
                if not is_recipient:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Адресу доставки може змінити лише отримувач",
                    )
                delivery = await session.get(
                    Address, order.logistics.delivery_address_id
                )
                assert delivery is not None
                for k, v in data.delivery_address.model_dump().items():
                    setattr(delivery, k, v)

        order.is_confirmed = True
        await session.flush()

        # Both sides agreed — now look for a courier.
        from api.v1.orders.services.assignment_service import AssignmentService

        try:
            await AssignmentService.try_assign(session, order.id)
        except Exception:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).exception(
                "try_assign failed after confirm for order_id=%s", order.id
            )

        await session.commit()
        loaded = await cls._load_order(session, order.id)
        assert loaded is not None
        return _to_order_out(loaded, user_id)

    @classmethod
    async def list_mine(
        cls,
        session: AsyncSession,
        user_id: int,
        role: Literal["sender", "recipient", "any"],
        period: Literal["last_month", "all"],
        status_filter: OrderStatus | None,
        archived: bool | None = None,
        exclude_awaiting_my_confirmation: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[OrderOut]:
        stmt = select(Order).options(*_order_load_options())
        if role == "sender":
            stmt = stmt.where(Order.sender_id == user_id)
        elif role == "recipient":
            stmt = stmt.where(Order.recipient_id == user_id)
        else:
            stmt = stmt.where(
                (Order.sender_id == user_id) | (Order.recipient_id == user_id)
            )
        if period == "last_month":
            cutoff = now_utc() - timedelta(days=30)
            stmt = stmt.where(Order.created_at >= cutoff)
        if status_filter is not None:
            stmt = stmt.where(Order.status == status_filter)
        if archived is True:
            stmt = stmt.where(
                Order.status.in_([OrderStatus.DELIVERED, OrderStatus.CANCELLED])
            )
        elif archived is False:
            stmt = stmt.where(
                Order.status.notin_([OrderStatus.DELIVERED, OrderStatus.CANCELLED])
            )
        if exclude_awaiting_my_confirmation:
            stmt = stmt.where(
                ~(
                    (Order.is_confirmed.is_(False))
                    & (Order.created_by_user_id != user_id)
                )
            )
        stmt = stmt.order_by(Order.created_at.desc()).offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await session.scalars(stmt)
        return [_to_order_out(o, user_id) for o in result.all()]

    @classmethod
    async def get_for_user(
        cls, session: AsyncSession, order_id: int, user_id: int
    ) -> OrderOut:
        order = await cls._get_order_for_user(session, order_id, user_id)
        return _to_order_out(order, user_id)
