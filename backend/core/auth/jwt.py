from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

import jwt
from jwt import InvalidTokenError

from core.config import settings
from core.enums import UserRole

ACCESS = "access"
REFRESH = "refresh"


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(
        payload,
        settings.auth.secret_key,
        algorithm=settings.auth.algorithm,
    )


def create_access_token(user_id: int, roles: Iterable[UserRole]) -> str:
    now = datetime.now(timezone.utc)
    return _encode(
        {
            "sub": str(user_id),
            "roles": [r.value for r in roles],
            "type": ACCESS,
            "iat": now,
            "exp": now + timedelta(minutes=settings.auth.access_token_expire_minutes),
        }
    )


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return _encode(
        {
            "sub": str(user_id),
            "type": REFRESH,
            "iat": now,
            "exp": now + timedelta(days=settings.auth.refresh_token_expire_days),
        }
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.auth.secret_key,
            algorithms=[settings.auth.algorithm],
        )
    except InvalidTokenError as exc:
        raise ValueError(str(exc)) from exc
