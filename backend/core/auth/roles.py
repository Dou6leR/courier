from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import UserRole
from core.models.admin import Admin
from core.models.client import Client
from core.models.courier import Courier


async def resolve_user_roles(session: AsyncSession, user_id: int) -> list[UserRole]:
    """Determine all roles a user has by checking each role table.

    A user can simultaneously be a client and a courier (and/or admin).
    Returns an empty list if the user has no roles (should not normally
    happen — a role row is created atomically with the user during
    registration).
    """
    roles: list[UserRole] = []
    if await session.scalar(select(Admin.user_id).where(Admin.user_id == user_id)):
        roles.append(UserRole.admin)
    if await session.scalar(select(Courier.user_id).where(Courier.user_id == user_id)):
        roles.append(UserRole.courier)
    if await session.scalar(select(Client.user_id).where(Client.user_id == user_id)):
        roles.append(UserRole.client)
    return roles
