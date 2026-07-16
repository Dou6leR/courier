from fastapi import HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth.jwt import create_access_token, create_refresh_token
from core.auth.password import hash_password, verify_password
from core.auth.roles import resolve_user_roles
from core.config import settings
from core.enums import UserRole
from core.models.client import Client
from core.models.courier import Courier
from core.models.user import User
from core.schemas.auth import ClientRegisterIn, CourierRegisterIn, TokenOut
from core.schemas.user import UserOut


class AuthService:
    @classmethod
    def _set_refresh_cookie(cls, response: Response, token: str) -> None:
        response.set_cookie(
            key=settings.auth.refresh_cookie_name,
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/api/v1/auth",
            max_age=settings.auth.refresh_token_expire_days * 24 * 3600,
        )

    @classmethod
    def _build_user_out(cls, user: User, roles: list[UserRole]) -> UserOut:
        return UserOut(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            roles=roles,
        )

    @classmethod
    def issue_tokens(
        cls, response: Response, user: User, roles: list[UserRole]
    ) -> TokenOut:
        access = create_access_token(user.id, roles)
        refresh = create_refresh_token(user.id)
        cls._set_refresh_cookie(response, refresh)
        return TokenOut(access_token=access, user=cls._build_user_out(user, roles))

    @classmethod
    def clear_refresh_cookie(cls, response: Response) -> None:
        response.delete_cookie(
            key=settings.auth.refresh_cookie_name,
            path="/api/v1/auth",
        )

    @classmethod
    async def _get_user_by_email(cls, session: AsyncSession, email: str) -> User | None:
        return await session.scalar(select(User).where(User.email == email))

    @classmethod
    async def _create_user(
        cls,
        session: AsyncSession,
        full_name: str,
        phone: str,
        email: str,
        password: str,
    ) -> User:
        user = User(
            full_name=full_name,
            phone=phone,
            email=email,
            password_hash=hash_password(password),
        )
        session.add(user)
        try:
            await session.flush()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email or phone already exists",
            ) from exc
        return user

    @classmethod
    async def register_client(
        cls, session: AsyncSession, data: ClientRegisterIn
    ) -> tuple[User, list[UserRole]]:
        user = await cls._create_user(
            session, data.full_name, data.phone, data.email, data.password
        )
        session.add(Client(user_id=user.id))
        await session.commit()
        await session.refresh(user)
        return user, [UserRole.client]

    @classmethod
    async def register_courier(
        cls, session: AsyncSession, data: CourierRegisterIn
    ) -> tuple[User, list[UserRole]]:
        user = await cls._create_user(
            session, data.full_name, data.phone, data.email, data.password
        )
        session.add(Courier(user_id=user.id, transport_id=data.transport_id))
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid transport_id",
            ) from exc
        await session.refresh(user)
        return user, [UserRole.courier]

    @classmethod
    async def authenticate(
        cls, session: AsyncSession, email: str, password: str
    ) -> tuple[User, list[UserRole]]:
        user = await cls._get_user_by_email(session, email)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Акаунт деактивовано",
            )
        roles = await resolve_user_roles(session, user.id)
        if not roles:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User has no roles assigned",
            )
        return user, roles

    @classmethod
    async def add_client_role(cls, session: AsyncSession, user: User) -> list[UserRole]:
        roles = await resolve_user_roles(session, user.id)
        if UserRole.client in roles:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a client",
            )
        session.add(Client(user_id=user.id))
        await session.commit()
        return await resolve_user_roles(session, user.id)

    @classmethod
    async def add_courier_role(
        cls, session: AsyncSession, user: User, transport_id: int | None
    ) -> list[UserRole]:
        roles = await resolve_user_roles(session, user.id)
        if UserRole.courier in roles:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a courier",
            )
        session.add(Courier(user_id=user.id, transport_id=transport_id))
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid transport_id",
            ) from exc
        return await resolve_user_roles(session, user.id)
