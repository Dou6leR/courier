"""Populate the database with random but valid data for development.

Usage:
    uv run python -m actions.populate_db [--users 150] [--orders 500]
        [--addresses 30] [--seed 42] [--wipe]

Reads reference data from external files in actions/seed_data/:
  - first_names.txt         — Ukrainian first names (one per line)
  - last_names.json         — Ukrainian surnames [{surname: ...}, ...]
  - addresses.json          — official Lviv address directory
  - transport/bike.json     — bicycle models (Canyon)
  - transport/scooter_models.json — scooter brand names
  - transport/car_models.json     — car brand names (used for car/van/truck)

Default credentials for every generated user: password "password123",
emails like user1@example.com, user2@example.com, ...
"""

import argparse
import asyncio
import json
import random
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.orders.services.assignment_service import AssignmentService
from api.v1.orders.services.order_service import calculate_price
from core.auth.password import hash_password
from core.helpers.db_helper import db_helper
from core.models import (
    Address,
    Admin,
    Cargo,
    Client,
    Courier,
    CourierRouteStop,
    Order,
    OrderLogistics,
    OrderStatus,
    Payment,
    PaymentMethod,
    Review,
    Transport,
    TransportType,
    User,
)

LVIV_TZ = ZoneInfo("Europe/Kyiv")

SEED_DIR = Path(__file__).parent / "seed_data"

INSTRUCTIONS = [
    "Не дзвонити, написати в месенджер.",
    "Обережно, крихке.",
    "Залишити у консьєржа.",
    "Не залишати під дверима.",
    "Зателефонувати за 30 хвилин до прибуття.",
]
COMMENTS = [
    "Швидко і чітко, дякую!",
    "Все було вчасно, рекомендую.",
    "Кур'єр запізнився, але загалом нормально.",
    "Посилка пошкоджена, неприємно.",
    "Чудовий сервіс, скористаюся ще.",
    "Без скарг.",
]

PICKUP_SLOT_HOURS = [10, 12, 14, 16, 18]
PICKUP_WINDOW_HOURS = 2

STREET_TYPE_SHORT = {
    "вулиця": "вул.",
    "проспект": "просп.",
    "площа": "пл.",
    "провулок": "пров.",
    "майдан": "майдан",
    "проїзд": "проїзд",
}

# (max_weight_kg, max_volume_m3)
TRANSPORT_CAPACITY = {
    TransportType.BIKE: (15, 0.2),
    TransportType.SCOOTER: (50, 0.5),
    TransportType.CAR: (500, 2.5),
    TransportType.VAN: (1500, 10.0),
    TransportType.TRUCK: (10000, 60.0),
}


# ---------- load reference data from files ----------


def _load_first_names() -> list[str]:
    path = SEED_DIR / "first_names.txt"
    with open(path, encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def _load_last_names() -> list[str]:
    path = SEED_DIR / "last_names.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [item["surname"] for item in data]


def _load_address_records() -> list[dict]:
    path = SEED_DIR / "addresses.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    fields = [field["id"] for field in raw["fields"]]
    result = []
    for row in raw["records"]:
        rec = dict(zip(fields, row))
        x, y = rec.get("x"), rec.get("y")
        if x in (None, "null", 0) or y in (None, "null", 0):
            continue
        street_type = rec.get("street_type", "")
        street_name = rec.get("street_d_name", "")
        housenumber = rec.get("housenumber", "")
        if not street_name or not housenumber or housenumber == "null":
            continue
        short_type = STREET_TYPE_SHORT.get(street_type, street_type)
        result.append(
            {
                "city": rec.get("city_name", "Львів"),
                "street": f"{short_type} {street_name}",
                "building": str(housenumber),
                "lat": round(float(y), 6),
                "lon": round(float(x), 6),
            }
        )
    return result


def _load_bike_models() -> list[str]:
    path = SEED_DIR / "transport" / "bike.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    brand = data.get("brand", "")
    return [f"{brand} {m['model']}" for m in data.get("models", [])]


def _load_scooter_models() -> list[str]:
    path = SEED_DIR / "transport" / "scooter_models.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [item["name"] for item in data.get("data", [])]


def _load_car_models() -> list[str]:
    path = SEED_DIR / "transport" / "car_models.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [item["name"] for item in data.get("data", [])]


# ---------- helpers ----------


def _rand_lviv_coords() -> tuple[float, float]:
    lat = round(random.uniform(49.80, 49.88), 6)
    lon = round(random.uniform(23.95, 24.11), 6)
    return lat, lon


def _weighted_choice(choices: list[tuple[object, float]]):
    population, weights = zip(*choices)
    return random.choices(population, weights=weights, k=1)[0]


def _pickup_window(d: date) -> tuple[datetime, datetime]:
    hour = random.choice(PICKUP_SLOT_HOURS)
    start_local = datetime.combine(d, time(hour, 0), LVIV_TZ)
    return start_local.astimezone(timezone.utc), (
        start_local + timedelta(hours=PICKUP_WINDOW_HOURS)
    ).astimezone(timezone.utc)


# ---------- generators ----------


async def _wipe(session: AsyncSession) -> None:
    tables = [
        Review,
        Payment,
        CourierRouteStop,
        Cargo,
        OrderLogistics,
        Order,
        Admin,
        Courier,
        Client,
        User,
        Transport,
        Address,
    ]
    names = ", ".join(m.__tablename__ for m in tables)
    await session.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    await session.commit()
    print("Wiped existing data (identities reset)")


async def _next_user_index(session: AsyncSession) -> int:
    max_id = await session.scalar(select(func.max(User.id)))
    return (max_id or 0) + 1


def _make_users(
    start_index: int,
    count: int,
    password_hash_value: str,
    first_names: list[str],
    last_names: list[str],
) -> list[User]:
    users: list[User] = []
    for i in range(count):
        n = start_index + i
        is_active = True if i < 4 else random.random() >= 0.04
        users.append(
            User(
                full_name=f"{random.choice(first_names)} {random.choice(last_names)}",
                phone=f"+38050{n:07d}",
                email=f"user{n}@example.com",
                password_hash=password_hash_value,
                is_active=is_active,
            )
        )
    return users


def _make_addresses(count: int, address_records: list[dict]) -> list[Address]:
    chosen = random.sample(address_records, min(count, len(address_records)))
    addrs: list[Address] = []
    for a in chosen:
        addrs.append(
            Address(
                city=a["city"],
                street=a["street"],
                building=a["building"],
                apartment=(
                    str(random.randint(1, 300)) if random.random() < 0.5 else None
                ),
                lat=a["lat"],
                lon=a["lon"],
            )
        )
    return addrs


def _make_transports(
    count: int,
    bike_models: list[str],
    scooter_models: list[str],
    car_models: list[str],
) -> list[Transport]:
    transports: list[Transport] = []
    types = list(TransportType)
    queue = list(types)
    while len(queue) < count:
        queue.append(random.choice(types))
    random.shuffle(queue)
    for ttype in queue[:count]:
        max_w, max_v = TRANSPORT_CAPACITY[ttype]
        if ttype == TransportType.BIKE:
            model = random.choice(bike_models)
        elif ttype == TransportType.SCOOTER:
            model = random.choice(scooter_models)
        else:
            brand = random.choice(car_models)
            type_label = {
                TransportType.CAR: "Car",
                TransportType.VAN: "Van",
                TransportType.TRUCK: "Truck",
            }[ttype]
            model = f"{brand} {type_label}"
        transports.append(
            Transport(
                model=model,
                type=ttype,
                max_weight=round(max_w * random.uniform(0.6, 1.0), 2),
                max_volume=round(max_v * random.uniform(0.6, 1.0), 2),
            )
        )
    return transports


def _determine_roles(
    users: list[User],
) -> tuple[list[int], list[int], list[int]]:
    forced = {
        0: ("client",),
        1: ("client",),
        2: ("courier",),
        3: ("admin",),
    }

    client_ids: list[int] = []
    courier_ids: list[int] = []
    admin_ids: list[int] = []

    for idx, user in enumerate(users):
        roles: set[str] = set()
        if idx in forced:
            roles.update(forced[idx])
        else:
            r = random.random()
            if r < 0.40:
                roles.add("client")
            elif r < 0.70:
                roles.add("courier")
            elif r < 0.90:
                roles.update({"client", "courier"})
            else:
                roles.add("admin")
                if random.random() < 0.5:
                    roles.add("client")

        if "client" in roles:
            client_ids.append(user.id)
        if "courier" in roles:
            courier_ids.append(user.id)
        if "admin" in roles:
            admin_ids.append(user.id)

    return client_ids, courier_ids, admin_ids


def _create_roles(
    client_ids: list[int],
    courier_ids: list[int],
    admin_ids: list[int],
    transports: list[Transport],
) -> tuple[list[Client], list[Courier], list[Admin]]:
    clients = [Client(user_id=uid) for uid in client_ids]
    admins = [Admin(user_id=uid) for uid in admin_ids]

    now = datetime.now(timezone.utc)
    shuffled_transports = list(transports)
    random.shuffle(shuffled_transports)

    couriers: list[Courier] = []
    for i, uid in enumerate(courier_ids):
        transport = shuffled_transports[i] if i < len(shuffled_transports) else None
        lat, lon = _rand_lviv_coords()
        couriers.append(
            Courier(
                user_id=uid,
                transport_id=transport.id if transport else None,
                is_available=random.random() < 0.95,
                rating_avg=0,
                last_known_lat=lat,
                last_known_lon=lon,
                last_location_at=now - timedelta(minutes=random.randint(0, 30)),
            )
        )

    return clients, couriers, admins


async def _try_assign_order(session: AsyncSession, order_id: int) -> int | None:
    return await AssignmentService.try_assign(session, order_id)


async def _backdate_to_delivered(
    session: AsyncSession,
    order: Order,
    today_lviv: date,
    now_utc_val: datetime,
) -> None:
    from api.v1.couriers.services.route_planner_service import RoutePlannerService

    courier_id = order.logistics.courier_id
    old_plan_date = order.logistics.requested_pickup_from.astimezone(LVIV_TZ).date()

    past_date = today_lviv - timedelta(days=random.randint(1, 7))
    hour = random.choice(PICKUP_SLOT_HOURS)
    wfrom, wto = _pickup_window_on(past_date, hour)
    order.logistics.requested_pickup_from = wfrom
    order.logistics.requested_pickup_to = wto
    raw_pickup = wfrom + timedelta(minutes=random.randint(0, 60))
    order.logistics.actual_pickup_time = min(
        raw_pickup, now_utc_val - timedelta(minutes=5)
    )
    raw_delivery = order.logistics.actual_pickup_time + timedelta(
        minutes=random.randint(20, 90)
    )
    order.logistics.actual_delivery_time = min(
        raw_delivery, now_utc_val - timedelta(minutes=1)
    )
    order.status = OrderStatus.DELIVERED
    await session.flush()

    if courier_id is not None:
        await RoutePlannerService.rebuild(
            session, courier_id, old_plan_date, reassign=False
        )


def _pickup_window_on(plan_date: date, hour: int) -> tuple[datetime, datetime]:
    start_local = datetime.combine(plan_date, time(hour, 0), LVIV_TZ)
    return (
        start_local.astimezone(timezone.utc),
        (start_local + timedelta(hours=PICKUP_WINDOW_HOURS)).astimezone(timezone.utc),
    )


def _pick_date_and_window(
    status: OrderStatus,
) -> tuple[date, datetime, datetime]:
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LVIV_TZ)
    today = now_local.date()
    cur_dec = now_local.hour + now_local.minute / 60

    if status == OrderStatus.DELIVERED:
        plan_date = today - timedelta(days=random.randint(1, 7))
        hour = random.choice(PICKUP_SLOT_HOURS)
        wfrom, wto = _pickup_window_on(plan_date, hour)
        return plan_date, wfrom, wto

    plan_date = today + timedelta(days=random.randint(0, 6))
    if plan_date == today:
        future_hours = [h for h in PICKUP_SLOT_HOURS if h > cur_dec]
        if not future_hours:
            plan_date = today + timedelta(days=1)
            hour = random.choice(PICKUP_SLOT_HOURS)
        else:
            hour = random.choice(future_hours)
    else:
        hour = random.choice(PICKUP_SLOT_HOURS)
    wfrom, wto = _pickup_window_on(plan_date, hour)
    return plan_date, wfrom, wto


def _make_orders(
    count: int,
    clients: list[Client],
    couriers: list[Courier],
    addresses: list[Address],
) -> tuple[list[Order], list[dict]]:
    if len(clients) < 2:
        raise SystemExit("Need at least 2 clients to create orders")
    if not addresses:
        raise SystemExit("Need at least 1 address to create orders")

    status_choices: list[tuple[OrderStatus, float]] = [
        (OrderStatus.DELIVERED, 0.50),
        (OrderStatus.ASSIGNED, 0.40),
        (OrderStatus.CANCELLED, 0.10),
    ]
    needs_assignment = {OrderStatus.ASSIGNED, OrderStatus.DELIVERED}

    orders: list[Order] = []
    details: list[dict] = []
    for _ in range(count):
        sender, recipient = random.sample(clients, 2)
        pickup_addr = random.choice(addresses)
        delivery_addr = random.choice(addresses)

        target_status = _weighted_choice(status_choices)

        weight = round(random.uniform(0.1, 15.0), 2)
        volume = round(random.uniform(0.001, 0.05), 3)

        window_status = (
            OrderStatus.ASSIGNED if target_status in needs_assignment else target_status
        )
        plan_date, window_from, window_to = _pick_date_and_window(window_status)

        if target_status == OrderStatus.CANCELLED:
            initial_status = OrderStatus.CANCELLED
            is_confirmed = True
        else:
            initial_status = OrderStatus.PENDING
            is_confirmed = True

        created_by_user_id = random.choice([sender.user_id, recipient.user_id])

        orders.append(
            Order(
                status=initial_status,
                is_confirmed=is_confirmed,
                created_by_user_id=created_by_user_id,
                sender_id=sender.user_id,
                recipient_id=recipient.user_id,
            )
        )
        details.append(
            {
                "weight": weight,
                "volume": volume,
                "special_instructions": (
                    random.choice(INSTRUCTIONS) if random.random() < 0.4 else None
                ),
                "requested_pickup_from": window_from,
                "requested_pickup_to": window_to,
                "pickup_address_id": pickup_addr.id,
                "delivery_address_id": delivery_addr.id,
                "courier_id": None,
                "actual_pickup_time": None,
                "actual_delivery_time": None,
                "plan_date": plan_date,
                "target_status": target_status,
            }
        )
    return orders, details


def _make_payments(orders: list[Order], details: list[dict]) -> list[Payment]:
    payments: list[Payment] = []
    methods = list(PaymentMethod)
    for order, det in zip(orders, details, strict=True):
        if order.status == OrderStatus.CANCELLED and random.random() < 0.5:
            continue

        method = random.choice(methods)

        if order.status == OrderStatus.DELIVERED:
            delivery_time = (
                det["actual_delivery_time"] or order.logistics.actual_delivery_time
            )
            if method == PaymentMethod.CASH:
                paid_at = delivery_time
            elif delivery_time and random.random() < 0.7:
                paid_at = delivery_time - timedelta(hours=random.uniform(0, 6))
            else:
                paid_at = None
        elif order.status in (
            OrderStatus.PICKED_UP,
            OrderStatus.ASSIGNED,
        ):
            paid_at = (
                det["requested_pickup_from"] - timedelta(hours=random.uniform(0, 12))
                if method != PaymentMethod.CASH and random.random() < 0.5
                else None
            )
        elif order.status == OrderStatus.CANCELLED:
            paid_at = (
                det["requested_pickup_from"] - timedelta(hours=random.uniform(1, 24))
                if random.random() < 0.6
                else None
            )
        else:
            paid_at = None

        refunded_at: datetime | None = None
        if (
            order.status == OrderStatus.CANCELLED
            and paid_at is not None
            and random.random() < 0.7
        ):
            refunded_at = paid_at + timedelta(hours=random.uniform(1, 24))

        payments.append(
            Payment(
                order_id=order.id,
                amount=calculate_price(det["weight"], det["volume"]),
                payment_method=method,
                paid_at=paid_at,
                refunded_at=refunded_at,
            )
        )
    return payments


def _make_reviews(orders: list[Order]) -> list[Review]:
    reviews: list[Review] = []
    rating_choices: list[tuple[int, float]] = [
        (1, 0.05),
        (2, 0.10),
        (3, 0.15),
        (4, 0.30),
        (5, 0.40),
    ]
    for order in orders:
        if order.status != OrderStatus.DELIVERED:
            continue
        for author_user_id in (order.sender_id, order.recipient_id):
            if random.random() > 0.6:
                continue
            reviews.append(
                Review(
                    order_id=order.id,
                    author_user_id=author_user_id,
                    rating=_weighted_choice(rating_choices),
                    comment=random.choice(COMMENTS) if random.random() < 0.7 else None,
                )
            )
    return reviews


# ---------- orchestration ----------


async def populate(
    session: AsyncSession,
    n_users: int,
    n_addresses: int,
    n_orders: int,
) -> None:
    first_names = _load_first_names()
    last_names = _load_last_names()
    address_records = _load_address_records()
    bike_models = _load_bike_models()
    scooter_models = _load_scooter_models()
    car_models = _load_car_models()

    print(
        f"Loaded seed data: {len(first_names)} first names, "
        f"{len(last_names)} last names, {len(address_records)} address records, "
        f"{len(bike_models)} bike models, {len(scooter_models)} scooter models, "
        f"{len(car_models)} car models"
    )

    password_hash_value = hash_password("password123")
    start_index = await _next_user_index(session)

    users = _make_users(
        start_index, n_users, password_hash_value, first_names, last_names
    )
    addresses = _make_addresses(n_addresses, address_records)

    session.add_all(users)
    session.add_all(addresses)
    await session.flush()

    client_ids, courier_ids, admin_ids = _determine_roles(users)
    transports = _make_transports(
        len(courier_ids), bike_models, scooter_models, car_models
    )
    session.add_all(transports)
    await session.flush()

    clients, couriers, admins = _create_roles(
        client_ids, courier_ids, admin_ids, transports
    )
    session.add_all(clients)
    session.add_all(couriers)
    session.add_all(admins)
    await session.flush()

    orders, details = _make_orders(n_orders, clients, couriers, addresses)
    session.add_all(orders)
    await session.flush()

    cargos: list[Cargo] = []
    logistics_rows: list[OrderLogistics] = []
    for order, det in zip(orders, details, strict=True):
        cargos.append(
            Cargo(
                order_id=order.id,
                weight=det["weight"],
                volume=det["volume"],
                special_instructions=det["special_instructions"],
            )
        )
        logistics_rows.append(
            OrderLogistics(
                order_id=order.id,
                requested_pickup_from=det["requested_pickup_from"],
                requested_pickup_to=det["requested_pickup_to"],
                pickup_address_id=det["pickup_address_id"],
                delivery_address_id=det["delivery_address_id"],
                courier_id=det["courier_id"],
                actual_pickup_time=det["actual_pickup_time"],
                actual_delivery_time=det["actual_delivery_time"],
            )
        )
    session.add_all(cargos)
    session.add_all(logistics_rows)
    await session.flush()

    now_utc_val = datetime.now(timezone.utc)
    today_lviv = now_utc_val.astimezone(LVIV_TZ).date()

    assigned_via_try_assign = 0
    for order, det in zip(orders, details, strict=True):
        if det["target_status"] != OrderStatus.DELIVERED:
            continue
        chosen = await _try_assign_order(session, order.id)
        if chosen is None:
            continue
        await _backdate_to_delivered(session, order, today_lviv, now_utc_val)
        assigned_via_try_assign += 1

    for order, det in zip(orders, details, strict=True):
        if det["target_status"] != OrderStatus.ASSIGNED:
            continue
        chosen = await _try_assign_order(session, order.id)
        if chosen is not None:
            assigned_via_try_assign += 1
    await session.flush()

    route_stops_count = await session.scalar(
        select(func.count()).select_from(CourierRouteStop)
    )

    payments = _make_payments(orders, details)
    reviews = _make_reviews(orders)
    session.add_all(payments)
    session.add_all(reviews)

    await session.commit()

    print(
        "Created: "
        f"{len(users)} users, {len(addresses)} addresses, "
        f"{len(transports)} transports, {len(clients)} clients, "
        f"{len(couriers)} couriers, {len(admins)} admins, "
        f"{len(orders)} orders ({assigned_via_try_assign} auto-assigned), "
        f"{route_stops_count} route_stops, "
        f"{len(payments)} payments, {len(reviews)} reviews"
    )
    print(
        f"Login range: user{start_index}@example.com .. "
        f"user{start_index + n_users - 1}@example.com (password: password123)"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate the database with random data from seed files"
    )
    parser.add_argument("--users", type=int, default=150)
    parser.add_argument("--addresses", type=int, default=30)
    parser.add_argument("--orders", type=int, default=500)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument(
        "--wipe", action="store_true", help="Delete all existing rows first"
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    try:
        async with db_helper.session_factory() as session:
            if args.wipe:
                await _wipe(session)
            await populate(
                session,
                n_users=args.users,
                n_addresses=args.addresses,
                n_orders=args.orders,
            )
    finally:
        await db_helper.dispose()


if __name__ == "__main__":
    asyncio.run(main())
