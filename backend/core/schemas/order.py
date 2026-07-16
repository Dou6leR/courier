from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from core.models.enums import OrderStatus, PaymentMethod
from core.schemas.payment import PaymentOut
from core.schemas.review import ReviewOut
from core.schemas.transport import TransportOut


class AddressIn(BaseModel):
    city: str = Field(min_length=1, max_length=128)
    street: str = Field(min_length=1, max_length=255)
    building: str = Field(min_length=1, max_length=32)
    apartment: str | None = Field(default=None, max_length=32)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city: str
    street: str
    building: str
    apartment: str | None
    lat: float | None = None
    lon: float | None = None


class CourierBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    phone: str
    rating_avg: float
    transport: TransportOut | None = None
    last_known_lat: float | None = None
    last_known_lon: float | None = None
    last_location_at: datetime | None = None


class OrderCreateIn(BaseModel):
    my_role: Literal["sender", "recipient"]
    counterparty_phone: str = Field(min_length=3, max_length=32)
    weight: float = Field(gt=0)
    volume: float = Field(gt=0)
    special_instructions: str | None = Field(default=None, max_length=1000)
    requested_pickup_from: datetime
    pickup_address: AddressIn
    delivery_address: AddressIn
    payment_method: PaymentMethod


class OrderConfirmIn(BaseModel):
    pickup_address: AddressIn | None = None
    delivery_address: AddressIn | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    status: OrderStatus
    is_confirmed: bool
    weight: float
    volume: float
    special_instructions: str | None
    requested_pickup_from: datetime
    requested_pickup_to: datetime
    estimated_pickup_time: datetime | None = None
    estimated_delivery_time: datetime | None = None
    actual_pickup_time: datetime | None = None
    actual_delivery_time: datetime | None = None
    created_at: datetime
    created_by_user_id: int
    sender_user_id: int = Field(validation_alias="sender_id")
    recipient_user_id: int = Field(validation_alias="recipient_id")
    sender_full_name: str | None = None
    sender_phone: str | None = None
    recipient_full_name: str | None = None
    recipient_phone: str | None = None
    pickup_address: AddressOut
    delivery_address: AddressOut
    courier: CourierBrief | None
    payment: PaymentOut | None
    review: ReviewOut | None
