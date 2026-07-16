import enum


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    ONLINE = "online"


class TransportType(str, enum.Enum):
    BIKE = "bike"
    SCOOTER = "scooter"
    CAR = "car"
    VAN = "van"
    TRUCK = "truck"


class RouteStopType(str, enum.Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"
