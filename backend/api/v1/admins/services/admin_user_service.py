import logging

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.enums import UserRole
from core.models.admin import Admin
from core.models.client import Client
from core.models.courier import Courier
from core.models.enums import OrderStatus
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.user import User
from core.schemas.admin import AdminUserOut, UserRoleFilter

logger = logging.getLogger(__name__)


class AdminUserService:
    @classmethod
    async def _role_sets(
        cls, session: AsyncSession
    ) -> tuple[set[int], set[int], set[int]]:
        admin_ids = set(
            (await session.scalars(select(Admin.user_id))).all()
        )
        courier_ids = set(
            (await session.scalars(select(Courier.user_id))).all()
        )
        client_ids = set(
            (await session.scalars(select(Client.user_id))).all()
        )
        return admin_ids, courier_ids, client_ids

    @classmethod
    async def _orders_counts(cls, session: AsyncSession) -> dict[int, int]:
        sender_rows = (
            await session.execute(
                select(Order.sender_id, func.count(Order.id)).group_by(Order.sender_id)
            )
        ).all()
        recipient_rows = (
            await session.execute(
                select(Order.recipient_id, func.count(Order.id)).group_by(
                    Order.recipient_id
                )
            )
        ).all()
        counts: dict[int, int] = {}
        for uid, cnt in sender_rows:
            counts[uid] = counts.get(uid, 0) + cnt
        for uid, cnt in recipient_rows:
            counts[uid] = counts.get(uid, 0) + cnt
        return counts

    @classmethod
    async def _courier_ratings(cls, session: AsyncSession) -> dict[int, float]:
        rows = (
            await session.execute(
                select(Courier.user_id, Courier.rating_avg)
            )
        ).all()
        return {uid: float(r) for uid, r in rows}

    @classmethod
    def _build(
        cls,
        user: User,
        admin_ids: set[int],
        courier_ids: set[int],
        client_ids: set[int],
        counts: dict[int, int],
        ratings: dict[int, float],
    ) -> AdminUserOut:
        roles: list[UserRole] = []
        if user.id in admin_ids:
            roles.append(UserRole.admin)
        if user.id in courier_ids:
            roles.append(UserRole.courier)
        if user.id in client_ids:
            roles.append(UserRole.client)
        return AdminUserOut(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            roles=roles,
            is_active=user.is_active,
            orders_count=counts.get(user.id, 0),
            rating=ratings.get(user.id) if user.id in courier_ids else None,
        )

    @classmethod
    async def list_users(
        cls,
        session: AsyncSession,
        role_filter: UserRoleFilter,
        search: str | None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[AdminUserOut]:
        admin_ids, courier_ids, client_ids = await cls._role_sets(session)

        stmt = select(User).order_by(User.id.asc())
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                    User.phone.ilike(like),
                )
            )
        if role_filter != "all":
            target_ids = {
                "admin": admin_ids,
                "courier": courier_ids,
                "client": client_ids,
            }[role_filter]
            stmt = stmt.where(User.id.in_(target_ids))

        if limit:
            stmt = stmt.limit(limit).offset(offset)
        users = (await session.scalars(stmt)).all()

        counts = await cls._orders_counts(session)
        ratings = await cls._courier_ratings(session)
        return [
            cls._build(u, admin_ids, courier_ids, client_ids, counts, ratings)
            for u in users
        ]

    @classmethod
    async def set_active(
        cls, session: AsyncSession, user_id: int, is_active: bool
    ) -> AdminUserOut:
        user = await session.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Користувача не знайдено",
            )
        user.is_active = is_active

        if not is_active:
            await cls._cascade_deactivate(session, user_id)
        else:
            await cls._cascade_reactivate(session, user_id)

        await session.commit()
        await session.refresh(user)

        admin_ids, courier_ids, client_ids = await cls._role_sets(session)
        counts = await cls._orders_counts(session)
        ratings = await cls._courier_ratings(session)
        return cls._build(user, admin_ids, courier_ids, client_ids, counts, ratings)

    @classmethod
    async def _cascade_reactivate(
        cls, session: AsyncSession, user_id: int
    ) -> None:
        courier = await session.get(Courier, user_id)
        if courier is not None:
            courier.is_available = True

    @classmethod
    async def _cascade_deactivate(
        cls, session: AsyncSession, user_id: int
    ) -> None:
        courier = await session.get(Courier, user_id)
        if courier is not None:
            await cls._deactivate_courier(session, courier)

        client = await session.get(Client, user_id)
        if client is not None:
            await cls._deactivate_client(session, user_id)

    @classmethod
    async def _deactivate_courier(
        cls, session: AsyncSession, courier: Courier
    ) -> None:
        from api.v1.couriers.services.route_planner_service import RoutePlannerService
        from api.v1.orders.services.assignment_service import AssignmentService

        courier.is_available = False

        orders = list(
            (
                await session.scalars(
                    select(Order)
                    .join(OrderLogistics, OrderLogistics.order_id == Order.id)
                    .where(
                        OrderLogistics.courier_id == courier.user_id,
                        Order.status == OrderStatus.ASSIGNED,
                    )
                    .options(selectinload(Order.logistics))
                )
            ).all()
        )
        if not orders:
            return

        from zoneinfo import ZoneInfo
        lviv_tz = ZoneInfo("Europe/Kyiv")
        affected_dates: set = set()
        freed_ids: list[int] = []

        for order in orders:
            order.logistics.courier_id = None
            order.status = OrderStatus.PENDING
            pickup_date = order.logistics.requested_pickup_from.astimezone(lviv_tz).date()
            affected_dates.add(pickup_date)
            freed_ids.append(order.id)

        await session.flush()

        for d in affected_dates:
            await RoutePlannerService.rebuild(session, courier.user_id, d)

        for oid in freed_ids:
            try:
                await AssignmentService.try_assign(session, oid)
            except Exception:
                logger.exception("reassign failed for order_id=%s", oid)

    @classmethod
    async def _deactivate_client(
        cls, session: AsyncSession, user_id: int
    ) -> None:
        from api.v1.couriers.services.route_planner_service import RoutePlannerService
        from zoneinfo import ZoneInfo

        lviv_tz = ZoneInfo("Europe/Kyiv")

        orders = list(
            (
                await session.scalars(
                    select(Order)
                    .where(
                        or_(Order.sender_id == user_id, Order.recipient_id == user_id),
                        Order.status.in_([OrderStatus.PENDING, OrderStatus.ASSIGNED]),
                    )
                    .options(selectinload(Order.logistics))
                )
            ).all()
        )
        if not orders:
            return

        courier_dates: dict[int, set] = {}
        for order in orders:
            if (
                order.status == OrderStatus.ASSIGNED
                and order.logistics
                and order.logistics.courier_id
            ):
                cid = order.logistics.courier_id
                pickup_date = order.logistics.requested_pickup_from.astimezone(lviv_tz).date()
                courier_dates.setdefault(cid, set()).add(pickup_date)
                order.logistics.courier_id = None
            order.status = OrderStatus.CANCELLED

        await session.flush()

        for cid, dates in courier_dates.items():
            for d in dates:
                await RoutePlannerService.rebuild(session, cid, d)
