from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from core.schemas.order import AddressOut
from core.schemas.transport import TransportOut, TransportUpsertIn

__all__ = [
    "CourierAvailabilityIn",
    "CourierLocationIn",
    "CourierMeOut",
    "CourierRouteOut",
    "RoutePointOut",
    "RouteDayOut",
    "TransportOut",
    "TransportUpsertIn",
]


class CourierLocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class CourierAvailabilityIn(BaseModel):
    is_available: bool


class CourierMeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    is_available: bool
    rating_avg: float
    transport_id: int | None
    transport: TransportOut | None = None
    last_known_lat: float | None = None
    last_known_lon: float | None = None
    last_location_at: datetime | None = None


class RoutePointOut(BaseModel):
    type: Literal["pickup", "delivery"]
    order_id: int
    lat: float | None
    lon: float | None
    address: AddressOut
    eta: datetime | None = None
    travel_min: float | None = None
    payment_method: str | None = None


class CourierRouteOut(BaseModel):
    plan_date: date
    points: list[RoutePointOut]
    total_distance_m: int = 0
    total_duration_sec: int = 0
    base_time: datetime | None = None


class RouteDayOut(BaseModel):
    plan_date: date
    stops_count: int
    orders_count: int
