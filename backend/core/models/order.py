from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import OrderStatus
from .mixins import IntIdPkMixin

if TYPE_CHECKING:
    from .cargo import Cargo
    from .client import Client
    from .courier_route_stop import CourierRouteStop
    from .order_logistics import OrderLogistics
    from .payment import Payment
    from .review import Review


class Order(IntIdPkMixin, Base):
    __tablename__ = "orders"

    status: Mapped[OrderStatus] = mapped_column(
        Enum(
            OrderStatus,
            name="order_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=OrderStatus.PENDING,
        server_default=OrderStatus.PENDING.value,
        nullable=False,
    )
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("clients.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("clients.user_id", ondelete="RESTRICT"),
        nullable=False,
    )

    sender: Mapped["Client"] = relationship(
        back_populates="sent_orders",
        foreign_keys=[sender_id],
    )
    recipient: Mapped["Client"] = relationship(
        back_populates="received_orders",
        foreign_keys=[recipient_id],
    )

    cargo: Mapped["Cargo"] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )
    logistics: Mapped["OrderLogistics"] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )
    payment: Mapped["Payment | None"] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
    route_stops: Mapped[list["CourierRouteStop"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
