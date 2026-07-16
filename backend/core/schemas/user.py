import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from core.enums import UserRole

_PHONE_RE = re.compile(r"^\+380\d{9}$")
_NAME_RE = re.compile(
    r"^[A-Za-zА-Яа-яІіЇїЄєҐґЁё'\-\s]+$",
)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    email: EmailStr
    roles: list[UserRole]


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, min_length=13, max_length=13)
    email: EmailStr | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is not None and not _NAME_RE.match(v):
            raise ValueError("Ім'я може містити лише літери, пробіли, апостроф та дефіс")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None and not _PHONE_RE.match(v):
            raise ValueError("Телефон має бути у форматі +380XXXXXXXXX")
        return v
