from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .order import Order


class Cargo(Base):
    __tablename__ = "order_cargos"

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        primary_key=True,
    )
    weight: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    special_instructions: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    order: Mapped["Order"] = relationship(back_populates="cargo")
