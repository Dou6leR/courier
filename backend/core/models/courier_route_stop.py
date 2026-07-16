from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import RouteStopType
from .mixins import IntIdPkMixin

if TYPE_CHECKING:
    from .courier import Courier
    from .order import Order


class CourierRouteStop(IntIdPkMixin, Base):
    __tablename__ = "courier_route_stops"
    __table_args__ = (
        UniqueConstraint(
            "courier_id", "plan_date", "seq", name="uq_courier_route_stops_ordering"
        ),
        Index("ix_courier_route_stops_courier_date", "courier_id", "plan_date"),
        Index("ix_courier_route_stops_order_type", "order_id", "stop_type"),
    )

    courier_id: Mapped[int] = mapped_column(
        ForeignKey("couriers.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    seq: Mapped[int] = mapped_column(nullable=False)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    stop_type: Mapped[RouteStopType] = mapped_column(
        Enum(
            RouteStopType,
            name="route_stop_type",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    estimated_arrival_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    courier: Mapped["Courier"] = relationship()
    order: Mapped["Order"] = relationship(back_populates="route_stops")
