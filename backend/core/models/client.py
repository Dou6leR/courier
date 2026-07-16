from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .order import Order
    from .user import User


class Client(Base):
    __tablename__ = "clients"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    user: Mapped["User"] = relationship()
    sent_orders: Mapped[list["Order"]] = relationship(
        back_populates="sender",
        foreign_keys="Order.sender_id",
    )
    received_orders: Mapped[list["Order"]] = relationship(
        back_populates="recipient",
        foreign_keys="Order.recipient_id",
    )
