import logging
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.v1.couriers.services.route_planner_service import (
    AVERAGE_SPEED_KMH,
    DETOUR_FACTOR,
    LVIV_TZ,
    RoutePlannerService,
    plan_base_time,
)
from api.v1.orders.services.order_service import _order_load_options, _to_order_out
from core.debug_clock import now_in, now_utc
from core.models.courier import Courier
from core.models.courier_route_stop import CourierRouteStop
from core.models.enums import OrderStatus, RouteStopType
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.transport import Transport
from core.routing import haversine_km
from core.schemas.courier import (
    CourierAvailabilityIn,
    CourierLocationIn,
    CourierMeOut,
    CourierRouteOut,
    RouteDayOut,
    RoutePointOut,
    TransportUpsertIn,
)
from core.schemas.order import AddressOut, OrderOut

logger = logging.getLogger(__name__)

# Allowed status transitions for courier-driven state machine.
STATUS_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.ASSIGNED: OrderStatus.PICKED_UP,
    OrderStatus.PICKED_UP: OrderStatus.DELIVERED,
}

ACTIVE_STATUSES: tuple[OrderStatus, ...] = (
    OrderStatus.ASSIGNED,
    OrderStatus.PICKED_UP,
)


def _lviv_today() -> date:
    return now_in(LVIV_TZ).date()


def _lviv_day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, datetime.min.time(), LVIV_TZ)
    return start, start + timedelta(days=1)


class CourierService:
    # ---------- profile / availability / location ----------

    @classmethod
    async def _get_courier(cls, session: AsyncSession, user_id: int) -> Courier:
        courier = await session.scalar(
            select(Courier)
            .where(Courier.user_id == user_id)
            .options(selectinload(Courier.transport))
        )
        if courier is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Courier profile not found",
            )
        return courier

    @classmethod
    async def get_me(cls, session: AsyncSession, user_id: int) -> CourierMeOut:
        courier = await cls._get_courier(session, user_id)
        return CourierMeOut.model_validate(courier)

    @classmethod
    async def update_location(
        cls,
        session: AsyncSession,
        user_id: int,
        dto: CourierLocationIn,
    ) -> CourierMeOut:
        courier = await cls._get_courier(session, user_id)
        courier.last_known_lat = dto.lat  # type: ignore[assignment]
        courier.last_known_lon = dto.lon  # type: ignore[assignment]
        courier.last_location_at = now_utc()

        # Refresh today's route ETAs so the client map stays live.
        try:
            await RoutePlannerService.touch_etas(session, user_id, _lviv_today())
        except Exception:  # noqa: BLE001
            logger.exception("touch_etas failed for courier_id=%s", user_id)

        # Retry auto-assigning orders that are PENDING and within reach window.
        await _retry_pending_assignments(session)

        await session.commit()
        await session.refresh(courier)
        return CourierMeOut.model_validate(courier)

    @classmethod
    async def update_availability(
        cls,
        session: AsyncSession,
        user_id: int,
        dto: CourierAvailabilityIn,
    ) -> CourierMeOut:
        courier = await cls._get_courier(session, user_id)
        was_available = courier.is_available
        courier.is_available = dto.is_available
        await session.flush()

        if was_available and not dto.is_available:
            await cls._release_future_orders(session, user_id)
        elif not was_available and dto.is_available:
            await _retry_pending_assignments(session)

        await session.commit()
        await session.refresh(courier)
        return CourierMeOut.model_validate(courier)

    @classmethod
    async def _release_future_orders(cls, session: AsyncSession, user_id: int) -> None:
        today = _lviv_today()
        stmt = (
            select(Order)
            .join(OrderLogistics, OrderLogistics.order_id == Order.id)
            .where(
                OrderLogistics.courier_id == user_id,
                Order.status == OrderStatus.ASSIGNED,
            )
            .options(selectinload(Order.logistics))
        )
        orders = list((await session.scalars(stmt)).all())

        affected_dates: set[date] = set()
        freed_order_ids: list[int] = []
        for order in orders:
            pickup_date = order.logistics.requested_pickup_from.astimezone(
                LVIV_TZ
            ).date()
            if pickup_date <= today:
                continue
            order.logistics.courier_id = None
            order.status = OrderStatus.PENDING
            affected_dates.add(pickup_date)
            freed_order_ids.append(order.id)
        if not freed_order_ids:
            return
        await session.flush()

        for d in affected_dates:
            await RoutePlannerService.rebuild(session, user_id, d)

        from api.v1.orders.services.assignment_service import AssignmentService

        for oid in freed_order_ids:
            try:
                await AssignmentService.try_assign(session, oid)
            except Exception:  # noqa: BLE001
                logger.exception("reassign failed for order_id=%s", oid)

    # ---------- transport ----------

    @classmethod
    async def upsert_transport(
        cls,
        session: AsyncSession,
        user_id: int,
        dto: TransportUpsertIn,
    ) -> CourierMeOut:
        courier = await cls._get_courier(session, user_id)
        if courier.transport is not None:
            courier.transport.model = dto.model
            courier.transport.type = dto.type
            courier.transport.max_weight = dto.max_weight
            courier.transport.max_volume = dto.max_volume
        else:
            transport = Transport(
                model=dto.model,
                type=dto.type,
                max_weight=dto.max_weight,
                max_volume=dto.max_volume,
            )
            session.add(transport)
            await session.flush()
            courier.transport_id = transport.id
        await session.commit()
        await session.refresh(courier)
        return CourierMeOut.model_validate(courier)

    @classmethod
    async def remove_transport(
        cls,
        session: AsyncSession,
        user_id: int,
    ) -> CourierMeOut:
        courier = await cls._get_courier(session, user_id)
        old_transport = courier.transport
        courier.transport_id = None
        await session.flush()
        if old_transport is not None:
            other_refs = await session.scalar(
                select(func.count())
                .select_from(Courier)
                .where(Courier.transport_id == old_transport.id)
            )
            if not other_refs:
                await session.delete(old_transport)
        await session.commit()
        await session.refresh(courier)
        return CourierMeOut.model_validate(courier)

    # ---------- route ----------

    @classmethod
    async def get_route(
        cls,
        session: AsyncSession,
        user_id: int,
        plan_date: date | None = None,
    ) -> CourierRouteOut:
        day = plan_date or _lviv_today()

        stmt = (
            select(CourierRouteStop)
            .join(Order, Order.id == CourierRouteStop.order_id)
            .where(
                CourierRouteStop.courier_id == user_id,
                CourierRouteStop.plan_date == day,
                Order.status.in_(ACTIVE_STATUSES),
            )
            .options(
                selectinload(CourierRouteStop.order)
                .selectinload(Order.logistics)
                .selectinload(OrderLogistics.pickup_address),
                selectinload(CourierRouteStop.order)
                .selectinload(Order.logistics)
                .selectinload(OrderLogistics.delivery_address),
                selectinload(CourierRouteStop.order).selectinload(Order.payment),
            )
            .order_by(CourierRouteStop.seq)
        )
        stops = (await session.scalars(stmt)).all()

        courier = await session.scalar(
            select(Courier).where(Courier.user_id == user_id)
        )

        points: list[RoutePointOut] = []
        total_km = 0.0
        prev_lat: float | None = (
            float(courier.last_known_lat)
            if courier and courier.last_known_lat is not None
            else None
        )
        prev_lon: float | None = (
            float(courier.last_known_lon)
            if courier and courier.last_known_lon is not None
            else None
        )

        for stop in stops:
            order = stop.order
            address_model = (
                order.logistics.pickup_address
                if stop.stop_type == RouteStopType.PICKUP
                else order.logistics.delivery_address
            )
            if address_model is None:
                continue
            lat = float(address_model.lat) if address_model.lat is not None else None
            lon = float(address_model.lon) if address_model.lon is not None else None
            seg_km = 0.0
            if (
                prev_lat is not None
                and prev_lon is not None
                and lat is not None
                and lon is not None
            ):
                seg_km = haversine_km(prev_lat, prev_lon, lat, lon)
                total_km += seg_km
            if lat is not None and lon is not None:
                prev_lat, prev_lon = lat, lon
            travel_min = (
                seg_km * DETOUR_FACTOR / AVERAGE_SPEED_KMH * 60 if seg_km else None
            )
            pay_method = None
            if stop.stop_type == RouteStopType.DELIVERY and order.payment:
                pay_method = order.payment.payment_method.value
            points.append(
                RoutePointOut(
                    type=(
                        "pickup"
                        if stop.stop_type == RouteStopType.PICKUP
                        else "delivery"
                    ),
                    order_id=stop.order_id,
                    lat=lat,
                    lon=lon,
                    address=AddressOut.model_validate(address_model),
                    eta=stop.estimated_arrival_time,
                    travel_min=travel_min,
                    payment_method=pay_method,
                )
            )

        total_distance_m = int(total_km * DETOUR_FACTOR * 1000)
        total_duration_sec = int(total_km * DETOUR_FACTOR / AVERAGE_SPEED_KMH * 3600)

        return CourierRouteOut(
            plan_date=day,
            points=points,
            total_distance_m=total_distance_m,
            total_duration_sec=total_duration_sec,
            base_time=plan_base_time(day),
        )

    @classmethod
    async def list_route_days(
        cls, session: AsyncSession, user_id: int
    ) -> list[RouteDayOut]:
        stmt = (
            select(
                CourierRouteStop.plan_date,
                func.count(CourierRouteStop.id).label("stops_count"),
                func.count(func.distinct(CourierRouteStop.order_id)).label(
                    "orders_count"
                ),
            )
            .join(Order, Order.id == CourierRouteStop.order_id)
            .where(
                CourierRouteStop.courier_id == user_id,
                Order.status.in_(ACTIVE_STATUSES),
            )
            .group_by(CourierRouteStop.plan_date)
            .order_by(CourierRouteStop.plan_date)
        )
        rows = (await session.execute(stmt)).all()
        return [
            RouteDayOut(
                plan_date=row.plan_date,
                stops_count=row.stops_count,
                orders_count=row.orders_count,
            )
            for row in rows
        ]

    # ---------- orders listings ----------

    @classmethod
    async def list_mine(
        cls,
        session: AsyncSession,
        user_id: int,
        scope: Literal["today", "upcoming", "all"] = "today",
        period: Literal["last_month", "all"] = "all",
        status_filter: OrderStatus | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[OrderOut]:
        stmt = (
            select(Order)
            .join(OrderLogistics, OrderLogistics.order_id == Order.id)
            .where(OrderLogistics.courier_id == user_id)
            .options(*_order_load_options())
        )
        if scope != "all":
            today_start, today_end = _lviv_day_bounds(_lviv_today())
            if scope == "today":
                stmt = stmt.where(
                    OrderLogistics.requested_pickup_from >= today_start,
                    OrderLogistics.requested_pickup_from < today_end,
                )
            elif scope == "upcoming":
                stmt = stmt.where(OrderLogistics.requested_pickup_from >= today_end)
        if period == "last_month":
            cutoff = now_utc() - timedelta(days=30)
            stmt = stmt.where(Order.created_at >= cutoff)
        if status_filter is not None:
            stmt = stmt.where(Order.status == status_filter)
        stmt = stmt.order_by(OrderLogistics.requested_pickup_from.asc())
        stmt = stmt.offset(offset).limit(limit)
        result = (await session.scalars(stmt)).all()
        return [_to_order_out(o, user_id) for o in result]

    @classmethod
    async def get_order(
        cls, session: AsyncSession, order_id: int, user_id: int
    ) -> OrderOut:
        stmt = select(Order).where(Order.id == order_id).options(*_order_load_options())
        order = await session.scalar(stmt)
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        logistics = order.logistics
        if logistics.courier_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        return _to_order_out(order, user_id)

    # ---------- status machine ----------

    @classmethod
    async def update_status(
        cls,
        session: AsyncSession,
        order_id: int,
        user_id: int,
        new_status: OrderStatus,
    ) -> OrderOut:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.logistics))
        )
        order = await session.scalar(stmt)
        if order is None or order.logistics.courier_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        expected = STATUS_TRANSITIONS.get(order.status)
        if expected is None or expected != new_status:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Неможливий перехід {order.status.value} -> {new_status.value}",
            )

        plan_date = order.logistics.requested_pickup_from.astimezone(LVIV_TZ).date()
        today = _lviv_today()
        if plan_date != today:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Це замовлення не на сьогоднішній маршрут",
            )

        if new_status in (OrderStatus.PICKED_UP, OrderStatus.DELIVERED):
            expected_type = (
                RouteStopType.PICKUP
                if new_status == OrderStatus.PICKED_UP
                else RouteStopType.DELIVERY
            )
            next_stop = await cls._next_active_stop(session, user_id, today)
            if next_stop is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Маршрут порожній — спочатку оновіть локацію",
                )
            if next_stop.order_id != order_id or next_stop.stop_type != expected_type:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Спочатку виконайте попередню зупинку маршруту",
                )

        now = now_utc()
        order.status = new_status
        if new_status == OrderStatus.PICKED_UP:
            order.logistics.actual_pickup_time = now
        elif new_status == OrderStatus.DELIVERED:
            order.logistics.actual_delivery_time = now

        try:
            await RoutePlannerService.rebuild(session, user_id, plan_date)
        except Exception:  # noqa: BLE001
            logger.exception(
                "rebuild after status change failed for order_id=%s", order_id
            )

        await session.commit()

        loaded = await session.scalar(
            select(Order).where(Order.id == order_id).options(*_order_load_options())
        )
        assert loaded is not None
        return _to_order_out(loaded, user_id)

    @classmethod
    async def _next_active_stop(
        cls, session: AsyncSession, courier_id: int, plan_date: date
    ) -> CourierRouteStop | None:
        """First route stop whose type still matches its order's current status.

        - pickup is active while order.status = ASSIGNED
        - delivery is active while order.status = PICKED_UP
        """
        stmt = (
            select(CourierRouteStop)
            .join(Order, Order.id == CourierRouteStop.order_id)
            .where(
                CourierRouteStop.courier_id == courier_id,
                CourierRouteStop.plan_date == plan_date,
                (
                    (
                        (CourierRouteStop.stop_type == RouteStopType.PICKUP)
                        & (Order.status == OrderStatus.ASSIGNED)
                    )
                    | (
                        (CourierRouteStop.stop_type == RouteStopType.DELIVERY)
                        & (Order.status == OrderStatus.PICKED_UP)
                    )
                ),
            )
            .order_by(CourierRouteStop.seq)
            .limit(1)
        )
        return await session.scalar(stmt)


async def _retry_pending_assignments(session: AsyncSession) -> None:
    """Scan PENDING orders whose pickup window is still open — try to auto-assign.

    Imported lazily to avoid circular import with order_service.
    """
    now = now_utc()
    horizon = now + timedelta(hours=24)
    stmt = (
        select(Order.id)
        .join(OrderLogistics, OrderLogistics.order_id == Order.id)
        .where(
            Order.status == OrderStatus.PENDING,
            Order.is_confirmed.is_(True),
            OrderLogistics.courier_id.is_(None),
            OrderLogistics.requested_pickup_to >= now,
            OrderLogistics.requested_pickup_from <= horizon,
        )
    )
    pending_ids = (await session.scalars(stmt)).all()
    if not pending_ids:
        return
    from api.v1.orders.services.assignment_service import AssignmentService

    for oid in pending_ids:
        try:
            await AssignmentService.try_assign(session, oid)
        except Exception:  # noqa: BLE001
            logger.exception("try_assign failed in retry for order_id=%s", oid)
