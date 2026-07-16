import enum


class UserRole(str, enum.Enum):
    client = "client"
    courier = "courier"
    admin = "admin"
