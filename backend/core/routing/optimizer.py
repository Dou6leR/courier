from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from typing import Literal

StopType = Literal["pickup", "delivery"]


@dataclass(frozen=True)
class RouteStop:
    type: StopType
    order_id: int
    lat: float
    lon: float
    weight_kg: float
    volume_m3: float


@dataclass(frozen=True)
class OrderPair:
    order_id: int
    pickup_lat: float
    pickup_lon: float
    delivery_lat: float
    delivery_lon: float
    weight_kg: float
    volume_m3: float

    def pickup_stop(self) -> RouteStop:
        return RouteStop(
            type="pickup",
            order_id=self.order_id,
            lat=self.pickup_lat,
            lon=self.pickup_lon,
            weight_kg=self.weight_kg,
            volume_m3=self.volume_m3,
        )

    def delivery_stop(self) -> RouteStop:
        return RouteStop(
            type="delivery",
            order_id=self.order_id,
            lat=self.delivery_lat,
            lon=self.delivery_lon,
            weight_kg=self.weight_kg,
            volume_m3=self.volume_m3,
        )


@dataclass(frozen=True)
class OptimizationInput:
    start_lat: float | None
    start_lon: float | None
    orders: tuple[OrderPair, ...] = ()
    pending_deliveries: tuple[RouteStop, ...] = ()
    initial_load_weight: float = 0.0
    initial_load_volume: float = 0.0
    max_weight: float | None = None
    max_volume: float | None = None


@dataclass
class OptimizationResult:
    stops: list[RouteStop] = field(default_factory=list)
    total_distance_km: float = 0.0
    segment_distances_km: list[float] = field(default_factory=list)


class RouteInfeasibleError(Exception):
    """Raised when no valid insertion exists for an order given capacity constraints."""


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _route_metrics(
    start_lat: float | None,
    start_lon: float | None,
    stops: list[RouteStop],
) -> tuple[float, list[float]]:
    """Return (total_km, segment_km).

    segment_km[i] is the distance to reach stops[i]. The first segment is
    start→stops[0] if start coords are given, else 0.
    """
    segments: list[float] = []
    total = 0.0
    prev_lat = start_lat
    prev_lon = start_lon
    for s in stops:
        if prev_lat is None or prev_lon is None:
            seg = 0.0
        else:
            seg = haversine_km(prev_lat, prev_lon, s.lat, s.lon)
        segments.append(seg)
        total += seg
        prev_lat = s.lat
        prev_lon = s.lon
    return total, segments


def _capacity_ok(
    stops: list[RouteStop],
    initial_w: float,
    initial_v: float,
    max_w: float | None,
    max_v: float | None,
) -> bool:
    if max_w is None and max_v is None:
        return True
    cur_w = initial_w
    cur_v = initial_v
    for s in stops:
        delta = 1 if s.type == "pickup" else -1
        cur_w += delta * s.weight_kg
        cur_v += delta * s.volume_m3
        if max_w is not None and cur_w > max_w + 1e-6:
            return False
        if max_v is not None and cur_v > max_v + 1e-6:
            return False
    return True


class RouteOptimizer:
    """Build an approximately optimal route via best-insertion heuristic."""

    @classmethod
    def build_route(cls, inp: OptimizationInput) -> OptimizationResult:
        route: list[RouteStop] = []

        for pd in inp.pending_deliveries:
            route = cls._best_insert_single(route, pd, inp)

        for order in inp.orders:
            route = cls._best_insert_pair(route, order, inp)
        total, segments = _route_metrics(inp.start_lat, inp.start_lon, route)
        return OptimizationResult(
            stops=route,
            total_distance_km=total,
            segment_distances_km=segments,
        )

    @classmethod
    def insertion_cost(cls, inp: OptimizationInput, new_order: OrderPair) -> float:
        """Additional route length (km) if new_order is inserted optimally."""
        base = cls.build_route(inp)
        new_inp = replace(inp, orders=inp.orders + (new_order,))
        new_result = cls.build_route(new_inp)
        return new_result.total_distance_km - base.total_distance_km

    @classmethod
    def _best_insert_single(
        cls,
        route: list[RouteStop],
        stop: RouteStop,
        inp: OptimizationInput,
    ) -> list[RouteStop]:
        n = len(route)
        best: list[RouteStop] | None = None
        best_len = float("inf")
        for i in range(n + 1):
            cand = route[:i] + [stop] + route[i:]
            if not _capacity_ok(
                cand,
                inp.initial_load_weight,
                inp.initial_load_volume,
                inp.max_weight,
                inp.max_volume,
            ):
                continue
            length, _ = _route_metrics(inp.start_lat, inp.start_lon, cand)
            if length < best_len:
                best_len = length
                best = cand
        if best is None:
            raise RouteInfeasibleError(
                f"cannot place delivery for order {stop.order_id}"
            )
        return best

    @classmethod
    def _best_insert_pair(
        cls,
        route: list[RouteStop],
        order: OrderPair,
        inp: OptimizationInput,
    ) -> list[RouteStop]:
        n = len(route)
        pickup = order.pickup_stop()
        delivery = order.delivery_stop()
        best: list[RouteStop] | None = None
        best_len = float("inf")
        # pickup at slot i (0..n), delivery at slot k in the original indexing (i..n).
        # Resulting route: route[:i] + [pickup] + route[i:k] + [delivery] + route[k:]
        for i in range(n + 1):
            for k in range(i, n + 1):
                cand = route[:i] + [pickup] + route[i:k] + [delivery] + route[k:]
                if not _capacity_ok(
                    cand,
                    inp.initial_load_weight,
                    inp.initial_load_volume,
                    inp.max_weight,
                    inp.max_volume,
                ):
                    continue
                length, _ = _route_metrics(inp.start_lat, inp.start_lon, cand)
                if length < best_len:
                    best_len = length
                    best = cand
        if best is None:
            raise RouteInfeasibleError(f"cannot fit order {order.order_id} into route")
        return best
