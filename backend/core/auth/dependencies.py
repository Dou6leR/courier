from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth.jwt import ACCESS, decode_token
from core.enums import UserRole
from core.helpers.db_helper import db_helper
from core.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=True)


def get_current_token_payload(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> dict[str, Any]:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != ACCESS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token type",
        )
    return payload


async def get_current_user(
    payload: Annotated[dict[str, Any], Depends(get_current_token_payload)],
    session: Annotated[AsyncSession, Depends(db_helper.session_getter)],
) -> User:
    user_id = int(payload["sub"])
    user = await session.get(User, user_id)
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
    return user


def require_roles(*roles: UserRole):
    """Allow request if the user has at least one of the listed roles."""
    allowed = {r.value for r in roles}

    def _checker(
        payload: Annotated[dict[str, Any], Depends(get_current_token_payload)],
    ) -> dict[str, Any]:
        token_roles = set(payload.get("roles") or [])
        if not (token_roles & allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return payload

    return _checker
