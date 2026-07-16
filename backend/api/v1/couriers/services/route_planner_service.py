from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.debug_clock import now_in, now_utc
from core.models.courier import Courier
from core.models.courier_route_stop import CourierRouteStop
from core.models.enums import OrderStatus, RouteStopType
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.routing import (
    OptimizationInput,
    OrderPair,
    RouteInfeasibleError,
    RouteOptimizer,
    RouteStop,
)

LVIV_TZ = ZoneInfo("Europe/Kyiv")

AVERAGE_SPEED_KMH = 20.0
DETOUR_FACTOR = 1.3
STOP_DURATION = timedelta(minutes=5)
WORKDAY_START_HOUR = 9  # when the courier starts the day for future plans

ACTIVE_STATUSES: tuple[OrderStatus, ...] = (
    OrderStatus.ASSIGNED,
    OrderStatus.PICKED_UP,
)


def plan_base_time(plan_date: date) -> datetime:
    """UTC timestamp from which to count travel time for the given day.

    For today - from now. For future days - from the courier's workday start.
    """
    today = lviv_today()
    if plan_date <= today:
        return now_utc()
    local_start = datetime.combine(plan_date, time(WORKDAY_START_HOUR, 0), LVIV_TZ)
    return local_start.astimezone(timezone.utc)


def lviv_today() -> date:
    return now_in(LVIV_TZ).date()


def km_to_timedelta(km: float) -> timedelta:
    return timedelta(hours=(km * DETOUR_FACTOR) / AVERAGE_SPEED_KMH)


class RoutePlannerService:
    MAX_REBUILD_DEPTH = 3

    @classmethod
    async def rebuild(
        cls,
        session: AsyncSession,
        courier_id: int,
        plan_date: date,
        *,
        _depth: int = 0,
        reassign: bool = True,
    ) -> None:
        """Full recompute of courier's route for the given day."""
        courier = await session.scalar(
            select(Courier)
            .where(Courier.user_id == courier_id)
            .options(selectinload(Courier.transport))
        )
        if courier is None:
            return

        orders = await cls._load_day_orders(session, courier_id, plan_date)

        if not orders:
            await session.execute(
                delete(CourierRouteStop).where(
                    CourierRouteStop.courier_id == courier_id,
                    CourierRouteStop.plan_date == plan_date,
                )
            )
            return

        pairs: list[OrderPair] = []
        pending: list[RouteStop] = []
        initial_w = 0.0
        initial_v = 0.0
        for o in orders:
            p = o.logistics.pickup_address
            d = o.logistics.delivery_address
            if not _has_coords(p) or not _has_coords(d):
                continue
            w = float(o.cargo.weight)
            v = float(o.cargo.volume)
            if o.status == OrderStatus.ASSIGNED:
                pairs.append(
                    OrderPair(
                        order_id=o.id,
                        pickup_lat=float(p.lat),
                        pickup_lon=float(p.lon),
                        delivery_lat=float(d.lat),
                        delivery_lon=float(d.lon),
                        weight_kg=w,
                        volume_m3=v,
                    )
                )
            else:
                # PICKED_UP - pickup already done, only delivery left onboard.
                initial_w += w
                initial_v += v
                pending.append(
                    RouteStop(
                        type="delivery",
                        order_id=o.id,
                        lat=float(d.lat),
                        lon=float(d.lon),
                        weight_kg=w,
                        volume_m3=v,
                    )
                )

        start_lat = (
            float(courier.last_known_lat)
            if courier.last_known_lat is not None
            else None
        )
        start_lon = (
            float(courier.last_known_lon)
            if courier.last_known_lon is not None
            else None
        )
        max_w = (
            float(courier.transport.max_weight)
            if courier.transport is not None
            else None
        )
        max_v = (
            float(courier.transport.max_volume)
            if courier.transport is not None
            else None
        )

        inp = OptimizationInput(
            start_lat=start_lat,
            start_lon=start_lon,
            orders=tuple(pairs),
            pending_deliveries=tuple(pending),
            initial_load_weight=initial_w,
            initial_load_volume=initial_v,
            max_weight=max_w,
            max_volume=max_v,
        )
        try:
            result = RouteOptimizer.build_route(inp)
        except RouteInfeasibleError:
            return

        windows = {
            o.id: (
                o.logistics.requested_pickup_from,
                o.logistics.requested_pickup_to,
            )
            for o in orders
            if o.status == OrderStatus.ASSIGNED
        }

        # First pass: compute ETAs along the optimizer's sequence.
        current = plan_base_time(plan_date)
        stop_etas: list[tuple[RouteStop, datetime]] = []
        for stop, seg_km in zip(result.stops, result.segment_distances_km, strict=True):
            current += km_to_timedelta(seg_km)
            if stop.type == "pickup":
                window = windows.get(stop.order_id)
                if window is not None and current < window[0]:
                    current = window[0]
            stop_etas.append((stop, current))
            current += STOP_DURATION

        violating_ids: set[int] = set()
        for stop, eta in stop_etas:
            window = windows.get(stop.order_id)
            if window is None:
                continue
            wfrom, wto = window
            if not (wfrom <= eta <= wto):
                violating_ids.add(stop.order_id)

        if violating_ids:
            for o in orders:
                if o.id in violating_ids:
                    o.logistics.courier_id = None
                    if o.status == OrderStatus.ASSIGNED:
                        o.status = OrderStatus.PENDING
            await session.flush()

            if _depth < cls.MAX_REBUILD_DEPTH:
                await cls.rebuild(
                    session,
                    courier_id,
                    plan_date,
                    _depth=_depth + 1,
                    reassign=reassign,
                )
                if reassign:
                    from api.v1.orders.services.assignment_service import (
                        AssignmentService,
                    )

                    for oid in violating_ids:
                        try:
                            await AssignmentService.try_assign(session, oid)
                        except Exception:  # noqa: BLE001
                            pass
            return

        await session.execute(
            delete(CourierRouteStop).where(
                CourierRouteStop.courier_id == courier_id,
                CourierRouteStop.plan_date == plan_date,
            )
        )
        for seq, (stop, eta) in enumerate(stop_etas):
            session.add(
                CourierRouteStop(
                    courier_id=courier_id,
                    plan_date=plan_date,
                    seq=seq,
                    order_id=stop.order_id,
                    stop_type=(
                        RouteStopType.PICKUP
                        if stop.type == "pickup"
                        else RouteStopType.DELIVERY
                    ),
                    estimated_arrival_time=eta,
                )
            )
        await session.flush()

    @classmethod
    async def touch_etas(
        cls, session: AsyncSession, courier_id: int, plan_date: date
    ) -> None:
        courier = await session.scalar(
            select(Courier).where(Courier.user_id == courier_id)
        )
        if courier is None or courier.last_known_lat is None:
            return

        stops = (
            await session.scalars(
                select(CourierRouteStop)
                .where(
                    CourierRouteStop.courier_id == courier_id,
                    CourierRouteStop.plan_date == plan_date,
                )
                .order_by(CourierRouteStop.seq)
                .options(
                    selectinload(CourierRouteStop.order)
                    .selectinload(Order.logistics)
                    .selectinload(OrderLogistics.pickup_address),
                    selectinload(CourierRouteStop.order)
                    .selectinload(Order.logistics)
                    .selectinload(OrderLogistics.delivery_address),
                )
            )
        ).all()
        if not stops:
            return

        from core.routing import haversine_km

        prev_lat = float(courier.last_known_lat)
        prev_lon = float(courier.last_known_lon)
        current = plan_base_time(plan_date)
        for stop in stops:
            order = stop.order
            addr = (
                order.logistics.pickup_address
                if stop.stop_type == RouteStopType.PICKUP
                else order.logistics.delivery_address
            )
            if addr is None or addr.lat is None or addr.lon is None:
                continue
            seg = haversine_km(prev_lat, prev_lon, float(addr.lat), float(addr.lon))
            current += km_to_timedelta(seg)
            if stop.stop_type == RouteStopType.PICKUP:
                window_from = order.logistics.requested_pickup_from
                if window_from is not None and current < window_from:
                    current = window_from
            stop.estimated_arrival_time = current
            current += STOP_DURATION
            prev_lat = float(addr.lat)
            prev_lon = float(addr.lon)
        await session.flush()

    @classmethod
    async def _load_day_orders(
        cls, session: AsyncSession, courier_id: int, plan_date: date
    ) -> list[Order]:
        day_start = datetime.combine(plan_date, datetime.min.time(), LVIV_TZ)
        day_end = day_start + timedelta(days=1)
        stmt = (
            select(Order)
            .join(OrderLogistics, OrderLogistics.order_id == Order.id)
            .where(
                OrderLogistics.courier_id == courier_id,
                Order.status.in_(ACTIVE_STATUSES),
                OrderLogistics.requested_pickup_from >= day_start,
                OrderLogistics.requested_pickup_from < day_end,
            )
            .options(
                selectinload(Order.cargo),
                selectinload(Order.logistics).selectinload(
                    OrderLogistics.pickup_address
                ),
                selectinload(Order.logistics).selectinload(
                    OrderLogistics.delivery_address
                ),
            )
            .order_by(Order.id)
        )
        return list((await session.scalars(stmt)).all())


def _has_coords(addr) -> bool:
    return addr is not None and addr.lat is not None and addr.lon is not None
