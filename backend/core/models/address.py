from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .mixins import IntIdPkMixin


class Address(IntIdPkMixin, Base):
    __tablename__ = "addresses"

    city: Mapped[str] = mapped_column(String(128), nullable=False)
    street: Mapped[str] = mapped_column(String(255), nullable=False)
    building: Mapped[str] = mapped_column(String(32), nullable=False)
    apartment: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    lon: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
