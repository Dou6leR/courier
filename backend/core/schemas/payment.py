from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from core.models.enums import PaymentMethod


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    order_id: int
    amount: float
    method: PaymentMethod = Field(validation_alias="payment_method")
    paid_at: datetime | None
    refunded_at: datetime | None = None


class ReceiptItem(BaseModel):
    label: str
    amount: float


class ReceiptOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    order_id: int
    items: list[ReceiptItem]
    total: float
    method: PaymentMethod = Field(validation_alias="payment_method")
    paid_at: datetime | None
    issued_at: datetime
