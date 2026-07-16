import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from core.schemas.user import UserOut

_PHONE_RE = re.compile(r"^\+380\d{9}$")
_NAME_RE = re.compile(r"^[A-Za-zА-Яа-яІіЇїЄєҐґЁё'\-\s]+$")


class _RegisterBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=13, max_length=13)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        if not _NAME_RE.match(v):
            raise ValueError("Ім'я може містити лише літери, пробіли, апостроф та дефіс")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("Телефон має бути у форматі +380XXXXXXXXX")
        return v


class ClientRegisterIn(_RegisterBase):
    pass


class CourierRegisterIn(_RegisterBase):
    transport_id: int | None = None


class AddCourierRoleIn(BaseModel):
    transport_id: int | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
