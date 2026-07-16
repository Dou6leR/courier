from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .order import Order
    from .transport import Transport
    from .user import User


class Courier(Base):
    __tablename__ = "couriers"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    transport_id: Mapped[int | None] = mapped_column(
        ForeignKey("transports.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    rating_avg: Mapped[float] = mapped_column(
        Numeric(3, 2),
        default=0,
        server_default="0",
        nullable=False,
    )
    last_known_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    last_known_lon: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    last_location_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship()
    transport: Mapped["Transport | None"] = relationship(back_populates="couriers")
    orders: Mapped[list["Order"]] = relationship(
        secondary="order_logistics",
        primaryjoin="Courier.user_id == OrderLogistics.courier_id",
        secondaryjoin="OrderLogistics.order_id == Order.id",
        viewonly=True,
    )
