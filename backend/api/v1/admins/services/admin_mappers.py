from core.models.enums import OrderStatus
from core.models.payment import Payment
from core.schemas.admin import UiOrderStatus, UiPaymentStatus

_ACTIVE_STATUSES = {
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
    OrderStatus.PICKED_UP,
}


def map_order_status_to_ui(status: OrderStatus) -> UiOrderStatus:
    if status == OrderStatus.DELIVERED:
        return "completed"
    if status == OrderStatus.CANCELLED:
        return "cancelled"
    return "active"


def derive_payment_status(
    payment: Payment | None,
    order_status: OrderStatus | None = None,
) -> UiPaymentStatus:
    if payment is None or payment.paid_at is None:
        if order_status == OrderStatus.CANCELLED:
            return "cancelled"
        return "processing"
    if payment.refunded_at is not None:
        return "refunded"
    return "paid"


def ui_status_to_db_set(status_filter: str) -> set[OrderStatus] | None:
    if status_filter == "all":
        return None
    if status_filter == "active":
        return set(_ACTIVE_STATUSES)
    if status_filter == "completed":
        return {OrderStatus.DELIVERED}
    if status_filter == "cancelled":
        return {OrderStatus.CANCELLED}
    return None
