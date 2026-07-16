from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth.roles import resolve_user_roles
from core.enums import UserRole
from core.models.client import Client
from core.models.user import User
from core.schemas.user import UserOut, UserUpdateIn


class UserService:
    @classmethod
    async def update_me(
        cls, session: AsyncSession, user: User, dto: UserUpdateIn
    ) -> UserOut:
        data = dto.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(user, field, value)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or phone already exists",
            ) from exc
        await session.refresh(user)
        roles: list[UserRole] = await resolve_user_roles(session, user.id)
        return UserOut(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            roles=roles,
        )

    @classmethod
    async def check_phone(
        cls,
        session: AsyncSession,
        phone: str,
        current_user_id: int,
    ) -> dict:
        user = await session.scalar(
            select(User).where(User.phone == phone)
        )
        if user is None:
            return {"exists": False, "reason": "not_found"}
        if user.id == current_user_id:
            return {"exists": False, "reason": "self"}
        client = await session.scalar(
            select(Client).where(Client.user_id == user.id)
        )
        if client is None:
            return {"exists": False, "reason": "not_client"}
        return {"exists": True, "full_name": user.full_name}
