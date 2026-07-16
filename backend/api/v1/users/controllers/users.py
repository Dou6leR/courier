from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.users.services.user_service import UserService
from core.auth.dependencies import get_current_user
from core.helpers.db_helper import db_helper
from core.models.user import User
from core.schemas.user import UserOut, UserUpdateIn

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdateIn, user: CurrentUserDep, session: SessionDep
) -> UserOut:
    return await UserService.update_me(session, user, data)


@router.get("/check-phone")
async def check_phone(
    phone: str, user: CurrentUserDep, session: SessionDep
) -> dict:
    return await UserService.check_phone(session, phone, user.id)
