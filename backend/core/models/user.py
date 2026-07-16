from sqlalchemy import Boolean, String, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .mixins import IntIdPkMixin, TimestampsMixin


class User(IntIdPkMixin, TimestampsMixin, Base):
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
