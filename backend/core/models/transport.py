from sqlalchemy import Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import TransportType
from .mixins import IntIdPkMixin


class Transport(IntIdPkMixin, Base):
    __tablename__ = "transports"

    model: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[TransportType] = mapped_column(
        Enum(
            TransportType,
            name="transport_type",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    max_weight: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    max_volume: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    couriers: Mapped[list["Courier"]] = relationship(  # noqa: F821
        back_populates="transport",
    )
