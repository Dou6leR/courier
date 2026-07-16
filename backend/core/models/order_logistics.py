from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .address import Address
    from .courier import Courier
    from .order import Order


class OrderLogistics(Base):
    __tablename__ = "order_logistics"

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        primary_key=True,
    )
    pickup_address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.id", ondelete="RESTRICT"),
        nullable=False,
    )
    delivery_address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.id", ondelete="RESTRICT"),
        nullable=False,
    )
    courier_id: Mapped[int | None] = mapped_column(
        ForeignKey("couriers.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_pickup_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    requested_pickup_to: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    actual_pickup_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_delivery_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    order: Mapped["Order"] = relationship(back_populates="logistics")
    pickup_address: Mapped["Address"] = relationship(foreign_keys=[pickup_address_id])
    delivery_address: Mapped["Address"] = relationship(
        foreign_keys=[delivery_address_id]
    )
    courier: Mapped["Courier | None"] = relationship(foreign_keys=[courier_id])
