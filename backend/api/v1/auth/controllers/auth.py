from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.services.auth_service import AuthService
from core.auth.dependencies import get_current_user
from core.auth.jwt import REFRESH, decode_token
from core.auth.roles import resolve_user_roles
from core.config import settings
from core.helpers.db_helper import db_helper
from core.models.user import User
from core.schemas.auth import (
    AddCourierRoleIn,
    ClientRegisterIn,
    CourierRegisterIn,
    LoginIn,
    TokenOut,
)
from core.schemas.user import UserOut

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.post(
    "/register/client", response_model=TokenOut, status_code=status.HTTP_201_CREATED
)
async def register_client(
    data: ClientRegisterIn, response: Response, session: SessionDep
) -> TokenOut:
    user, roles = await AuthService.register_client(session, data)
    return AuthService.issue_tokens(response, user, roles)


@router.post(
    "/register/courier", response_model=TokenOut, status_code=status.HTTP_201_CREATED
)
async def register_courier(
    data: CourierRegisterIn, response: Response, session: SessionDep
) -> TokenOut:
    user, roles = await AuthService.register_courier(session, data)
    return AuthService.issue_tokens(response, user, roles)


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, response: Response, session: SessionDep) -> TokenOut:
    user, roles = await AuthService.authenticate(session, data.email, data.password)
    return AuthService.issue_tokens(response, user, roles)


@router.post("/refresh", response_model=TokenOut)
async def refresh_token_endpoint(
    request: Request, response: Response, session: SessionDep
) -> TokenOut:
    cookie = request.cookies.get(settings.auth.refresh_cookie_name)
    if not cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    try:
        payload = decode_token(cookie)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {exc}",
        ) from exc
    if payload.get("type") != REFRESH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token type",
        )
    user = await session.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
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
    return AuthService.issue_tokens(response, user, roles)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    AuthService.clear_refresh_cookie(response)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUserDep, session: SessionDep) -> UserOut:
    roles = await resolve_user_roles(session, user.id)
    if not roles:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no roles assigned",
        )
    return AuthService._build_user_out(user, roles)


@router.post("/roles/client", response_model=TokenOut)
async def add_client_role(
    user: CurrentUserDep, response: Response, session: SessionDep
) -> TokenOut:
    roles = await AuthService.add_client_role(session, user)
    return AuthService.issue_tokens(response, user, roles)


@router.post("/roles/courier", response_model=TokenOut)
async def add_courier_role(
    data: AddCourierRoleIn,
    user: CurrentUserDep,
    response: Response,
    session: SessionDep,
) -> TokenOut:
    roles = await AuthService.add_courier_role(session, user, data.transport_id)
    return AuthService.issue_tokens(response, user, roles)
