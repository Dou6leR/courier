from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.v1.couriers.services.route_planner_service import (
    ACTIVE_STATUSES,
    AVERAGE_SPEED_KMH,
    DETOUR_FACTOR,
    LVIV_TZ,
    plan_base_time,
)
from core.models.cargo import Cargo
from core.models.courier import Courier
from core.models.enums import OrderStatus
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.transport import Transport
from core.routing import (
    OptimizationInput,
    OrderPair,
    RouteInfeasibleError,
    RouteOptimizer,
    RouteStop,
)

logger = logging.getLogger(__name__)


def _km_to_timedelta(km: float) -> timedelta:
    return timedelta(hours=(km * DETOUR_FACTOR) / AVERAGE_SPEED_KMH)


MAX_CAPACITY_FACTOR = 2.0


class AssignmentService:
    @classmethod
    async def try_assign(cls, session: AsyncSession, order_id: int) -> int | None:
        """Try to auto-assign a courier to this PENDING order.

        Returns the chosen courier's user_id, or None if no feasible courier.
        """
        order = await cls._load_order(session, order_id)
        if order is None or order.logistics is None:
            return None
        if order.status != OrderStatus.PENDING:
            return None
        if not order.is_confirmed:
            return None
        pickup = order.logistics.pickup_address
        delivery = order.logistics.delivery_address
        if not _has_coords(pickup) or not _has_coords(delivery):
            return None

        plan_date = order.logistics.requested_pickup_from.astimezone(LVIV_TZ).date()
        window_from = order.logistics.requested_pickup_from
        window_to = order.logistics.requested_pickup_to

        new_pair = OrderPair(
            order_id=order.id,
            pickup_lat=float(pickup.lat),
            pickup_lon=float(pickup.lon),
            delivery_lat=float(delivery.lat),
            delivery_lon=float(delivery.lon),
            weight_kg=float(order.cargo.weight),
            volume_m3=float(order.cargo.volume),
        )

        candidates = await cls._load_eligible(session, order.cargo)

        caps = [
            (float(c.transport.max_weight), float(c.transport.max_volume))
            for c in candidates
            if c.transport is not None
        ]
        cap_products = [w * v for w, v in caps]
        min_cap = min(cap_products) if cap_products else 1.0
        max_cap = max(cap_products) if cap_products else 1.0
        cap_range = max_cap - min_cap
        max_w = max(w for w, _ in caps) if caps else 1.0
        max_v = max(v for _, v in caps) if caps else 1.0
        cargo_weight = float(order.cargo.weight)
        cargo_volume = float(order.cargo.volume)
        heaviness = (cargo_weight / max_w + cargo_volume / max_v) / 2.0

        load_stmt = (
            select(OrderLogistics.courier_id, func.count(Order.id))
            .join(Order, Order.id == OrderLogistics.order_id)
            .where(
                OrderLogistics.courier_id.is_not(None),
                Order.status != OrderStatus.CANCELLED,
                Order.id != order.id,
            )
            .group_by(OrderLogistics.courier_id)
        )
        loads: dict[int, int] = dict((await session.execute(load_stmt)).all())

        day_start = datetime.combine(plan_date, datetime.min.time(), LVIV_TZ)
        day_end = day_start + timedelta(days=1)
        day_orders_stmt = (
            select(Order)
            .join(OrderLogistics, OrderLogistics.order_id == Order.id)
            .where(
                OrderLogistics.courier_id.is_not(None),
                Order.status.in_(ACTIVE_STATUSES),
                OrderLogistics.requested_pickup_from >= day_start,
                OrderLogistics.requested_pickup_from < day_end,
                Order.id != order.id,
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
        orders_by_courier: dict[int, list[Order]] = {}
        for o in (await session.scalars(day_orders_stmt)).all():
            cid = o.logistics.courier_id
            if cid is not None:
                orders_by_courier.setdefault(cid, []).append(o)

        base_time = plan_base_time(plan_date)
        # (courier_id, new_delivery_eta, rating, effective_load)
        feasible: list[tuple[int, datetime, float, float]] = []
        for courier in candidates:
            courier_day_orders = orders_by_courier.get(courier.user_id, [])
            sim = cls._simulate_with_new(courier, courier_day_orders, new_pair)
            if sim is None:
                continue
            stops, segments = sim

            # Build window map for every active order on that day + the new one.
            windows: dict[int, tuple[datetime, datetime]] = {
                order.id: (window_from, window_to)
            }
            for o in courier_day_orders:
                windows[o.id] = (
                    o.logistics.requested_pickup_from,
                    o.logistics.requested_pickup_to,
                )

            etas = cls._compute_etas_with_wait(base_time, stops, segments, windows)

            if not cls._check_windows(stops, etas, windows):
                continue

            new_delivery_eta = cls._delivery_eta(stops, etas, order.id)
            if new_delivery_eta is None:
                continue
            active_load = loads.get(courier.user_id, 0)
            raw_cap = float(courier.transport.max_weight) * float(
                courier.transport.max_volume
            )
            t = (raw_cap - min_cap) / cap_range if cap_range > 0 else 0.0
            capacity_factor = 1.0 + (MAX_CAPACITY_FACTOR - 1.0) * t
            effective_load = active_load / capacity_factor - heaviness * (
                capacity_factor - 1.0
            )
            feasible.append(
                (
                    courier.user_id,
                    new_delivery_eta,
                    float(courier.rating_avg),
                    effective_load,
                )
            )

        if not feasible:
            return None

        feasible.sort(key=lambda t: (t[3], t[1], -t[2]))
        best_id = feasible[0][0]

        order.logistics.courier_id = best_id
        order.status = OrderStatus.ASSIGNED

        await session.flush()

        from api.v1.couriers.services.route_planner_service import (
            RoutePlannerService,
        )

        await RoutePlannerService.rebuild(session, best_id, plan_date, reassign=False)
        return best_id

    # ---------- helpers ----------

    @classmethod
    async def _load_order(cls, session: AsyncSession, order_id: int) -> Order | None:
        return await session.scalar(
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.cargo),
                selectinload(Order.logistics).selectinload(
                    OrderLogistics.pickup_address
                ),
                selectinload(Order.logistics).selectinload(
                    OrderLogistics.delivery_address
                ),
            )
        )

    @classmethod
    async def _load_eligible(cls, session: AsyncSession, cargo: Cargo) -> list[Courier]:
        stmt = (
            select(Courier)
            .join(Transport, Transport.id == Courier.transport_id)
            .where(
                Courier.is_available.is_(True),
                Courier.transport_id.is_not(None),
                Courier.last_known_lat.is_not(None),
                Courier.last_known_lon.is_not(None),
                Transport.max_weight >= cargo.weight,
                Transport.max_volume >= cargo.volume,
            )
            .options(
                selectinload(Courier.transport),
                selectinload(Courier.orders).selectinload(Order.cargo),
                selectinload(Courier.orders)
                .selectinload(Order.logistics)
                .selectinload(OrderLogistics.pickup_address),
                selectinload(Courier.orders)
                .selectinload(Order.logistics)
                .selectinload(OrderLogistics.delivery_address),
            )
            .order_by(Courier.user_id)
        )
        return list((await session.scalars(stmt)).all())

    @classmethod
    def _simulate_with_new(
        cls,
        courier: Courier,
        day_orders: list[Order],
        new_pair: OrderPair,
    ) -> tuple[list[RouteStop], list[float]] | None:

        pairs: list[OrderPair] = []
        pending: list[RouteStop] = []
        initial_w = 0.0
        initial_v = 0.0
        for o in day_orders:
            log = o.logistics
            if log is None:
                continue
            p = log.pickup_address
            d = log.delivery_address
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

        pairs.append(new_pair)
        pairs.sort(key=lambda p: p.order_id)
        pending.sort(key=lambda s: s.order_id)

        max_w = float(courier.transport.max_weight) if courier.transport else None
        max_v = float(courier.transport.max_volume) if courier.transport else None
        inp = OptimizationInput(
            start_lat=float(courier.last_known_lat),
            start_lon=float(courier.last_known_lon),
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
            return None
        return result.stops, result.segment_distances_km

    @staticmethod
    def _compute_etas_with_wait(
        base_time: datetime,
        stops: list[RouteStop],
        segments: list[float],
        windows: dict[int, tuple[datetime, datetime]],
    ) -> list[datetime]:

        etas: list[datetime] = []
        current = base_time
        for stop, seg in zip(stops, segments, strict=True):
            current = current + _km_to_timedelta(seg)
            if stop.type == "pickup":
                win = windows.get(stop.order_id)
                if win is not None and current < win[0]:
                    current = win[0]
            etas.append(current)
        return etas

    @staticmethod
    def _delivery_eta(
        stops: list[RouteStop], etas: list[datetime], order_id: int
    ) -> datetime | None:
        for s, eta in zip(stops, etas, strict=True):
            if s.order_id == order_id and s.type == "delivery":
                return eta
        return None

    @staticmethod
    def _check_windows(
        stops: list[RouteStop],
        etas: list[datetime],
        windows: dict[int, tuple[datetime, datetime]],
    ) -> bool:

        for s, eta in zip(stops, etas, strict=True):
            win = windows.get(s.order_id)
            if win is None:
                continue
            wfrom, wto = win
            if not (wfrom <= eta <= wto):
                return False
        return True


def _has_coords(addr) -> bool:
    return addr is not None and addr.lat is not None and addr.lon is not None
