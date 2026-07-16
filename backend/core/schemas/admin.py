from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from core.enums import UserRole
from core.models.enums import OrderStatus
from core.schemas.order import OrderOut

UiOrderStatus = Literal["active", "completed", "cancelled"]
UiPaymentStatus = Literal["paid", "refunded", "processing", "cancelled"]
UserRoleFilter = Literal["client", "courier", "admin", "all"]
OrderStatusFilter = Literal["active", "completed", "cancelled", "all"]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    email: EmailStr
    roles: list[UserRole]
    is_active: bool
    orders_count: int
    rating: float | None = None


class AdminUserStatusIn(BaseModel):
    is_active: bool


class AdminOrderOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    customer: str
    courier: str | None
    status: UiOrderStatus
    payment_status: UiPaymentStatus
    amount: float
    date: str
    from_: str = Field(serialization_alias="from")
    to: str
    raw_status: OrderStatus
    created_at: datetime


class AdminOrderDetailOut(AdminOrderOut):
    order: OrderOut


class AnalyticsSummaryOut(BaseModel):
    revenue: float
    total_income: float
    deliveries: int
    completion_rate: float
    active_couriers_count: int
    avg_delivery_time_minutes: float | None = None


class AnalyticsDailyItem(BaseModel):
    date: date
    deliveries: int
    revenue: float
    total_income: float
